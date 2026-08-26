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
import {
  PG_UNIQUE_VIOLATION,
  TRANSACTION_IDEMPOTENCY_CONSTRAINTS,
  isUniqueViolationOn,
  isDepositIdempotencyViolation,
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
