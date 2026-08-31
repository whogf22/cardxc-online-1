/**
 * Per-user daily budget for AI assistant usage.
 *
 * SECURITY / COST — the AI streaming endpoint calls a metered third-party API on
 * the platform's own key. Without a ceiling, one authenticated account can bill
 * unbounded spend; the generic per-IP `apiLimiter` does not bound it because the
 * cost is per-user, not per-IP.
 *
 * The counter is derived from the `ai_messages` rows the user already owns
 * rather than an in-memory map, so it survives restarts and stays correct when
 * more than one server instance is running. No schema change is required.
 *
 * FAIL CLOSED: if the budget cannot be evaluated the request is refused. An
 * outage must not become an unmetered-spend window.
 *
 * Covered by `server/services/__tests__/aiUsageService.test.ts` and
 * `aiUsageConcurrency.test.ts`.
 */
import { transaction } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../middleware/logger';

const DEFAULT_DAILY_MESSAGE_LIMIT = 100;

/**
 * Maximum assistant messages a single user may send per calendar day.
 * Override with `AI_DAILY_MESSAGE_LIMIT`.
 *
 * Parsed explicitly rather than with `|| DEFAULT`: an operator setting the var
 * to `0` means "disable AI spend entirely", and `|| 100` would silently turn
 * that hard stop into the default allowance.
 */
function resolveDailyLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DAILY_MESSAGE_LIMIT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DAILY_MESSAGE_LIMIT;
}

/**
 * The effective daily limit, read at CALL TIME rather than module load.
 *
 * This mirrors the convention in `services/fulfillmentPolicy.ts`: reading the
 * env on each call keeps behaviour deterministic under test and lets the value
 * be toggled per-environment without re-importing the module.
 */
export function getAiDailyMessageLimit(): number {
  return resolveDailyLimit(process.env.AI_DAILY_MESSAGE_LIMIT);
}

/** Test-only export of the parser. Not part of the public API. */
export const __resolveDailyLimitForTests = resolveDailyLimit;

/**
 * Atomically claim one unit of the caller's daily budget and persist their
 * message, or refuse.
 *
 * CONCURRENCY — this replaces a read-then-act TOCTOU. Previously the COUNT and
 * the INSERT were separate statements, so N simultaneous requests all read the
 * same pre-insert count and all passed, overrunning the ceiling by up to the
 * burst-limiter width. Here both happen inside ONE transaction that first takes
 * `pg_advisory_xact_lock` keyed on the user: the lock is held until COMMIT or
 * ROLLBACK, so per-user reservations serialise and the ceiling is exact. The
 * lock is per-user, so unrelated users never contend.
 *
 * The insert is part of the reservation on purpose — a claimed unit is always
 * backed by a row, so a crash between the two can no longer hand out free
 * budget.
 *
 * FAIL CLOSED: any failure to evaluate the budget refuses the request. A 429
 * (over limit) is propagated as-is and never masked as a 503.
 *
 * @returns the id of the inserted ai_messages row
 */
export async function reserveDailyAiMessage(
  userId: string,
  conversationId: string,
  content: string,
): Promise<string> {
  if (!userId) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    return await transaction(async (client) => {
      // Serialise this user's reservations. hashtext() maps the uuid to the
      // int key the advisory-lock API takes; a hash collision between two users
      // costs a little contention and nothing else.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);

      const countResult = await client.query(
        `
        SELECT COUNT(*) as count
        FROM ai_messages m
        JOIN ai_conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
          AND m.role = 'user'
          AND m.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      `,
        [userId],
      );

      const used = Number(countResult.rows[0]?.count);
      if (!Number.isFinite(used)) {
        throw new Error(`budget query returned a non-numeric count: ${countResult.rows[0]?.count}`);
      }

      const limit = getAiDailyMessageLimit();
      if (used >= limit) {
        logger.warn('[AiUsage] Daily AI usage limit reached', { userId, used, limit });
        throw new AppError(
          `You have reached your daily AI usage limit of ${limit} messages. It resets at midnight UTC.`,
          429,
          'AI_DAILY_LIMIT',
        );
      }

      const inserted = await client.query(
        `
        INSERT INTO ai_messages (conversation_id, role, content)
        VALUES ($1, 'user', $2)
        RETURNING id
      `,
        [conversationId, content],
      );

      return inserted.rows[0]?.id as string;
    });
  } catch (error) {
    // An over-limit refusal is a real answer, not an evaluation failure.
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('[AiUsage] Daily budget reservation failed — failing closed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(
      'AI assistant is temporarily unavailable. Please try again later.',
      503,
      'AI_BUDGET_UNAVAILABLE',
    );
  }
}
