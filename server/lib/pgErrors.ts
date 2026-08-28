/**
 * Postgres error helpers for money-path idempotency handling.
 *
 * NEW-9: card-deposit fulfillment paths treated ANY unique violation
 * (`err.code === '23505'`, or a message merely containing "duplicate key") as
 * "a concurrent fulfillment already committed" and returned idempotent success.
 * `err.constraint` was available and unused.
 *
 * That is wrong in two directions:
 *  - a violation of an UNRELATED unique constraint is a real integrity failure,
 *    and reporting success hides it;
 *  - in the Stripe webhook it is worse than hiding: replying 200 permanently
 *    acknowledges the event, so Stripe never retries. A paid deposit whose
 *    transaction actually rolled back would be silently lost.
 *
 * These helpers narrow the check to the constraints that genuinely represent the
 * idempotency claim.
 */

/** Postgres SQLSTATE for a unique-constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * Unique constraints on `transactions.idempotency_key`.
 *
 * There are two, because the column is declared UNIQUE inline in CREATE TABLE
 * (server/db/init.ts) — which Postgres names `transactions_idempotency_key_key` —
 * AND covered by the explicit partial index `idx_transactions_idempotency_unique`.
 * Either name can surface depending on which one the planner reports, so both
 * are accepted.
 */
export const TRANSACTION_IDEMPOTENCY_CONSTRAINTS = [
  'idx_transactions_idempotency_unique',
  'transactions_idempotency_key_key',
] as const;

/**
 * Unique constraints on the `withdrawal_requests` idempotency claim.
 *
 * Unlike `transactions`, this column is NOT declared UNIQUE inline (server/db/init.ts
 * declares it as a plain VARCHAR, and the later ALTER TABLE adds it the same way),
 * so the only unique constraint is the explicit partial index over
 * `(user_id, idempotency_key)`. The list is kept explicit — rather than reusing the
 * transactions list — because the two claims live on different tables: a
 * `transactions` violation raised while inserting a withdrawal row means something
 * other than a duplicate withdrawal went wrong, and must not be reported as
 * idempotent success.
 */
export const WITHDRAWAL_IDEMPOTENCY_CONSTRAINTS = [
  'idx_withdrawal_requests_idempotency_unique',
] as const;

/**
 * Unique constraint on the active pending deposit intent's `expected_amount`.
 *
 * Because every user deposits to one shared hot wallet, the exact amount is the
 * attribution key (FIN-1), and `createDepositIntent` retries with a fresh random
 * discriminator when it collides. Any OTHER unique violation on
 * `crypto_transactions` — notably `uniq_crypto_transactions_tx_hash` — means
 * something unrelated went wrong, and retrying with a new amount would neither fix
 * it nor surface it; it would burn the retry budget and report
 * DEPOSIT_INTENT_ALLOCATION_FAILED instead of the real integrity failure.
 */
export const DEPOSIT_INTENT_AMOUNT_CONSTRAINTS = [
  'uniq_crypto_deposit_expected_amount',
] as const;

/**
 * True when `err` is a Postgres unique violation on one of `constraints`.
 *
 * Deliberately strict: when the driver reports a constraint name that is not in
 * the list, this returns false so the caller rethrows. Some drivers/wrappers omit
 * `constraint`; in that case we fall back to looking for a constraint name inside
 * the message, and if none of ours appears we still return false. An unrelated
 * integrity failure must never be reported as idempotent success.
 */
export function isUniqueViolationOn(err: unknown, constraints: readonly string[]): boolean {
  const e = err as { code?: unknown; constraint?: unknown; message?: unknown } | null | undefined;
  if (!e || String(e.code) !== PG_UNIQUE_VIOLATION) return false;

  const name = typeof e.constraint === 'string' ? e.constraint : '';
  if (name) return constraints.includes(name);

  // No constraint field: match the name inside the message text instead.
  const message = typeof e.message === 'string' ? e.message : '';
  return constraints.some((c) => message.includes(c));
}

/**
 * True when `err` is the duplicate-key that means "another fulfillment path
 * already created this deposit's ledger row", i.e. the deposit is already
 * fulfilled exactly once and the caller may report idempotent success.
 */
export function isDepositIdempotencyViolation(err: unknown): boolean {
  return isUniqueViolationOn(err, TRANSACTION_IDEMPOTENCY_CONSTRAINTS);
}

/**
 * True when `err` is the duplicate-key that means "a concurrent duplicate of this
 * logical withdrawal request already claimed this idempotency key". The caller's
 * own transaction (including any balance debit or reserve it took) rolled back with
 * the violation, so it may report the prior row — after confirming the replayed
 * payload matches.
 */
export function isWithdrawalIdempotencyViolation(err: unknown): boolean {
  return isUniqueViolationOn(err, WITHDRAWAL_IDEMPOTENCY_CONSTRAINTS);
}

/**
 * True when `err` is the duplicate-key on the `transactions.idempotency_key` claim,
 * i.e. a concurrent duplicate of a ledger-anchored request (platform P2P transfer,
 * card deposit) already committed.
 */
export function isTransactionIdempotencyViolation(err: unknown): boolean {
  return isUniqueViolationOn(err, TRANSACTION_IDEMPOTENCY_CONSTRAINTS);
}

/**
 * True when `err` is the duplicate-key that means "this server-generated deposit
 * `expected_amount` is already claimed by another active pending intent", i.e. the
 * caller may safely retry with a fresh discriminator.
 */
export function isDepositIntentAmountViolation(err: unknown): boolean {
  return isUniqueViolationOn(err, DEPOSIT_INTENT_AMOUNT_CONSTRAINTS);
}
