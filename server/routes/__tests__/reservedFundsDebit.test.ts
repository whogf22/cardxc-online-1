/**
 * @vitest-environment node
 *
 * FIN-3 — reserved-funds double-spend.
 *
 * A pending bank withdrawal RESERVES funds (`reserved_cents += amount`) without
 * lowering `balance_cents`. Any debit path that only checks `balance_cents >= x`
 * therefore lets a user spend the very money a pending withdrawal is about to
 * pay out — extracting the same balance twice.
 *
 * Invariant pinned here: EVERY wallet debit must be guarded against AVAILABLE
 * funds, i.e. `balance_cents - COALESCE(reserved_cents, 0) >= amount`, and must
 * abort when the guarded UPDATE affects 0 rows.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Every fiat (`balance_cents`) debit statement in the codebase. */
const FIAT_DEBIT_RE = /UPDATE wallets\s+SET balance_cents = balance_cents - \$1[\s\S]{0,400}?(?=`)/g;
/** Every USDT debit statement. */
const USDT_DEBIT_RE = /UPDATE wallets\s+SET usdt_balance_cents = usdt_balance_cents - \$1[\s\S]{0,400}?(?=`)/g;

const FIAT_DEBIT_FILES = [
  'server/routes/savings.ts',
  'server/routes/payments.ts',
  'server/routes/cards.ts',
  'server/routes/giftCards.ts',
  'server/routes/transactions.ts',
  'server/services/swapService.ts',
  'server/services/withdrawalService.ts',
];

const USDT_DEBIT_FILES = [
  'server/routes/giftCards.ts',
  'server/routes/user.ts',
  'server/services/swapService.ts',
  'server/services/withdrawalService.ts',
];

describe('FIN-3: every fiat debit is guarded against AVAILABLE balance', () => {
  for (const file of FIAT_DEBIT_FILES) {
    it(`${file} debits only when balance - reserved >= amount`, () => {
      const src = read(file);
      const debits = src.match(FIAT_DEBIT_RE) ?? [];
      expect(debits.length).toBeGreaterThan(0);

      for (const stmt of debits) {
        const normalized = stmt.replace(/\s+/g, ' ');
        // The reserve term must be part of the guard — `balance_cents >= $1`
        // alone is exactly the FIN-3 bug.
        expect(
          /balance_cents - (COALESCE\(reserved_cents, 0\)|reserved_cents) >= \$1/.test(normalized),
          `Unguarded/reserve-blind fiat debit in ${file}: ${normalized}`,
        ).toBe(true);
      }
    });
  }

  it('no WALLET fiat debit relies on a bare `balance_cents >= $1` guard', () => {
    // Scoped to `UPDATE wallets`: savings_vaults has its own balance_cents with
    // no reserve concept, so `balance_cents >= $1` is the correct guard there.
    for (const file of [...FIAT_DEBIT_FILES, 'server/services/backgroundJobs.ts']) {
      const normalized = read(file).replace(/\s+/g, ' ');
      const bare = normalized.match(/UPDATE wallets SET balance_cents = balance_cents - \$1[^`]*?AND balance_cents >= \$1/g) ?? [];
      expect(bare, `Reserve-blind guard still present in ${file}`).toHaveLength(0);
    }
  });
});

describe('FIN-3: every USDT debit is guarded', () => {
  for (const file of USDT_DEBIT_FILES) {
    it(`${file} debits only when usdt_balance_cents >= amount`, () => {
      const src = read(file);
      const debits = src.match(USDT_DEBIT_RE) ?? [];
      expect(debits.length).toBeGreaterThan(0);

      for (const stmt of debits) {
        const normalized = stmt.replace(/\s+/g, ' ');
        expect(
          /usdt_balance_cents >= \$1/.test(normalized),
          `Unguarded USDT debit in ${file}: ${normalized}`,
        ).toBe(true);
      }
    });
  }
});

describe('FIN-3: guarded debits abort when they affect no row', () => {
  const MUST_CHECK_ROWCOUNT = [
    'server/routes/savings.ts',
    'server/routes/payments.ts',
    'server/routes/cards.ts',
    'server/routes/giftCards.ts',
    'server/services/swapService.ts',
    'server/services/withdrawalService.ts',
    'server/services/backgroundJobs.ts',
  ];

  for (const file of MUST_CHECK_ROWCOUNT) {
    it(`${file} inspects rowCount after a guarded debit`, () => {
      const src = read(file);
      expect(/rowCount === 0|rowCount !== 1/.test(src), `No rowCount guard in ${file}`).toBe(true);
    });
  }
});

describe('FIN-3: reserve-aware availability in pre-checks', () => {
  it('gift-card fiat pre-check reads available (balance - reserved), not raw balance', () => {
    const src = read('server/routes/giftCards.ts').replace(/\s+/g, ' ');
    expect(src).toContain('balance_cents - COALESCE(reserved_cents, 0) AS available_cents');
  });

  it('swap pre-check computes availability with the reserve subtracted for fiat', () => {
    const src = read('server/services/swapService.ts').replace(/\s+/g, ' ');
    expect(src).toContain("balance_cents - COALESCE(reserved_cents, 0)");
  });

  it('recurring transfers (background job) select available funds', () => {
    const src = read('server/services/backgroundJobs.ts').replace(/\s+/g, ' ');
    expect(src).toContain('balance_cents - COALESCE(reserved_cents, 0) AS available_cents');
  });
});
