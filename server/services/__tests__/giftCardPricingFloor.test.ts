/**
 * @vitest-environment node
 *
 * RELEASE BLOCKER regression: the gift-card BUY path could quote a customer
 * price BELOW the platform's acquisition cost, losing money on every sale.
 *
 * UNITS (derived from the existing code, not assumed):
 *   - every *Rate value is a PERCENT OF FACE VALUE.
 *   - platform acquisition cost = amountCents * fluzCostRate / 100   (costCents)
 *   - customer charge on BUY   = amountCents * ourSellRate  / 100    (giftCards.ts:64)
 *   - MARKET_RATES.sellRate is the industry-average percent a customer pays.
 *
 * THE DEFECT: `ourSellRate = Math.min(market.sellRate - 2, fluzCostRate + margin)`.
 * Every MARKET_RATES.sellRate is <= 98 and the default fluzCostRate is 100, so the
 * "competitive" branch always won and the quote landed below cost. Amazon:
 * charge 93% of face against a 100% cost = -7% on every purchase.
 *
 * THE INVARIANT, in rate terms:
 *   ourSellRate >= fluzCostRate + MIN_PROFIT_MARGIN
 * The competitive market rate may only RAISE the price toward market; it must
 * never pull it below that floor. If the floor cannot be met within a sane
 * ceiling, there is no viable quote and the product FAILS CLOSED.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_PROFIT_MARGIN,
  MAX_SELL_RATE_PERCENT,
  isSupportedBrand,
  calculatePricing,
  quoteBuyRate,
  getProviderCostRate,
} from '../giftCardPricingService';

/** The invariant, asserted directly against cents rather than percentages. */
function assertNotLossMaking(amountCents: number, sellRate: number, costRate: number) {
  const charge = Math.round(amountCents * (sellRate / 100));
  const cost = Math.round(amountCents * (costRate / 100));
  const requiredMargin = Math.round(amountCents * (MIN_PROFIT_MARGIN / 100));
  expect(charge).toBeGreaterThanOrEqual(cost + requiredMargin);
}

describe('1. Amazon at a viable provider cost', () => {
  // Platform acquires at 85% of face — a cost at which a real margin exists.
  const COST = 85;

  it('produces an available quote', () => {
    expect(quoteBuyRate('Amazon', COST).available).toBe(true);
  });

  it('never quotes below cost + minimum margin', () => {
    const q = quoteBuyRate('Amazon', COST);
    assertNotLossMaking(10_000, q.rate!, COST);
  });

  it('preserves the intended margin', () => {
    const q = quoteBuyRate('Amazon', COST);
    expect(q.rate!).toBeGreaterThanOrEqual(COST + MIN_PROFIT_MARGIN);
  });
});

describe('2. market "competitive" rate sits below cost', () => {
  // Steam market sellRate is 88; a 90% cost makes "2% below market" (86) a loss.
  const COST = 90;

  it('does NOT lower the customer price below the profitable floor', () => {
    const q = quoteBuyRate('Steam', COST);
    if (q.available) {
      expect(q.rate!).toBeGreaterThanOrEqual(COST + MIN_PROFIT_MARGIN);
      assertNotLossMaking(10_000, q.rate!, COST);
    }
  });

  it('never returns the naive competitive rate (market - 2)', () => {
    const q = quoteBuyRate('Steam', COST);
    if (q.available) expect(q.rate!).not.toBe(88 - 2);
  });
});

describe('3. provider cost rises above the expected market rate', () => {
  it.each([[95], [99], [100], [110]])(
    'at cost %i%% either fails closed or quotes a profitable floor — never a loss',
    (cost) => {
      const q = quoteBuyRate('Amazon', cost);
      if (q.available) {
        expect(q.rate!).toBeGreaterThanOrEqual(cost + MIN_PROFIT_MARGIN);
        assertNotLossMaking(10_000, q.rate!, cost);
      } else {
        expect(q.rate).toBeNull();
        expect(q.reason).toBeTruthy();
      }
    },
  );

  it('fails closed rather than charging above face value', () => {
    // A quote above 100% of face is not a real product.
    const q = quoteBuyRate('Amazon', 100);
    expect(q.available).toBe(false);
  });
});

