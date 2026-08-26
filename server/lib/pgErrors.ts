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
