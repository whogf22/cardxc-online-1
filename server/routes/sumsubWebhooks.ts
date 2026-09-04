import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/pool';
import { webhookLimiter } from '../middleware/rateLimit';
import { logger } from '../middleware/logger';
import { createAuditLog } from '../services/auditService';
import * as sumsub from '../services/sumsubService';

const router = Router();

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * POST /api/webhooks/sumsub
 *
 * Receives Sumsub verification webhooks on the raw request body so the
 * signature can be verified against the exact wire payload. After the
 * signature is validated, the user's kyc_status is updated to match the
 * authoritative reviewAnswer from Sumsub.
 */
router.post('/sumsub', webhookLimiter, async (req: Request, res: Response) => {
  const raw = req.body;

  if (!Buffer.isBuffer(raw)) {
    logger.warn('Sumsub webhook: expected raw body buffer', { type: typeof raw });
    return res.status(400).json({ success: false, error: 'Invalid body' });
  }

  if (!sumsub.isConfigured()) {
    logger.warn('Sumsub webhook received but provider is not configured');
    return res.status(503).end();
  }

  const headers: Record<string, string | undefined> = {
    'x-payload-digest': normalizeHeader(req.headers['x-payload-digest']),
    'x-payload-digest-alg': normalizeHeader(req.headers['x-payload-digest-alg']),
  };

  if (!sumsub.verifyWebhookSignature(raw, headers)) {
    logger.warn('Sumsub webhook: signature verification failed', {
      ip: req.ip,
      'x-payload-digest-alg': headers['x-payload-digest-alg'],
    });
    return res.status(401).end();
  }

  let payload: sumsub.SumsubWebhookPayload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    logger.warn('Sumsub webhook: invalid JSON body');
    return res.status(400).end();
  }

  // Process before acknowledging so tests and short DB writes are observable
  // in the HTTP response. Sumsub retries on 5xx; 200 is returned only after
  // the local state is committed.
  try {
    await processWebhookEvent(payload);
    res.status(200).end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sumsub webhook processing error', {
      message,
      type: payload?.type,
      applicantId: payload?.applicantId,
      externalUserId: payload?.externalUserId,
    });
    res.status(500).end();
  }
});

function buildDedupeKey(payload: sumsub.SumsubWebhookPayload): string {
  const parts: (string | number | undefined)[] = [
    payload.type,
    payload.applicantId,
    payload.inspectionId,
    payload.externalUserId,
    payload.reviewResult?.reviewAnswer,
    payload.reviewResult?.reviewRejectType,
    payload.reviewResult?.reviewId,
    payload.reviewResult?.attemptId,
    payload.reviewResult?.attemptCnt,
  ];
  return parts.filter((p): p is string | number => p !== undefined).join(':');
}

interface WebhookUser {
  id: string;
  kyc_status: string;
  sumsub_applicant_id: string | null;
}

/**
 * Deterministically resolve the CardXC user a verified Sumsub webhook is
 * about. Fail-closed: if the identifiers disagree, no user is returned and
 * no state may be mutated.
 *
 * Rules:
 * 1. payload.externalUserId is authoritative when present — never fall back
 *    to another user's applicantId if it is missing or wrong.
 * 2. If externalUserId is present and the resolved user's applicantId does
 *    not match payload.applicantId, reject.
 * 3. If the resolved user has no applicantId yet and payload.applicantId is
 *    present, allow a one-time first-webhook binding only when no other user
 *    already owns that applicantId (guarded by the UNIQUE constraint too).
 * 4. Only when externalUserId is absent may we look up by applicantId.
 */
