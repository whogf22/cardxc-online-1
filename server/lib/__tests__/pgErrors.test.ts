/**
 * @vitest-environment node
 *
 * NEW-9 (MEDIUM) — the 23505 handling in the deposit fulfillment paths was
 * over-broad.
 *
 * `depositOtp.ts` and both `cardCheckout.ts` webhook paths matched
 * `err.code === '23505' || /duplicate key/i.test(err.message)` and reported
 * idempotent success. `err.constraint` was available and unused, so a violation
 * of ANY unique constraint was reported as "already fulfilled".
 *
 * In the Stripe webhook that is the sharpest edge: replying `{ received: true }`
 * permanently ACKs the event, so Stripe never retries. A paid deposit whose
 * transaction actually rolled back on an unrelated integrity failure would be
 * silently lost.
 *
 * INVARIANTS PINNED HERE:
 *  - only the transactions-idempotency constraints count as idempotent success
 *  - an unrelated unique violation propagates (rolls back and surfaces)
 *  - a non-23505 error is never mistaken for a duplicate
 *  - the message-only fallback (drivers that omit `constraint`) is still narrow
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PG_UNIQUE_VIOLATION,
  TRANSACTION_IDEMPOTENCY_CONSTRAINTS,
  WITHDRAWAL_IDEMPOTENCY_CONSTRAINTS,
  isUniqueViolationOn,
  isDepositIdempotencyViolation,
  isTransactionIdempotencyViolation,
  isWithdrawalIdempotencyViolation,
} from '../pgErrors';

const pgErr = (over: Record<string, unknown> = {}) => ({
  code: PG_UNIQUE_VIOLATION,
  constraint: 'idx_transactions_idempotency_unique',
  message: 'duplicate key value violates unique constraint "idx_transactions_idempotency_unique"',
  ...over,
});

describe('isDepositIdempotencyViolation — only the intended constraints', () => {
  it('accepts the explicit partial index name', () => {
    expect(isDepositIdempotencyViolation(pgErr())).toBe(true);
  });

  it('accepts the inline CREATE TABLE UNIQUE constraint name', () => {
    // The column is declared UNIQUE inline as well, which Postgres names
    // <table>_<column>_key. Either may surface.
    expect(isDepositIdempotencyViolation(pgErr({
      constraint: 'transactions_idempotency_key_key',
      message: 'duplicate key value violates unique constraint "transactions_idempotency_key_key"',
    }))).toBe(true);
  });

  it('REJECTS an unrelated unique violation (wallets)', () => {
    // wallets has UNIQUE(user_id, currency). A violation here is a real
    // integrity failure, not a concurrent fulfillment.
    expect(isDepositIdempotencyViolation(pgErr({
      constraint: 'wallets_user_id_currency_key',
      message: 'duplicate key value violates unique constraint "wallets_user_id_currency_key"',
    }))).toBe(false);
  });

  it('REJECTS an unrelated unique violation (crypto ledger)', () => {
    expect(isDepositIdempotencyViolation(pgErr({
      constraint: 'crypto_ledger_entries_source_order_id_user_id_key',
      message: 'duplicate key value violates unique constraint "crypto_ledger_entries_source_order_id_user_id_key"',
    }))).toBe(false);
  });

  it('REJECTS an unrelated unique violation (card_orders provider_payment_id)', () => {
    expect(isDepositIdempotencyViolation(pgErr({
      constraint: 'card_orders_provider_payment_id_key',
      message: 'duplicate key value violates unique constraint "card_orders_provider_payment_id_key"',
    }))).toBe(false);
  });

  it('REJECTS a non-23505 error even when the message mentions a duplicate', () => {
    expect(isDepositIdempotencyViolation(pgErr({ code: '23503' }))).toBe(false); // FK violation
    expect(isDepositIdempotencyViolation(pgErr({ code: '23514' }))).toBe(false); // CHECK violation
    expect(isDepositIdempotencyViolation(pgErr({ code: undefined }))).toBe(false);
    expect(isDepositIdempotencyViolation(new Error('duplicate key value violates unique constraint'))).toBe(false);
  });

  it('is safe on null/undefined/non-object input', () => {
    expect(isDepositIdempotencyViolation(null)).toBe(false);
    expect(isDepositIdempotencyViolation(undefined)).toBe(false);
    expect(isDepositIdempotencyViolation('23505')).toBe(false);
    expect(isDepositIdempotencyViolation(23505)).toBe(false);
  });

  it('falls back to the message ONLY when no constraint field is present, and stays narrow', () => {
    // Driver omitted `constraint` but named ours in the message: accept.
    expect(isDepositIdempotencyViolation({
      code: PG_UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint "idx_transactions_idempotency_unique"',
    })).toBe(true);

    // Driver omitted `constraint` and the message names something else: reject.
    expect(isDepositIdempotencyViolation({
      code: PG_UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint "wallets_user_id_currency_key"',
    })).toBe(false);

    // A bare "duplicate key" message with no identifiable constraint: reject.
    // This is exactly the pattern the old `/duplicate key/i` check accepted.
    expect(isDepositIdempotencyViolation({
      code: PG_UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint',
    })).toBe(false);
  });

  it('an explicit constraint field is NOT overridden by the message', () => {
    // Constraint says unrelated, message says ours -> the constraint wins.
    expect(isDepositIdempotencyViolation({
      code: PG_UNIQUE_VIOLATION,
      constraint: 'wallets_user_id_currency_key',
      message: 'duplicate key value violates unique constraint "idx_transactions_idempotency_unique"',
    })).toBe(false);
  });
});

describe('isUniqueViolationOn — the generic form', () => {
  it('matches any constraint in the supplied list', () => {
    expect(isUniqueViolationOn(pgErr({ constraint: 'a' }), ['a', 'b'])).toBe(true);
    expect(isUniqueViolationOn(pgErr({ constraint: 'b' }), ['a', 'b'])).toBe(true);
    expect(isUniqueViolationOn(pgErr({ constraint: 'c' }), ['a', 'b'])).toBe(false);
  });

  it('an empty allow-list never matches', () => {
    expect(isUniqueViolationOn(pgErr(), [])).toBe(false);
  });

  it('exposes the deposit constraint list used by the fulfillment paths', () => {
    expect(TRANSACTION_IDEMPOTENCY_CONSTRAINTS).toContain('idx_transactions_idempotency_unique');
    expect(TRANSACTION_IDEMPOTENCY_CONSTRAINTS).toContain('transactions_idempotency_key_key');
  });
});

/**
 * R3-4 — the withdrawal claim is a DIFFERENT table with a DIFFERENT constraint set.
 *
 * The withdrawal paths must not accept a `transactions` violation and the platform
 * transfer must not accept a `withdrawal_requests` one: they are separate claims, and
 * a violation of the other table's constraint means something unrelated failed.
 */
