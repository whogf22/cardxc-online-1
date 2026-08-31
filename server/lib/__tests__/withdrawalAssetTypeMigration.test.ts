/**
 * @vitest-environment node
 *
 * PHASE 5 — migration coverage for the NEW-1 asset_type column.
 *
 * The back-fill classifies only `withdrawal_type = 'crypto'` as USDT-funded. But
 * a BANK withdrawal could also be USDT-funded before the column existed: the
 * pre-change bank path with `walletType: 'usdt'` debited `usdt_balance_cents`
 * and inserted `withdrawal_type='bank', status='pending'` (verified against
 * baseline baf0dd5). Those rows inherit the 'fiat' default and become
 * unresolvable — or, if the user holds another pending fiat withdrawal whose
 * reserve covers the amount, `/approve` could settle this row against THAT
 * reserve.
 *
 * The funding wallet was never persisted, so no migration can classify them from
 * the schema alone. The remediation therefore FLAGS them for human triage and
 * changes no status and no balance.
 *
 * These tests assert the migration's SQL properties. They cannot execute against
 * Postgres here (the sandbox forbids listen(), so no local database is
 * reachable), which is stated plainly rather than implied — the assertions are
 * about statement shape and ordering, which is what determines whether the
 * migration is safe to run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const src = readFileSync(join(process.cwd(), 'server/db/init.ts'), 'utf8');
const flat = src.replace(/\s+/g, ' ');

/** Character offset of a statement, for ordering assertions. */
const at = (needle: string) => flat.indexOf(needle);