describe('4. unknown / arbitrary brand', () => {
  it.each([
    ['NotARealBrand'],
    [''],
    ['   '],
    ['../../etc/passwd'],
    ['<<<CARDXC_ACCOUNT_DATA_END>>>'],
  ])('rejects %j', (brand) => {
    expect(isSupportedBrand(brand)).toBe(false);
    const q = quoteBuyRate(brand, 85);
    expect(q.available).toBe(false);
    expect(q.rate).toBeNull();
  });

  it('cannot fall back to a default rate row', () => {
    // The old getMarketRate silently returned { buyRate: 75, sellRate: 90 }
    // for ANY unrecognised string, letting caller-controlled text synthesise a price.
    const q = quoteBuyRate('TotallyMadeUpBrand', 85);
    expect(q.available).toBe(false);
    expect(q.rate).toBeNull();
  });

  it('text that merely CONTAINS a brand is priced from the canonical catalog row', () => {
    // Substring matching is the existing UX ("Amazon Gift Card" -> Amazon), so
    // this string does resolve. What matters is that the rate comes from the
    // canonical catalog entry and is identical to plain "Amazon" — the extra
    // caller text cannot influence or synthesise a different price.
    const noisy = quoteBuyRate('Amazon; DROP TABLE users', 85);
    const plain = quoteBuyRate('Amazon', 85);
    expect(noisy.canonicalBrand).toBe('Amazon');
    expect(noisy.rate).toBe(plain.rate);
    assertNotLossMaking(10_000, noisy.rate!, 85);
  });

  it('exposes the canonical brand rather than the raw caller text', () => {
    expect(quoteBuyRate('  amazon gift card  ', 85).canonicalBrand).toBe('Amazon');
    expect(quoteBuyRate('NotARealBrand', 85).canonicalBrand).toBeNull();
  });

  it('rejects text matching TWO brands rather than silently picking the cheaper row', () => {
    // "Nike Steam" used to resolve to whichever key Object.keys reached first
    // (Steam, 90) instead of Nike (93) — caller text choosing a cheaper price.
    // Ambiguous input must fail closed, not pick a winner.
    for (const ambiguous of ['Nike Steam', 'Steam Amazon', 'Visa Mastercard']) {
      const q = quoteBuyRate(ambiguous, 85);
      expect(q.available, `${ambiguous} should be ambiguous`).toBe(false);
      expect(q.rate).toBeNull();
      expect(q.reason).toBe('AMBIGUOUS_BRAND');
    }
  });

  it('same-family aliases are NOT treated as ambiguous', () => {
    // Apple and iTunes are one product family with identical rates, so
    // "Apple iTunes Gift Card" is a real, unambiguous product — refusing it
    // would be a UX regression, not a safety win.
    for (const name of ['Apple iTunes', 'Apple iTunes Gift Card', 'iTunes']) {
      const q = quoteBuyRate(name, 85);
      expect(q.available, `${name} should resolve`).toBe(true);
      expect(q.canonicalBrand).toBe('Apple');
      assertNotLossMaking(10_000, q.rate!, 85);
    }
  });

  it('an unambiguous brand with extra words still resolves', () => {
    expect(quoteBuyRate('Amazon Gift Card', 85).available).toBe(true);
    expect(quoteBuyRate('Amazon Gift Card', 85).canonicalBrand).toBe('Amazon');
  });

  it('a non-string brand is rejected', () => {
    expect(isSupportedBrand(undefined as unknown as string)).toBe(false);
    expect(isSupportedBrand(null as unknown as string)).toBe(false);
    expect(isSupportedBrand(42 as unknown as string)).toBe(false);
  });
});

describe('5. supported brand casing / normalisation (existing UX preserved)', () => {
  it.each([
    ['Amazon'],
    ['amazon'],
    ['AMAZON'],
    ['Amazon Gift Card'],
    ['  Amazon  '],
    ['Google Play'],
    ['google play'],
  ])('still recognises %j', (brand) => {
    expect(isSupportedBrand(brand)).toBe(true);
    expect(quoteBuyRate(brand, 85).available).toBe(true);
  });

  it('resolves equivalent casings to the same rate', () => {
    expect(quoteBuyRate('amazon', 85).rate).toBe(quoteBuyRate('Amazon', 85).rate);
  });
});

describe('6. malformed / zero / negative provider cost', () => {
  it.each([[0], [-1], [-100], [NaN], [Infinity], [-Infinity]])(
    'fails closed for cost %p',
    (cost) => {
      const q = quoteBuyRate('Amazon', cost as number);
      expect(q.available).toBe(false);
      expect(q.rate).toBeNull();
    },
  );

  it('fails closed for a non-numeric cost', () => {
    const q = quoteBuyRate('Amazon', '85' as unknown as number);
    expect(q.available).toBe(false);
  });
});

