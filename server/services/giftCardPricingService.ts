/**
 * Gift Card Pricing Service
 * Fetches market rates and calculates optimal pricing with profit margins
 */

import { getFluzProducts, FluzProduct, isFluzConfigured } from './fluzClient';
import { listOffers, isConfigured as isFluzApiConfigured } from './fluzApi';
import { catalogToGiftCards, getLogoDomain, loadFluzCatalogFromCSV } from './fluzCatalogLoader';
import { logger } from '../middleware/logger';
import { AppError } from '../middleware/errorHandler';

/** Extract native logo URL from product (Fluz API may return logoUrl, logo_url, image_url, faceplateUrl) */
function getNativeLogo(product: FluzProduct): string | undefined {
  return (
    product.logoUrl ||
    product.logo_url ||
    product.image_url ||
    product.faceplateUrl
  );
}

/** Normalize name for offer matching (lowercase, collapse spaces) */
function normalizeNameForMatch(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Find best-matching offer logo for a product name */
function findOfferLogo(productName: string, offerLogos: Map<string, string>): string | undefined {
  const normalized = normalizeNameForMatch(productName);
  const direct = offerLogos.get(normalized);
  if (direct) return direct;
  for (const [offerName, logoUrl] of offerLogos) {
    if (normalized.includes(offerName) || offerName.includes(normalized)) return logoUrl;
  }
  return undefined;
}

/** Fetch Fluz GraphQL offers and build name->logoUrl map (when API configured) */
async function getOfferLogoMap(): Promise<Map<string, string>> {
  try {
    if (!isFluzApiConfigured()) return new Map();
    const offers = await listOffers();
    const map = new Map<string, string>();
    for (const o of offers) {
      if (o.logoUrl) map.set(normalizeNameForMatch(o.name), o.logoUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

interface MarketRate {
    brand: string;
    buyRate: number; // What we pay when users sell to us (%)
    sellRate: number; // What users pay when buying from us (%)
    marketAvgRate: number; // Average market rate
    lastUpdated: Date;
}

interface PricingResult {
    brand: string;
    /** Catalog identity the price was derived from; null when unsupported. */
    canonicalBrand: string | null;
    ourBuyRate: number | null; // Rate we offer when buying from users (null if unsupported)
    ourSellRate: number | null; // Rate we charge when selling to users (null if no viable quote)
    /** False when the BUY path must be refused rather than quoted at a loss. */
    sellAvailable: boolean;
    unavailableReason?: string;
    costCents: number; // Our cost from Fluz
    profitMarginPercent: number;
    marketRate: number | null;
}

// Market rates for popular gift cards (industry average)
const MARKET_RATES: Record<string, { buyRate: number; sellRate: number }> = {
    'Amazon': { buyRate: 80, sellRate: 95 },
    'Apple': { buyRate: 78, sellRate: 92 },
    'iTunes': { buyRate: 78, sellRate: 92 },
    'Google Play': { buyRate: 75, sellRate: 90 },
    'Steam': { buyRate: 73, sellRate: 88 },
    'Netflix': { buyRate: 83, sellRate: 95 },
    'Spotify': { buyRate: 81, sellRate: 93 },
    'PlayStation': { buyRate: 74, sellRate: 89 },
    'Xbox': { buyRate: 74, sellRate: 89 },
    'Nike': { buyRate: 85, sellRate: 97 },
    'Starbucks': { buyRate: 82, sellRate: 94 },
    'Target': { buyRate: 85, sellRate: 96 },
    'Walmart': { buyRate: 84, sellRate: 96 },
    'Visa': { buyRate: 88, sellRate: 98 },
    'Mastercard': { buyRate: 88, sellRate: 98 },
};

// Our profit margins (minimum)
export const MIN_PROFIT_MARGIN = 5; // 5% minimum profit
const DEFAULT_PROFIT_MARGIN = 8; // 8% default profit
const HIGH_VOLUME_PROFIT_MARGIN = 6; // 6% for high-volume cards

/**
 * A gift card cannot be sold to a customer for more than its face value — that
 * is not a real product. If the profitable floor (cost + margin) exceeds this,
 * no viable quote exists and the BUY path must fail closed rather than either
 * selling at a loss or quoting an absurd price.
 */
export const MAX_SELL_RATE_PERCENT = 100;

/**
 * Platform acquisition cost for a brand, as a PERCENT OF FACE VALUE, derived
 * from the real provider catalog (`server/data/fluz-catalog.csv`).
 *
 * That CSV's `rate` column is the Fluz DISCOUNT percentage — what the provider
 * takes off face value — so our cost is `100 - rate`. This is the genuine,
 * server-side provider figure; it is never accepted from a client, and there is
 * deliberately NO invented default. A brand we cannot cost is a brand we cannot
 * price, and the BUY path fails closed for it.
 *
 * Returns null when the brand is absent from the catalog or the discount is
 * malformed.
 */
export function getProviderCostRate(brandName: string): number | null {
    if (typeof brandName !== 'string' || !brandName.trim()) return null;

    // SECURITY: cost MUST be keyed off the canonical catalog brand, never the
    // raw caller string. Substring-matching the caller text let "Applebee" pull
    // Applebee's 10.5% discount (cost 93.5) while the quote and the persisted
    // record resolved canonically to Apple (real cost 97) — a 1.5% margin, below
    // the 5% floor, i.e. a loss-making sale reached through brand text.
    const canonical = resolveCanonicalBrand(brandName);
    if (!canonical) return null;

    let rows;
    try {
        rows = loadFluzCatalogFromCSV();
    } catch {
        return null; // fail closed: no catalog, no cost, no sale
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // EXACT match on the canonical brand. `includes` would let "Apple" absorb
    // "Applebee's" rows and vice versa.
    const needle = canonical.trim().toLowerCase();
    const slugNeedle = needle.replace(/\s+/g, '-');

    const matches = rows.filter((r: any) => {
        const name = String(r?.name ?? '').trim().toLowerCase();
        const slug = String(r?.slug ?? '').trim().toLowerCase();
        return name === needle || slug === slugNeedle;
    });
    if (matches.length === 0) return null;

    // Several denominations/variants can share a brand. Take the WORST (lowest)
    // discount, i.e. the highest cost, so a quote is never based on a better
    // rate than we are guaranteed to get.
    let worstDiscount = Infinity;
    for (const m of matches) {
        const d = Number((m as any).rate);
        if (!Number.isFinite(d) || d < 0 || d > 100) continue; // ignore malformed
        if (d < worstDiscount) worstDiscount = d;
    }
    if (!Number.isFinite(worstDiscount)) return null;

    const cost = 100 - worstDiscount;
    return cost > 0 && cost <= 100 ? cost : null;
}

/**
 * Whether `brandName` resolves to a brand in our own rate table.
 *
 * SECURITY: `brand` is caller-controlled free text. The previous implementation
 * silently fell back to a default `{ buyRate: 75, sellRate: 90 }` row for ANY
 * unrecognised string, which let a caller synthesise pricing for a brand we do
 * not actually price. Unsupported brands are now rejected outright.
 */
export function isSupportedBrand(brandName: string): boolean {
    return resolveBrandKey(brandName) !== null;
}

/**
 * Resolve caller text to exactly one MARKET_RATES key.
 *
 * Returns null when the text matches no brand OR more than one. Substring
 * matching is kept so "Amazon Gift Card" still resolves to "Amazon", but a
 * string naming two brands ("Nike Steam") is AMBIGUOUS and is refused rather
 * than resolved by `Object.keys` iteration order — which let caller-supplied
 * text pick whichever row happened to be cheaper.
 */
const BRAND_ALIASES: Record<string, string> = {
    'iTunes': 'Apple', // same product family, identical rates
};

/** Collapse an alias to its canonical family key. */
function canonicalise(key: string): string {
    return BRAND_ALIASES[key] ?? key;
}

function resolveBrandMatches(brandName: string): string[] {
    if (typeof brandName !== 'string') return [];
    const needle = brandName.trim().toLowerCase();
    if (!needle) return [];
    const matched = Object.keys(MARKET_RATES).filter(key => needle.includes(key.toLowerCase()));
    // Dedupe by family so "Apple iTunes Gift Card" counts as ONE brand.
    return Array.from(new Set(matched.map(canonicalise)));
}

function resolveBrandKey(brandName: string): string | null {
    const matches = resolveBrandMatches(brandName);
    return matches.length === 1 ? matches[0] : null;
}

/**
 * Get market rate for a brand. Returns null for an unsupported brand — there is
 * deliberately no default rate row (see isSupportedBrand).
 */
export function getMarketRate(brandName: string): MarketRate | null {
    const key = resolveBrandKey(brandName);
    if (!key) return null;

    const rates = MARKET_RATES[key];
    return {
        brand: brandName,
        buyRate: rates.buyRate,
        sellRate: rates.sellRate,
        marketAvgRate: (rates.buyRate + rates.sellRate) / 2,
        lastUpdated: new Date(),
    };
}

export interface BuyQuote {
    available: boolean;
    /** Percent of face value to charge the customer, or null when unavailable. */
    rate: number | null;
    /** The catalog brand the quote was priced from, never the raw caller text. */
    canonicalBrand: string | null;
    reason?: string;
}

/**
 * The catalog key a caller's brand text resolves to, or null when unsupported.
 * Substring matching is retained so "Amazon Gift Card" still resolves to
 * "Amazon", but the CANONICAL key is what pricing is derived from — arbitrary
 * caller text never selects or synthesises a rate of its own.
 */
export function resolveCanonicalBrand(brandName: string): string | null {
    return resolveBrandKey(brandName);
}

/**
 * Quote the rate to charge a customer BUYING a gift card from us.
 *
 * INVARIANT (the release blocker this function exists to enforce):
 *
 *     customer charge >= platform acquisition cost + required margin
 *
 * In rate terms, since both are percentages of the same face value:
 *
 *     rate >= fluzCostRate + MIN_PROFIT_MARGIN
 *
 * The previous code used `Math.min(market.sellRate - 2, cost + margin)`, which
 * selected the "competitive" branch whenever market sat below cost — and every
 * MARKET_RATES.sellRate (<= 98) is below the default cost of 100, so it always
 * did. Amazon quoted 93% against a 100% cost: a guaranteed 7% loss per sale.
 *
 * The market rate may now only RAISE the price toward market; it can never pull
 * it below the floor. If the floor cannot be met at or below face value, there
 * is no viable quote and we FAIL CLOSED.
 */
export function quoteBuyRate(brandName: string, fluzCostRate: number): BuyQuote {
    const matches = resolveBrandMatches(brandName);
    if (matches.length > 1) {
        return { available: false, rate: null, canonicalBrand: null, reason: 'AMBIGUOUS_BRAND' };
    }
    const canonicalBrand = matches.length === 1 ? matches[0] : null;
    if (!canonicalBrand) {
        return { available: false, rate: null, canonicalBrand: null, reason: 'UNSUPPORTED_BRAND' };
    }

    // Fail closed on a malformed provider cost rather than computing NaN.
    if (typeof fluzCostRate !== 'number' || !Number.isFinite(fluzCostRate) || fluzCostRate <= 0) {
        return { available: false, rate: null, canonicalBrand, reason: 'INVALID_PROVIDER_COST' };
    }

    // Price from the CANONICAL catalog entry, not the caller's string.
    const market = getMarketRate(canonicalBrand)!;

    const floor = fluzCostRate + MIN_PROFIT_MARGIN;        // hard minimum
    const target = fluzCostRate + DEFAULT_PROFIT_MARGIN;    // intended margin
    const competitive = market.sellRate - 2;               // 2% below market

    // Preserve the original intent — offer the cheaper of "2% below market" and
    // our target margin — but clamp the result UP to the profitable floor. The
    // competitive branch can now only ever make the card cheaper down to the
    // floor, never below it.
    const rate = Math.max(floor, Math.min(competitive, target));

    if (rate > MAX_SELL_RATE_PERCENT) {
        return { available: false, rate: null, canonicalBrand, reason: 'NO_PROFITABLE_QUOTE' };
    }

    // Round UP: rounding down can land a fraction of a percent BELOW the floor
    // (cost 90.001 -> floor 95.001 -> round(95.0005*100)/100 = 95). Re-check the
    // ceiling afterwards, since rounding up can cross it.
    const rounded = Math.ceil(rate * 100) / 100;
    if (rounded > MAX_SELL_RATE_PERCENT) {
        return { available: false, rate: null, canonicalBrand, reason: 'NO_PROFITABLE_QUOTE' };
    }

    return { available: true, rate: rounded, canonicalBrand };
}

/**
 * Calculate optimal pricing with profit
 */
export function calculatePricing(
    brandName: string,
    amountCents: number,
    /**
     * Provider acquisition cost as a percent of face value. Omit to source it
     * from the real provider catalog. There is NO default: an invented 100%
     * was what made every quote loss-making in the first place.
     */
    fluzCostRateOverride?: number
): PricingResult {
    // Canonical-first: the cost, the quote and the persisted record must all
    // describe the SAME brand.
    const canonicalForCost = resolveCanonicalBrand(brandName);
    const fluzCostRate =
        fluzCostRateOverride ?? (canonicalForCost ? getProviderCostRate(canonicalForCost) : null) ?? NaN;
    const market = getMarketRate(brandName);

    // Our cost from Fluz. NaN when no provider cost is known — the quote below
    // then fails closed rather than guessing.
    const costCents = Number.isFinite(fluzCostRate)
        ? Math.round(amountCents * (fluzCostRate / 100))
        : 0;
    const targetProfitMargin = DEFAULT_PROFIT_MARGIN;

    // Sell-to-customer rate is delegated to quoteBuyRate, which enforces the
    // never-below-cost invariant and fails closed when no viable quote exists.
    const quote = Number.isFinite(fluzCostRate)
        ? quoteBuyRate(brandName, fluzCostRate)
        : { available: false, rate: null, canonicalBrand: null, reason: 'PROVIDER_COST_UNAVAILABLE' } as BuyQuote;

    // For buying from users: offer slightly above market buy rate.
    // Unsupported brands have no market row, so we cannot price them at all.
    const ourBuyRate = market && Number.isFinite(fluzCostRate)
        ? Math.max(
            market.buyRate + 1, // Competitive: 1% above market
            fluzCostRate - (targetProfitMargin + 3) // Ensure we can resell with profit
        )
        : null;

    return {
        brand: brandName,
        canonicalBrand: quote.canonicalBrand ?? resolveCanonicalBrand(brandName),
        ourBuyRate: ourBuyRate === null ? null : Math.round(ourBuyRate * 100) / 100,
        ourSellRate: quote.rate,
        sellAvailable: quote.available,
        unavailableReason: quote.available ? undefined : quote.reason,
        costCents,
        profitMarginPercent: targetProfitMargin,
        marketRate: market ? market.marketAvgRate : null,
    };
}

/**
 * Fetch all Fluz products and map to our format with pricing.
 * Uses catalog CSV when Fluz API is not configured or USE_FLUZ_CATALOG=true.
 */
export async function fetchAllGiftCardsWithPricing(): Promise<any[]> {
    if (!isFluzConfigured() || process.env.USE_FLUZ_CATALOG === 'true') {
        return getGiftCardsFromCatalog();
    }
    try {
        const [fluzProducts, offerLogos] = await Promise.all([
            getFluzProducts({ currency: 'USD' }),
            getOfferLogoMap(),
        ]);

        const mappedProducts = fluzProducts.items.map((product: FluzProduct) => {
            const pricing = calculatePricing(product.name, 10000); // Sample $100 for calculation
            const slug = (product.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const domain = getLogoDomain(slug, product.name || '');

            // Prefer: 1) product native logo, 2) Fluz offer logo (by name match), 3) Clearbit, 4) Google favicon
            const nativeLogo = getNativeLogo(product) || findOfferLogo(product.name || '', offerLogos);
            const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : undefined;
            const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined;
            const primaryLogo = nativeLogo || clearbitUrl;
            const fallbackLogo = faviconUrl || clearbitUrl;

            return {
                id: product.id,
                name: product.name,
                description: product.description,
                icon: 'ri-gift-line',
                color: '#D4AF37',
                bgColor: 'rgba(212, 175, 55, 0.1)',
                logoUrl: primaryLogo,
                logoUrlFallback: primaryLogo !== fallbackLogo ? fallbackLogo : undefined,
                denominations: product.face_values || [],

                // Pricing info
                buyRate: pricing.ourBuyRate,
                sellRate: pricing.ourSellRate,
                rate: pricing.ourSellRate,
                // Explicit so a client can disable purchase rather than render a
                // null rate as 0. A card is unavailable when no price exists
                // that covers our acquisition cost plus the required margin.
                available: pricing.sellAvailable,
                unavailableReason: pricing.unavailableReason,
                marketRate: pricing.marketRate,
                profitMargin: pricing.profitMarginPercent,

                // Status
                status: product.status || 'available',
                category: determineCategory(product.name, pricing.profitMarginPercent),

                // Metadata
                supplier: 'fluz',
                lastUpdated: new Date().toISOString(),
            };
        });

        logger.info(`Fetched ${mappedProducts.length} gift cards from Fluz with pricing`);
        return mappedProducts;

    } catch (error: any) {
        logger.error('Failed to fetch Fluz gift cards', { error: error?.message });
        return getGiftCardsFromCatalog();
    }
}

/**
 * Get gift cards from Fluz catalog CSV (fallback when Fluz API fails)
 */
export function getGiftCardsFromCatalog(): any[] {
    const cards = catalogToGiftCards();
    if (cards.length > 0) {
        logger.info(`Loaded ${cards.length} gift cards from Fluz catalog CSV`);
        return cards;
    }
    return getFallbackGiftCards();
}

/**
 * Determine category based on profitability
 */
function determineCategory(brandName: string, profitMargin: number): string {
    const topBrands = ['Amazon', 'Apple', 'Netflix', 'Starbucks'];

    if (topBrands.some(brand => brandName.includes(brand))) {
        return 'top';
    }

    if (profitMargin >= 8) {
        return 'high-rate';
    }

    return 'regular';
}

/**
 * Fallback gift cards if Fluz fails
 */
function getFallbackGiftCards() {
    const cards = [
        { id: 'amazon', name: 'Amazon', icon: 'ri-amazon-fill', color: '#FF9900', bgColor: 'rgba(255, 153, 0, 0.15)', logoUrl: 'https://logo.clearbit.com/amazon.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=128', denominations: [25, 50, 100, 200, 500], buyRate: 81, sellRate: 93, rate: 93, marketRate: 87.5, profitMargin: 8, category: 'top' as const },
        { id: 'apple', name: 'Apple/iTunes', icon: 'ri-apple-fill', color: '#A2AAAD', bgColor: 'rgba(162, 170, 173, 0.15)', logoUrl: 'https://logo.clearbit.com/apple.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=apple.com&sz=128', denominations: [25, 50, 100, 200], buyRate: 79, sellRate: 90, rate: 90, marketRate: 85, profitMargin: 8, category: 'top' as const },
        { id: 'google-play', name: 'Google Play', icon: 'ri-google-play-fill', color: '#34A853', bgColor: 'rgba(52, 168, 83, 0.15)', logoUrl: 'https://logo.clearbit.com/play.google.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=play.google.com&sz=128', denominations: [15, 25, 50, 100], buyRate: 76, sellRate: 88, rate: 88, marketRate: 82.5, profitMargin: 8, category: 'regular' as const },
        { id: 'steam', name: 'Steam', icon: 'ri-steam-fill', color: '#1B2838', bgColor: 'rgba(27, 40, 56, 0.25)', logoUrl: 'https://logo.clearbit.com/store.steampowered.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=128', denominations: [20, 50, 100], buyRate: 74, sellRate: 86, rate: 86, marketRate: 80.5, profitMargin: 8, category: 'regular' as const },
        { id: 'netflix', name: 'Netflix', icon: 'ri-netflix-fill', color: '#E50914', bgColor: 'rgba(229, 9, 20, 0.15)', logoUrl: 'https://logo.clearbit.com/netflix.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=128', denominations: [25, 50, 100], buyRate: 84, sellRate: 93, rate: 93, marketRate: 90, profitMargin: 8, category: 'high-rate' as const },
        { id: 'spotify', name: 'Spotify', icon: 'ri-spotify-fill', color: '#1DB954', bgColor: 'rgba(29, 185, 84, 0.15)', logoUrl: 'https://logo.clearbit.com/spotify.com', logoUrlFallback: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=128', denominations: [10, 30, 60], buyRate: 82, sellRate: 91, rate: 91, marketRate: 87, profitMargin: 8, category: 'high-rate' as const },
    ];
    return cards;
}

/**
 * Calculate profit for a transaction
 */
export function calculateTransactionProfit(
    type: 'buy' | 'sell',
    brandName: string,
    amountCents: number,
    userRate: number
): { costCents: number; profitCents: number; profitPercent: number } {
    const pricing = calculatePricing(brandName, amountCents);

    if (type === 'buy') {
        // User is buying from us
        const revenue = Math.round(amountCents * (userRate / 100));
        const cost = pricing.costCents;
        const profit = revenue - cost;

        return {
            costCents: cost,
            profitCents: profit,
            profitPercent: (profit / cost) * 100,
        };
    } else {
        // User is selling to us (we're buying)
        const cost = Math.round(amountCents * (userRate / 100)); // What we pay user

        // Resale value is UNKNOWN when no sell quote exists. Reporting 0/0%
        // fabricated a break-even row over what is really an unpriceable buy, so
        // the caller must refuse the trade instead (see giftCards.ts sell guard).
        if (pricing.ourSellRate === null) {
            throw new AppError(
                'This gift card is not available for sale right now.',
                503,
                'PRICING_UNAVAILABLE',
            );
        }

        const potentialRevenue = Math.round(amountCents * (pricing.ourSellRate / 100)); // What we can sell for
        const profit = potentialRevenue - cost;

        return {
            costCents: cost,
            profitCents: profit,
            profitPercent: cost === 0 ? 0 : (profit / cost) * 100,
        };
    }
}
