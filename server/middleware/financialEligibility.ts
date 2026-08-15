import { Response, NextFunction } from 'express';
import { queryOne } from '../db/pool';
import { AppError } from './errorHandler';
import { AuthenticatedRequest } from './auth';

/**
 * Fail-closed eligibility gate for money-moving ("value-out") endpoints such as
 * withdrawals and transfers.
 *
 * Posture mirrors the card-checkout deposit gate in routes/cardCheckout.ts:
 *  - email verification is REQUIRED by default (set
 *    REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL=false to disable),
 *  - KYC approval is OFF by default and opt-in (set
 *    REQUIRE_KYC_FOR_WITHDRAWAL=true to enforce), matching
 *    REQUIRE_KYC_FOR_CARD_CHECKOUT so operators configure one consistent
 *    identity posture.
 *
 * account_status is re-checked here as defense in depth even though
 * `authenticate` already rejects non-active accounts: this keeps the value-out
 * decision self-contained and correct even if the auth path changes.
 *
 * On any lookup failure the request is rejected (fail closed), never allowed
 * through unverified.
 */
const REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL =
  process.env.REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL !== 'false';
const REQUIRE_KYC_FOR_WITHDRAWAL =
  process.env.REQUIRE_KYC_FOR_WITHDRAWAL === 'true';

export async function requireFinancialEligibility(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const user = await queryOne<{
      email_verified: boolean;
      kyc_status: string | null;
      account_status: string | null;
    }>(
      `SELECT email_verified, kyc_status, account_status FROM users WHERE id = $1`,
      [req.user.id],
    );

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Fail closed: a missing/unknown status is NOT treated as active. The
    // account_status CHECK constraint permits NULL, so an incomplete row must
    // never pass a value-out control by defaulting to 'active'.
    if (user.account_status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    if (REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL && !user.email_verified) {
      throw new AppError(
        'Please verify your email before moving funds.',
        403,
        'EMAIL_VERIFICATION_REQUIRED',
      );
    }

    if (
      REQUIRE_KYC_FOR_WITHDRAWAL &&
      (user.kyc_status || '').toLowerCase() !== 'approved'
    ) {
      throw new AppError(
        'Identity verification (KYC) is required before moving funds.',
        403,
        'KYC_REQUIRED',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