async function resolveWebhookUser(payload: sumsub.SumsubWebhookPayload): Promise<WebhookUser | null> {
  const externalUserId = payload.externalUserId || null;
  const applicantId = payload.applicantId || null;

  if (externalUserId) {
    const user = await queryOne<WebhookUser>(
      'SELECT id, kyc_status, sumsub_applicant_id FROM users WHERE id = $1',
      [externalUserId]
    );

    if (!user) {
      logger.warn('Sumsub webhook: externalUserId not found', {
        externalUserId,
        applicantId,
        type: payload.type,
      });
      return null;
    }

    if (applicantId) {
      if (user.sumsub_applicant_id && user.sumsub_applicant_id !== applicantId) {
        logger.warn('Sumsub webhook: applicantId does not match the user binding', {
          externalUserId,
          applicantId,
          existingApplicantId: user.sumsub_applicant_id,
          type: payload.type,
        });
        return null;
      }

      if (!user.sumsub_applicant_id) {
        // First-webhook binding: verify the applicantId is not already bound
        // to a different user. The UNIQUE constraint is the final guard, but
        // resolving up front lets us skip safely instead of throwing.
        const other = await queryOne<{ id: string }>(
          'SELECT id FROM users WHERE sumsub_applicant_id = $1 AND id <> $2',
          [applicantId, externalUserId]
        );
        if (other) {
          logger.warn('Sumsub webhook: applicantId already bound to another user', {
            externalUserId,
            applicantId,
            otherUserId: other.id,
            type: payload.type,
          });
          return null;
        }
      }
    }

    return user;
  }

  if (applicantId) {
    const user = await queryOne<WebhookUser>(
      'SELECT id, kyc_status, sumsub_applicant_id FROM users WHERE sumsub_applicant_id = $1',
      [applicantId]
    );

    if (!user) {
      logger.warn('Sumsub webhook: applicantId not found', {
        applicantId,
        type: payload.type,
      });
      return null;
    }

    return user;
  }

  return null;
}

async function processWebhookEvent(payload: sumsub.SumsubWebhookPayload): Promise<void> {
  const newStatus = sumsub.mapSumsubStatus(payload.type, payload.reviewResult?.reviewAnswer);
  if (!newStatus) {
    logger.debug('Sumsub webhook: unhandled event type', { type: payload.type });
    return;
  }

  if (!payload.applicantId && !payload.externalUserId) {
    logger.warn('Sumsub webhook: missing applicantId and externalUserId', {
      type: payload.type,
    });
    return;
  }

  const dedupeKey = buildDedupeKey(payload);

  let rejectionReason: string | null = null;
  if (newStatus === 'rejected' && payload.reviewResult) {
    const labels = payload.reviewResult.rejectLabels?.join(', ') || '';
    const rejectType = payload.reviewResult.reviewRejectType || 'RETRY';
    rejectionReason = labels ? `${rejectType}: ${labels}` : rejectType;
  }

  // Fast-path idempotency check: the real guard is the unique constraint
  // and ON CONFLICT in the CTE below.
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM sumsub_webhook_events WHERE dedupe_key = $1',
    [dedupeKey]
  );
  if (existing) {
    logger.debug('Sumsub webhook: duplicate event skipped', { dedupeKey, type: payload.type });
    return;
  }

  const user = await resolveWebhookUser(payload);
  if (!user) {
    return;
  }

  // The CTE inserts the event only if the dedupe_key is new, then UPDATEs
  // the user only if the insert succeeded. This is a single statement, so
  // it is atomic and prevents both duplicate side effects and stuck retries.
  const updated = await queryOne<{ id: string }>(
    `WITH inserted AS (
       INSERT INTO sumsub_webhook_events
         (external_user_id, applicant_id, inspection_id, event_type, dedupe_key, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id
     )
     UPDATE users
     SET kyc_status = $7,
         kyc_provider = 'sumsub',
         sumsub_applicant_id = COALESCE($8, sumsub_applicant_id),
         sumsub_inspection_id = COALESCE($9, sumsub_inspection_id),
         sumsub_level_name = COALESCE($10, sumsub_level_name),
         kyc_rejection_reason = $11,
         updated_at = NOW()
     FROM inserted
     WHERE users.id = $12
       AND EXISTS (SELECT 1 FROM inserted)
     RETURNING users.id`,
    [
      user.id,
      payload.applicantId || null,
      payload.inspectionId || null,
      payload.type,
      dedupeKey,
      JSON.stringify(payload),
      newStatus,
      payload.applicantId || null,
      payload.inspectionId || null,
      process.env.SUMSUB_LEVEL_NAME || null,
      rejectionReason,
      user.id,
    ]
  );

  if (!updated) {
    logger.debug('Sumsub webhook: concurrent duplicate or missing user', { dedupeKey, type: payload.type });
    return;
  }

  await createAuditLog({
    userId: user.id,
    action: 'KYC_STATUS_CHANGED',
    entityType: 'user',
    entityId: user.id,
    oldValues: { kyc_status: user.kyc_status },
    newValues: {
      kyc_status: newStatus,
      source: 'sumsub_webhook',
      eventType: payload.type,
      applicantId: payload.applicantId,
      inspectionId: payload.inspectionId,
      reviewResult: payload.reviewResult,
    },
  });
}

export { router as sumsubWebhookRouter };
