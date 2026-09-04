import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KYCStatusBanner } from '../KYCStatusBanner';
import type { UserContextHookReturn } from '../../types/userContext';

const mockUseUserContext = vi.fn();

vi.mock('../../hooks/useUserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

function createContext(overrides: Partial<UserContextHookReturn> = {}): UserContextHookReturn {
  return {
    context: {
      user_id: 'user-1',
      email: 'user@example.com',
      full_name: 'User',
      phone: null,
      country: null,
      kyc_status: 'not_started',
      kyc_rejection_type: null,
      has_sumsub_applicant: false,
      account_status: 'active',
      is_admin: false,
      balances: [],
      created_at: '',
      updated_at: '',
      ...overrides.context,
    },
    loading: false,
    error: null,
    hasFeature: () => false,
    isKYCApproved: false,
    isAccountActive: true,
    canWithdraw: false,
    canDeposit: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('KYCStatusBanner', () => {
  beforeEach(() => {
    mockUseUserContext.mockReset();
  });

  it('shows Start Verification for a fresh not_started user', () => {
    mockUseUserContext.mockReturnValue(createContext());
    render(<KYCStatusBanner onUploadClick={() => {}} />);

    expect(screen.getByText('Verify Your Identity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Verification' })).toBeInTheDocument();
  });

  it('shows Resume/Continue Verification when not_started but a Sumsub applicant exists', () => {
    mockUseUserContext.mockReturnValue(
      createContext({
        context: {
          kyc_status: 'not_started',
          has_sumsub_applicant: true,
        } as UserContextHookReturn['context'],
      })
    );
    render(<KYCStatusBanner onUploadClick={() => {}} />);

    expect(screen.getByText('Resume Identity Verification')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue Verification' })).toBeInTheDocument();
  });

  it('shows Under Review for pending status and no action button', () => {
    mockUseUserContext.mockReturnValue(
      createContext({
        context: {
          kyc_status: 'pending',
          has_sumsub_applicant: true,
        } as UserContextHookReturn['context'],
      })
    );
    render(<KYCStatusBanner onUploadClick={() => {}} />);

    expect(screen.getByText('Verification In Progress')).toBeInTheDocument();
    expect(screen.getByText('Under Review')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
