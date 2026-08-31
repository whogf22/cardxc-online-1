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
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/**
 * Every non-test TypeScript source file under `server/`, as repo-relative
 * POSIX-ish paths. Used by the discovery sweeps below so a debit introduced in
 * a file nobody remembered to add to a list is still checked.
 */
const serverSources = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        walk(abs);
        continue;
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;
      out.push(relative(ROOT, abs).split(sep).join('/'));
    }
  };
  walk(join(ROOT, 'server'));
  return out.sort();
};

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
  // Background money movement counts too: recurring transfers AND the round-up
  // savings job both debit user wallets without any request in flight.
  'server/services/backgroundJobs.ts',
];

const USDT_DEBIT_FILES = [
  'server/routes/giftCards.ts',
  // `server/routes/user.ts` used to debit `usdt_balance_cents` inline. R3-3
  // routed POST /api/user/withdraw through processWithdrawal(), so the debit now
  // lives in withdrawalService.ts (asserted below) and the route holds no money
  // movement at all — pinned by the delegation test in this file. A debit
  // reappearing there is caught by the discovery sweep, not by this list.
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

  // The list above pins the paths that must KEEP a guarded debit. This sweep
  // needs no list: it discovers every USDT debit under server/ so one added to a
  // file (or moved to a new one) cannot escape the guard requirement — which is
  // how the invariant would otherwise rot when a route is refactored.
  it('no USDT debit anywhere under server/ is unguarded', () => {
    let found = 0;
    for (const file of serverSources()) {
      for (const stmt of read(file).match(USDT_DEBIT_RE) ?? []) {
        found += 1;
        const normalized = stmt.replace(/\s+/g, ' ');
        expect(
          /usdt_balance_cents >= \$1/.test(normalized),
          `Unguarded USDT debit in ${file}: ${normalized}`,
        ).toBe(true);
      }
    }
    // A regex that silently stops matching would make this suite vacuously
    // green, so assert the sweep actually saw the known debit sites.
    expect(found).toBeGreaterThanOrEqual(4);
  });

  it('POST /api/user/withdraw moves no money in the route (R3-3 delegation)', () => {
    const src = read('server/routes/user.ts');
    // No wallet write of any kind: the route must not debit, credit or reserve.
    expect(src).not.toMatch(/UPDATE\s+wallets/i);
    // ...and no withdrawal row of its own, which is what let the route file a
    // USDT-funded withdrawal with the 'fiat'/'pending' column defaults.
    expect(src).not.toMatch(/INSERT\s+INTO\s+withdrawal_requests/i);
    // It delegates to the one canonical state machine instead.
    expect(src).toContain('processWithdrawal');
  });
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

describe('FIN-3: documented exceptions (reserve semantics must NOT be applied blindly)', () => {
  it('admin withdrawal approval debits the RESERVED funds it releases (no reserve subtraction)', () => {
    // This is the one correct `balance_cents >= $1` guard on a wallet: the
    // approval spends the very funds its own reserve is holding and releases
    // that reserve in the same statement. Subtracting reserved_cents here would
    // make a fully-reserved (and therefore legitimately payable) withdrawal
    // impossible to settle. It must still check rowCount (FIN-4).
    //
    // NEW-4 made the reserve release NULL-safe (`COALESCE(reserved_cents, 0)`)
    // and added a `COALESCE(reserved_cents, 0) >= $1` floor so the release cannot
    // drive the reserve negative. The invariant this test exists to protect is
    // unchanged and is re-asserted explicitly below: this path must NOT use the
    // available-balance form.
    const src = read('server/routes/admin.ts').replace(/\s+/g, ' ');
    expect(src).toMatch(/reserved_cents = (COALESCE\(reserved_cents, 0\)|reserved_cents) - \$1/);
    expect(src).toContain('AND balance_cents >= $1');
    expect(src).toMatch(/debit\.rowCount !== 1/);
    // The withdrawal-approval debit itself must not subtract the reserve from
    // the balance it checks — that is the documented exception. Assert the exact
    // predicate pair instead, which proves the availability form is absent.
    expect(src).toContain(
      'WHERE user_id = $2 AND currency = $3 AND balance_cents >= $1 AND COALESCE(reserved_cents, 0) >= $1',
    );
  });

  it('savings_vaults uses its own balance (no reserve concept on that table)', () => {
    const src = read('server/routes/savings.ts').replace(/\s+/g, ' ');
    expect(src).toContain('UPDATE savings_vaults SET balance_cents = balance_cents - $1');
    // The vault has no reserved_cents column, so the floor is its own balance.
    // The predicate additionally scopes by user_id (ownership enforced in SQL,
    // not only by the JS pre-read) — a LOW hardening applied after this test was
    // written. The invariant asserted here is unchanged: no reserve subtraction.
    expect(src).toContain('WHERE id = $2 AND user_id = $3 AND balance_cents >= $1');
    expect(src).not.toContain('balance_cents - COALESCE(reserved_cents, 0) >= $1 RETURNING currency');
  });
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