describe('isWithdrawalIdempotencyViolation — scoped to withdrawal_requests', () => {
  const wdErr = (constraint: string) => ({
    code: PG_UNIQUE_VIOLATION,
    constraint,
    message: `duplicate key value violates unique constraint "${constraint}"`,
  });

  it('accepts the withdrawal_requests partial unique index', () => {
    expect(isWithdrawalIdempotencyViolation(wdErr('idx_withdrawal_requests_idempotency_unique'))).toBe(true);
  });

  it('REJECTS both transactions idempotency constraints', () => {
    // Wrong table: a transactions collision cannot mean "this withdrawal was
    // already submitted".
    expect(isWithdrawalIdempotencyViolation(wdErr('idx_transactions_idempotency_unique'))).toBe(false);
    expect(isWithdrawalIdempotencyViolation(wdErr('transactions_idempotency_key_key'))).toBe(false);
  });

  it('REJECTS an unrelated unique violation', () => {
    expect(isWithdrawalIdempotencyViolation(wdErr('users_email_key'))).toBe(false);
  });

  it('REJECTS a bare duplicate-key with no identifiable constraint', () => {
    expect(isWithdrawalIdempotencyViolation({
      code: PG_UNIQUE_VIOLATION,
      message: 'duplicate key value violates unique constraint',
    })).toBe(false);
  });

  it('the transaction form REJECTS the withdrawal constraint (the mirror case)', () => {
    expect(isTransactionIdempotencyViolation(wdErr('idx_withdrawal_requests_idempotency_unique'))).toBe(false);
    expect(isTransactionIdempotencyViolation(wdErr('transactions_idempotency_key_key'))).toBe(true);
    expect(isTransactionIdempotencyViolation(wdErr('idx_transactions_idempotency_unique'))).toBe(true);
  });

  it('the two lists are disjoint', () => {
    for (const c of WITHDRAWAL_IDEMPOTENCY_CONSTRAINTS) {
      expect(TRANSACTION_IDEMPOTENCY_CONSTRAINTS as readonly string[]).not.toContain(c);
    }
  });
});

/**
 * The constraint lists are hard-coded strings, so they can silently drift from the
 * schema. These read `server/db/init.ts` and pin the facts each list depends on. If
 * a future migration adds or removes a unique constraint on either idempotency
 * column, the corresponding assertion fails and the list has to be updated with it.
 */
describe('R3-4: the constraint lists match the schema in db/init.ts', () => {
  const schema = readFileSync(
    join(__dirname, '..', '..', 'db', 'init.ts'),
    'utf8',
  ).replace(/\s+/g, ' ');

  it('transactions.idempotency_key is declared UNIQUE inline (hence the _key name)', () => {
    // This inline UNIQUE is why `transactions_idempotency_key_key` must be in the
    // accepted list: Postgres may report it instead of the partial index.
    expect(schema).toContain('idempotency_key VARCHAR(255) UNIQUE');
  });

  it('the transactions partial unique index exists under the expected name', () => {
    expect(schema).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_unique ON transactions(idempotency_key)',
    );
  });

  it('the withdrawal_requests partial unique index exists under the expected name', () => {
    expect(schema).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_requests_idempotency_unique ON withdrawal_requests(user_id, idempotency_key)',
    );
  });

  it('withdrawal_requests.idempotency_key has NO inline UNIQUE', () => {
    // If one were added, Postgres could report `withdrawal_requests_idempotency_key_key`
    // and WITHDRAWAL_IDEMPOTENCY_CONSTRAINTS would have to grow to match — the exact
    // omission that caused R3-4 on the transactions side.
    expect(schema).not.toContain('withdrawal_requests_idempotency_key_key');
    // The column and the ALTER TABLE that backfills it are both plain VARCHARs.
    expect(schema).toContain(
      'ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255)`',
    );
  });
});