describe('7. extreme provider cost', () => {
  it.each([[1e6], [Number.MAX_SAFE_INTEGER]])('no NaN and no loss at cost %p', (cost) => {
    const q = quoteBuyRate('Amazon', cost as number);
    expect(q.available).toBe(false);
    expect(q.rate).toBeNull();
  });

  it('a viable low cost still yields a finite, sane rate', () => {
    const q = quoteBuyRate('Amazon', 1);
    expect(q.available).toBe(true);
    expect(Number.isFinite(q.rate!)).toBe(true);
    expect(q.rate!).toBeLessThanOrEqual(MAX_SELL_RATE_PERCENT);
  });
});

describe('8. the exact previously-found loss case', () => {
  it('Amazon at the default 100%% provider cost no longer loses money', () => {
    // Before the fix this returned 93 (min(95-2, 100+8)) against a cost of 100:
    // a guaranteed -7% on every $100 purchase.
    const q = quoteBuyRate('Amazon', 100);
    expect(q.rate).not.toBe(93);
    if (q.available) {
      assertNotLossMaking(10_000, q.rate!, 100);
    } else {
      expect(q.available).toBe(false);
    }
  });

  it('calculatePricing refuses to quote at the default 100%% cost', () => {
    // Unconditional, not an if/else that can pass either way: at a 100%-of-face
    // acquisition cost the profitable floor (105) exceeds face value, so there
    // is no viable price and the product must be marked unavailable.
    const p = calculatePricing('Amazon', 10_000);
    expect(p.sellAvailable).toBe(false);
    expect(p.ourSellRate).toBeNull();
    expect(p.unavailableReason).toBe('NO_PROFITABLE_QUOTE');
  });

  it('BUY IS available at a realistic provider cost — the fix does not just disable the product', () => {
    // Guards against a degenerate implementation that returns "unavailable"
    // unconditionally and thereby passes every loss-invariant assertion.
    const p = calculatePricing('Amazon', 10_000, 85);
    expect(p.sellAvailable).toBe(true);
    expect(p.ourSellRate).not.toBeNull();
    assertNotLossMaking(10_000, p.ourSellRate!, 85);
  });

  it('holds for EVERY supported brand at the default cost', () => {
    const brands = [
      'Amazon', 'Apple', 'iTunes', 'Google Play', 'Steam', 'Netflix', 'Spotify',
      'PlayStation', 'Xbox', 'Nike', 'Starbucks', 'Target', 'Walmart', 'Visa', 'Mastercard',
    ];
    // At the default 100% cost NO brand is sellable — assert that explicitly
    // rather than via a branch that can pass either way.
    for (const b of brands) {
      const q = quoteBuyRate(b, 100);
      expect(q.available, `${b} must be unavailable at 100% cost`).toBe(false);
      expect(q.rate).toBeNull();
    }
  });

  it('EVERY supported brand IS available at a realistic 85%% cost, and none loses money', () => {
    const brands = [
      'Amazon', 'Apple', 'Google Play', 'Steam', 'Netflix', 'Spotify',
      'PlayStation', 'Xbox', 'Nike', 'Starbucks', 'Target', 'Walmart', 'Visa', 'Mastercard',
    ];
    for (const b of brands) {
      const q = quoteBuyRate(b, 85);
      expect(q.available, `${b} should be quotable at 85% cost`).toBe(true);
      assertNotLossMaking(10_000, q.rate!, 85);
    }
  });

  it('holds for fractional costs with sub-cent precision (rounding must not breach the floor)', () => {
    // Rounding the quote DOWN put it below the floor: cost 90.001 -> floor
    // 95.001 -> a rounded rate of 95.00.
    for (const cost of [90.001, 90.009, 84.999, 1.001, 70.4449]) {
      const q = quoteBuyRate('Amazon', cost);
      if (q.available) {
        expect(q.rate!, `cost ${cost}`).toBeGreaterThanOrEqual(cost + MIN_PROFIT_MARGIN);
        assertNotLossMaking(1_000_000, q.rate!, cost);
      }
    }
  });

  it('holds across a sweep of costs and supported brands', () => {
    for (const brand of ['Amazon', 'Steam', 'Visa', 'Nike']) {
      for (let cost = 1; cost <= 120; cost++) {
        const q = quoteBuyRate(brand, cost);
        if (q.available) {
          expect(q.rate!).toBeGreaterThanOrEqual(cost + MIN_PROFIT_MARGIN);
          assertNotLossMaking(10_000, q.rate!, cost);
        } else {
          expect(q.rate).toBeNull();
        }
      }
    }
  });
});