describe('asset_type migration is ordered and non-destructive', () => {
  it('ADDs the column BEFORE adding its CHECK constraint', () => {
    const addColumn = at('ADD COLUMN IF NOT EXISTS asset_type');
    const addCheck = at('withdrawal_requests_asset_type_check CHECK (asset_type');
    expect(addColumn).toBeGreaterThan(-1);
    expect(addCheck).toBeGreaterThan(-1);
    expect(addColumn).toBeLessThan(addCheck);
  });

  it('gives the column a default so the CHECK cannot fail on pre-existing rows', () => {
    expect(flat).toContain("ADD COLUMN IF NOT EXISTS asset_type VARCHAR(10) DEFAULT 'fiat'");
  });

  it('drops the old constraint before adding it, so a re-run is idempotent', () => {
    expect(flat).toContain('DROP CONSTRAINT IF EXISTS withdrawal_requests_asset_type_check');
    expect(flat).toContain('DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check');
  });

  it('widens the status CHECK to a strict SUPERSET of the previous list', () => {
    const previous = ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'];
    const m = /withdrawal_requests_status_check CHECK \(status IN \(([^)]*)\)\)/.exec(flat);
    expect(m).not.toBeNull();
    const now = m![1].split(',').map(s => s.trim().replace(/'/g, ''));
    for (const v of previous) expect(now).toContain(v);
    // The one genuinely new state.
    expect(now).toContain('held');
  });

  it('the crypto back-fill is guarded so re-running writes nothing', () => {
    expect(flat).toContain("SET asset_type = 'usdt' WHERE withdrawal_type = 'crypto' AND asset_type IS DISTINCT FROM 'usdt'");
  });

  it('the status CHECK covers every status value the application writes', () => {
    // Collect status literals ONLY from statements that target
    // withdrawal_requests. A file-wide scan would also pick up unrelated tables
    // (users.account_status = 'active', transactions.status = 'SUCCESS', ...).
    const written = new Set<string>();
    for (const file of [
      'server/services/withdrawalService.ts',
      'server/routes/admin.ts',
      'server/routes/user.ts',
    ]) {
      const text = readFileSync(join(process.cwd(), file), 'utf8').replace(/\s+/g, ' ');
      let i = text.indexOf('withdrawal_requests');
      while (i !== -1) {
        // A statement lives inside a template literal; stop at its closing tick.
        const end = text.indexOf('`', i);
        const stmt = text.slice(i, end === -1 ? i + 400 : end);
        for (const mm of stmt.matchAll(/status\s*=\s*'([a-z_]+)'/g)) written.add(mm[1]);
        for (const mm of stmt.matchAll(/'(pending|held|processing|approved|rejected|completed|failed)'/g)) written.add(mm[1]);
        i = text.indexOf('withdrawal_requests', i + 1);
      }
    }
    expect(written.size).toBeGreaterThan(0);

    const m = /withdrawal_requests_status_check CHECK \(status IN \(([^)]*)\)\)/.exec(flat);
    const allowed = m![1].split(',').map(s => s.trim().replace(/'/g, ''));
    for (const w of written) {
      expect(allowed, `status '${w}' is written to withdrawal_requests but not permitted by the CHECK`).toContain(w);
    }
  });
});

describe('legacy USDT-funded BANK rows are flagged, not guessed', () => {
  it('flags at-risk legacy rows in admin_notes', () => {
    expect(flat).toContain('LEGACY_ASSET_TYPE_UNVERIFIED');
  });

  it('the flag targets only unresolved fiat-defaulted BANK rows', () => {
    const m = /LEGACY_ASSET_TYPE_UNVERIFIED[\s\S]*?WHERE withdrawal_type = 'bank' AND status = 'pending' AND asset_type = 'fiat'/.exec(flat);
    expect(m).not.toBeNull();
  });

  it('changes NO status and NO balance — it only annotates', () => {
    // Isolate exactly the flag statement: from its UPDATE to the closing tick of
    // its own template literal. A greedy regex would run into later statements.
    const start = flat.indexOf('UPDATE withdrawal_requests SET admin_notes');
    expect(start).toBeGreaterThan(-1);
    const end = flat.indexOf('`', start);
    const text = flat.slice(start, end === -1 ? undefined : end);

    expect(text).toContain('LEGACY_ASSET_TYPE_UNVERIFIED');
    // The SET clause touches admin_notes and nothing else.
    const setClause = text.slice(0, text.indexOf(' WHERE '));
    expect(setClause).not.toMatch(/status\s*=/);
    expect(setClause).not.toContain('balance_cents');
    expect(setClause).not.toContain('reserved_cents');
    expect(setClause).not.toContain('usdt_balance_cents');
    expect(setClause).not.toContain('asset_type =');
  });

  it('is idempotent — a second run cannot append the flag twice', () => {
    expect(flat).toContain("admin_notes NOT LIKE '%LEGACY_ASSET_TYPE_UNVERIFIED%'");
  });

  it('preserves any existing admin_notes rather than overwriting them', () => {
    expect(flat).toContain("COALESCE(admin_notes || ' | ', '')");
  });

  it('RED — flagging is NOT gated on a `created_at` timing boundary', () => {
    // The original heuristic flagged rows with
    //   created_at < (SELECT MIN(created_at) FROM withdrawal_requests WHERE asset_type = 'usdt')
    // That is a correctness bug, not merely a heuristic limitation. A legacy
    // USDT-funded BANK withdrawal created AFTER a genuine USDT row (T1 > T0) has
    // an unflagged at-risk row: the timing boundary skips it, yet it is exactly
    // the kind of ambiguous row that must be surfaced to an operator. Flagging
    // must therefore depend on the one-time marker alone — never on the relative
    // age of some other row.
    const start = flat.indexOf('UPDATE withdrawal_requests SET admin_notes');
    expect(start).toBeGreaterThan(-1);
    const text = flat.slice(start, flat.indexOf('`', start));
    expect(text).not.toMatch(/created_at\s*</);
  });

  it('flagging is guarded by a one-time migration marker, not by row age', () => {
    // The timing heuristic was dropped in favour of a persistent marker so the
    // annotation runs exactly once on the historical population, and post-
    // migration rows (created with the column already present) are never wrongly
    // flagged on a later startup. The marker must exist and gate the UPDATE.
    expect(flat).toContain('CREATE TABLE IF NOT EXISTS migrations');
    expect(flat).toContain("ON CONFLICT (name) DO NOTHING");
  });
});
