import { Router, Response } from 'express';
import { query, queryOne } from '../db/pool';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { sensitiveOpLimiter } from '../middleware/rateLimit';
import { createAuditLog } from '../services/auditService';
import * as sumsub from '../services/sumsubService';

const router = Router();
router.use(authenticate);

interface UserKycRecord {
  id: string;
  email: string;
  phone: string | null;
  kyc_status: string;
  kyc_rejection_reason: string | null;
  sumsub_applicant_id: string | null;
  sumsub_inspection_id: string | null;
}

/**
 * GET /api/user/kyc/config
 *
 * Returns whether Sumsub is enabled and the configured level name. The client
 * uses this to decide whether to launch the Sumsub WebSDK or fall back to the
 * legacy manual document upload flow.
 */
router.get('/kyc/config', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const enabled = sumsub.isEnabled();
  res.json({
    success: true,
    data: {
      enabled,
      levelName: enabled ? process.env.SUMSUB_LEVEL_NAME : null,
      manualFallback: true,
    },
  });
}));

/**
 * POST /api/user/kyc/token
 *
 * Generates a short-lived WebSDK access token for the authenticated user.
 * Creates or reuses a Sumsub applicant keyed by the CardXC user id and stores
 * the applicant/inspection ids locally so webhooks can update the right record.
 */
router.post('/kyc/token', sensitiveOpLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!sumsub.isEnabled()) {
    throw new AppError('Sumsub KYC is not enabled', 503, 'SUMSUB_NOT_ENABLED');
  }

  const user = await queryOne<UserKycRecord>(
    'SELECT id, email, phone, kyc_status, kyc_rejection_reason, sumsub_applicant_id, sumsub_inspection_id FROM users WHERE id = $1',
    [req.user!.id]
  );

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Final rejections cannot be retried through the SDK.
  if (
    user.kyc_status === 'rejected' &&
    typeof user.kyc_rejection_reason === 'string' &&
    user.kyc_rejection_reason.toUpperCase().startsWith('FINAL')
  ) {
    throw new AppError('Verification cannot be retried', 403, 'KYC_FINAL_REJECTION');
  }

  const applicant = await sumsub.getOrCreateApplicant(
    user.id,
    user.email || undefined,
    user.phone || undefined
  );

  // Persist applicant metadata the first time we see it or if it changes.
  if (applicant.id !== user.sumsub_applicant_id || applicant.inspectionId !== user.sumsub_inspection_id) {
    await query(
      `UPDATE users
       SET sumsub_applicant_id = $1,
           sumsub_inspection_id = $2,
           kyc_provider = 'sumsub',
           kyc_status = CASE WHEN kyc_status = 'not_started' THEN 'pending' ELSE kyc_status END,
           updated_at = NOW()
       WHERE id = $3`,
      [applicant.id, applicant.inspectionId, user.id]
    );
  }

  const accessToken = await sumsub.generateAccessToken(
    user.id,
    user.email || undefined,
    user.phone || undefined
  );

  await createAuditLog({
    userId: user.id,
    action: 'SUMSUB_TOKEN_GENERATED',
    entityType: 'kyc',
    entityId: applicant.id,
    newValues: {
      inspectionId: applicant.inspectionId,
      levelName: process.env.SUMSUB_LEVEL_NAME,
    },
  });

  res.json({
    success: true,
    data: {
      token: accessToken.token,
      applicantId: applicant.id,
      levelName: process.env.SUMSUB_LEVEL_NAME,
    },
  });
}));

export { router as sumsubRouter };