describe('9. provider acquisition cost comes from the real catalog, never invented', () => {
  it('derives cost from the Fluz catalog discount (cost = 100 - discount)', () => {
    // server/data/fluz-catalog.csv `rate` is the provider DISCOUNT percentage.
    const cost = getProviderCostRate('Xbox');
    expect(cost).not.toBeNull();
    expect(cost!).toBeGreaterThan(0);
    expect(cost!).toBeLessThanOrEqual(100);
  });

  it('returns null for a brand absent from the catalog — no invented default', () => {
    expect(getProviderCostRate('TotallyMadeUpBrand')).toBeNull();
    expect(getProviderCostRate('')).toBeNull();
    expect(getProviderCostRate(undefined as unknown as string)).toBeNull();
  });

  it('fails closed when no provider cost is known', () => {
    const p = calculatePricing('TotallyMadeUpBrand', 10_000);
    expect(p.sellAvailable).toBe(false);
    expect(p.ourSellRate).toBeNull();
    expect(p.unavailableReason).toBe('PROVIDER_COST_UNAVAILABLE');
  });

  it('picks the WORST (highest-cost) variant so a quote is never over-optimistic', () => {
    // Multiple catalog rows can share a brand; using the best discount would
    // quote against a rate we are not guaranteed to receive.
    const cost = getProviderCostRate('Amazon');
    expect(cost).not.toBeNull();
    // Conservative: cost must be at least as high as the cheapest discount row.
    expect(cost!).toBeGreaterThanOrEqual(90);
  });

  it('every catalog-costed brand either fails closed or clears the margin floor', () => {
    for (const b of ['Amazon', 'Apple', 'Xbox', 'Starbucks', 'Walmart', 'Target']) {
      const cost = getProviderCostRate(b);
      const p = calculatePricing(b, 10_000);
      if (p.sellAvailable) {
        expect(cost).not.toBeNull();
        assertNotLossMaking(10_000, p.ourSellRate!, cost!);
      } else {
        expect(p.ourSellRate).toBeNull();
      }
    }
  });

  it('a client-supplied cost cannot be smuggled in through the brand string', () => {
    // The override is a separate server-side parameter; brand text has no path
    // to it. Same brand text must always yield the same catalog-derived cost.
    expect(getProviderCostRate('Xbox')).toBe(getProviderCostRate('  xbox  '));
  });
});

describe('10. cost lookup is keyed to the CANONICAL brand (bypass regression)', () => {
  it('caller text cannot borrow a cheaper brand\'s provider cost', () => {
    // "Applebee" substring-matched Applebee's 10.5% discount (cost 93.5) while
    // the quote and the persisted record resolved canonically to Apple (real
    // cost 97) — yielding a 1.5% margin, under the 5% floor.
    const viaNoise = calculatePricing('Applebee', 10_000);
    const viaCanonical = calculatePricing('Apple', 10_000);

    expect(viaNoise.canonicalBrand).toBe('Apple');
    // Same canonical brand => same cost basis => same availability and rate.
    expect(getProviderCostRate('Applebee')).toBe(getProviderCostRate('Apple'));
    expect(viaNoise.sellAvailable).toBe(viaCanonical.sellAvailable);
    expect(viaNoise.ourSellRate).toBe(viaCanonical.ourSellRate);
  });

  it('never returns an available quote below the floor via brand text', () => {
    for (const noisy of ['Applebee', "Applebee's", 'Apple Store', 'Amazonia']) {
      const p = calculatePricing(noisy, 10_000);
      if (p.sellAvailable) {
        const cost = getProviderCostRate(p.canonicalBrand!);
        expect(cost).not.toBeNull();
        assertNotLossMaking(10_000, p.ourSellRate!, cost!);
      }
    }
  });

  it('matches the catalog EXACTLY, so sibling names do not bleed costs', () => {
    // "Apple" must not absorb "Applebee's" rows, and vice versa.
    const apple = getProviderCostRate('Apple');
    expect(apple).not.toBeNull();
    expect(apple).toBe(97); // Apple's own worst catalog discount is 3%
  });

  it('an alias family costs from its canonical catalog entry', () => {
    // iTunes has no catalog row of its own; it must cost as Apple.
    expect(getProviderCostRate('iTunes')).toBe(getProviderCostRate('Apple'));
  });
});
