/**
 * @vitest-environment node
 *
 * Tests the fail-closed value-out eligibility gate. Default posture:
 * email verification required, KYC opt-in (off by default).
 */
import { beforeEach, afterEach, vi, describe, it, expect } from 'vitest';

const mockQueryOne = vi.fn();
vi.mock('../../db/pool', () => ({ queryOne: (...args: unknown[]) => mockQueryOne(...args) }));

let requireFinancialEligibility: typeof import('../financialEligibility')['requireFinancialEligibility'];

async function loadWithEnv(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  ({ requireFinancialEligibility } = await import('../financialEligibility'));
}

function run(user: Record<string, unknown> | null) {
  mockQueryOne.mockResolvedValueOnce(user);
  const req = { user: { id: 'u1' } } as any;
  const next = vi.fn();
  return requireFinancialEligibility(req, {} as any, next).then(() => next);
}

afterEach(() => mockQueryOne.mockReset());

describe('requireFinancialEligibility', () => {
  beforeEach(async () => {
    await loadWithEnv({ REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL: undefined, REQUIRE_KYC_FOR_WITHDRAWAL: undefined });
  });

  it('passes an active, email-verified user (KYC off by default)', async () => {
    const next = await run({ email_verified: true, kyc_status: 'not_started', account_status: 'active' });
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an unverified-email user by default (fail closed)', async () => {
    const next = await run({ email_verified: false, kyc_status: 'approved', account_status: 'active' });
    const err = next.mock.calls[0][0];
    expect(err).toBeTruthy();
    expect(err.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect(err.statusCode).toBe(403);
  });

  it('rejects a non-active account', async () => {
    const next = await run({ email_verified: true, kyc_status: 'approved', account_status: 'suspended' });
    expect(next.mock.calls[0][0].code).toBe('ACCOUNT_INACTIVE');
  });

  it('rejects when the user record is missing (fail closed)', async () => {
    const next = await run(null);
    expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
  });

  it('enforces KYC when REQUIRE_KYC_FOR_WITHDRAWAL=true', async () => {
    await loadWithEnv({ REQUIRE_KYC_FOR_WITHDRAWAL: 'true' });
    const next = await run({ email_verified: true, kyc_status: 'pending', account_status: 'active' });
    expect(next.mock.calls[0][0].code).toBe('KYC_REQUIRED');
  });

  it('allows disabling the email gate with REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL=false', async () => {
    await loadWithEnv({ REQUIRE_EMAIL_VERIFIED_FOR_WITHDRAWAL: 'false' });
    const next = await run({ email_verified: false, kyc_status: 'not_started', account_status: 'active' });
    expect(next).toHaveBeenCalledWith();
  });
});
