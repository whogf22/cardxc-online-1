/**
 * @vitest-environment node
 */
import { beforeEach, vi, describe, it, expect } from 'vitest';

const { mockQuery, mockQueryOne, mockCreateNotification } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryOne: vi.fn(),
  mockCreateNotification: vi.fn(),
}));

vi.mock('../../db/pool', () => ({
  query: mockQuery,
  queryOne: mockQueryOne,
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../notificationService', () => ({
  createNotification: mockCreateNotification,
}));

import {
  checkLoginVelocity,
  runFraudChecks,
  getUserTransactionLimits,
  clearFraudFlag,
  getFraudFlags,
} from '../fraudService';

beforeEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockCreateNotification.mockReset();
});

describe('checkLoginVelocity', () => {
  it('returns allowed:true when fewer than 10 failures', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '5' });

    const result = await checkLoginVelocity('test@example.com');

    expect(result).toEqual({ allowed: true });
  });

  it('returns allowed:false when 10+ failures for email', async () => {
    mockQueryOne.mockResolvedValueOnce({ count: '10' });

    const result = await checkLoginVelocity('test@example.com');

    expect(result).toEqual({
      allowed: false,
      reason: 'Too many failed login attempts. Please try again later.',
    });
  });

  it('returns allowed:false when 20+ failures from IP', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ count: '3' }) // email failures - below threshold
      .mockResolvedValueOnce({ count: '20' }); // IP failures

    const result = await checkLoginVelocity('test@example.com', '1.2.3.4');

    expect(result).toEqual({
      allowed: false,
      reason: 'Too many failed login attempts from this location.',
    });
  });

  it('returns allowed:true on DB error (dangerous silent pass)', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('DB connection failed'));

    const result = await checkLoginVelocity('test@example.com');

    expect(result).toEqual({ allowed: true });
  });
});

describe('runFraudChecks', () => {
  // Helper to set up the standard mock sequence for a P2P_TRANSFER call
  // with no flags triggered. The call sequence is:
  //   1. queryOne: recentTransfers (check 2 - velocity)
  //   2. queryOne x3: dailyTotal, weeklyTotal, monthlyTotal (check 3 - limits, parallel)
  //   3. queryOne: accountAge (check 6 - new account)
  //   4. query: knownDevices (check 7 - device/IP)
  //   5. queryOne: user email_verified/kyc_status (check 8)
  // Sets up mocks for a P2P_TRANSFER call to runFraudChecks.
  // The queryOne call sequence depends on which checks are active:
  //   1. queryOne: recentTransfers (check 2 - velocity, requires amount)
  //   2. queryOne x3: daily/weekly/monthly (check 3 - limits, requires amount)
  //   3. queryOne: accountAge (check 6 - new account, requires amount > 10000)
  //   4. query: knownDevices (check 7 - device/IP, requires ipAddress)
  //   5. queryOne: user email_verified/kyc_status (check 8 - always runs)
  function setupCleanP2PMocks(overrides?: {
    recentTransfers?: { total: string; count: string };
    dailyTotal?: { total: string };
    weeklyTotal?: { total: string };
    monthlyTotal?: { total: string };
    accountAge?: { created_at: string } | null;
    knownDevices?: { ip_address: string; is_trusted: boolean }[];
    user?: { email_verified: boolean; kyc_status: string } | null;
    amount?: number;
  }) {
    const defaults = {
      recentTransfers: { total: '0', count: '0' },
      dailyTotal: { total: '0' },
      weeklyTotal: { total: '0' },
      monthlyTotal: { total: '0' },
      accountAge: { created_at: '2020-01-01T00:00:00Z' },
      knownDevices: [],
      user: { email_verified: true, kyc_status: 'approved' },
      amount: 1000,
    };
    const m = { ...defaults, ...overrides };

    const chain = mockQueryOne
      .mockResolvedValueOnce(m.recentTransfers) // check 2: velocity
      .mockResolvedValueOnce(m.dailyTotal)      // check 3: daily limit
      .mockResolvedValueOnce(m.weeklyTotal)     // check 3: weekly limit
      .mockResolvedValueOnce(m.monthlyTotal);   // check 3: monthly limit

    // Check 6 (account age) only runs if amount > 10000
    if (m.amount > 10000) {
      chain.mockResolvedValueOnce(m.accountAge);
    }

    chain.mockResolvedValueOnce(m.user);        // check 8: email/kyc

    mockQuery.mockResolvedValueOnce(m.knownDevices); // check 7: devices
  }

  it('returns passed:true with score:0 when no flags triggered', async () => {
    setupCleanP2PMocks();

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 1000,
      ipAddress: '1.2.3.4',
    });

    expect(result).toEqual({ passed: true, flags: [], score: 0 });
  });

  it('flags HIGH_LOGIN_FAILURE_RATE for LOGIN with 5+ failed attempts', async () => {
    // LOGIN action sequence:
    // 1. queryOne: get user email
    // 2. queryOne: recent login failures
    // 3. queryOne: account age (amount > 10000 check - skipped if no amount)
    // 4. query: knownDevices (if ipAddress)
    // 5. queryOne: user email/kyc
    mockQueryOne
      .mockResolvedValueOnce({ email: 'test@example.com' }) // user email
      .mockResolvedValueOnce({ count: '5' })                // login failures
      .mockResolvedValueOnce({ email_verified: true, kyc_status: 'approved' }); // check 8

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'LOGIN',
    });

    expect(result.flags).toContain('HIGH_LOGIN_FAILURE_RATE');
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it('flags HIGH_VELOCITY_TRANSFERS for P2P_TRANSFER with 10+ hourly transfers', async () => {
    setupCleanP2PMocks({
      recentTransfers: { total: '5000', count: '10' },
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 1000,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('HIGH_VELOCITY_TRANSFERS');
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('flags HIGH_HOURLY_VOLUME for P2P_TRANSFER with hourly total > 50000', async () => {
    setupCleanP2PMocks({
      recentTransfers: { total: '50001', count: '3' },
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 1000,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('HIGH_HOURLY_VOLUME');
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('flags DAILY_LIMIT_EXCEEDED when amount exceeds daily limit', async () => {
    setupCleanP2PMocks({
      dailyTotal: { total: '490000' }, // 490000 + 15000 > 500000
      amount: 15000,
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 15000,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('DAILY_LIMIT_EXCEEDED');
    expect(result.score).toBeGreaterThanOrEqual(40);
  });

  it('flags LARGE_SINGLE_TRANSACTION when amount > singleTransactionLimit (100000)', async () => {
    setupCleanP2PMocks({ amount: 100001 });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 100001,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('LARGE_SINGLE_TRANSACTION');
    expect(result.score).toBeGreaterThanOrEqual(15);
  });

  it('flags MULTIPLE_WITHDRAWAL_REQUESTS for WITHDRAWAL with 3+ in 24h', async () => {
    // WITHDRAWAL with amount sequence:
    // 1. queryOne x3: daily/weekly/monthly (check 3 - limits, parallel)
    // 2. queryOne: withdrawal count (check 5)
    // 3. queryOne: account age (check 6)
    // 4. query: knownDevices (check 7)
    // 5. queryOne: user email/kyc (check 8)
    mockQueryOne
      .mockResolvedValueOnce({ total: '0' })   // daily
      .mockResolvedValueOnce({ total: '0' })   // weekly
      .mockResolvedValueOnce({ total: '0' })   // monthly
      .mockResolvedValueOnce({ count: '3' })   // withdrawal count
      .mockResolvedValueOnce({ email_verified: true, kyc_status: 'approved' }); // user

    mockQuery.mockResolvedValueOnce([]); // knownDevices

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'WITHDRAWAL',
      amount: 5000,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('MULTIPLE_WITHDRAWAL_REQUESTS');
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('flags NEW_ACCOUNT_HIGH_VALUE for new account (<7 days) with amount > 10000', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    setupCleanP2PMocks({
      accountAge: { created_at: recentDate },
      amount: 10001,
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 10001,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('NEW_ACCOUNT_HIGH_VALUE');
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('flags EMAIL_NOT_VERIFIED for unverified email', async () => {
    setupCleanP2PMocks({
      user: { email_verified: false, kyc_status: 'approved' },
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 1000,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('EMAIL_NOT_VERIFIED');
    expect(result.score).toBeGreaterThanOrEqual(15);
  });

  it('flags KYC_NOT_APPROVED_HIGH_VALUE when KYC not approved and amount > 50000', async () => {
    setupCleanP2PMocks({
      user: { email_verified: true, kyc_status: 'pending' },
      amount: 50001,
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 50001,
      ipAddress: '1.2.3.4',
    });

    expect(result.flags).toContain('KYC_NOT_APPROVED_HIGH_VALUE');
    expect(result.score).toBeGreaterThanOrEqual(30);
  });

  it('returns passed:true when risk score is 69', async () => {
    // DAILY_LIMIT_EXCEEDED(40) + HIGH_VELOCITY_TRANSFERS(25) = 65 => passed:true (< 70)
    setupCleanP2PMocks({
      recentTransfers: { total: '5000', count: '10' },  // HIGH_VELOCITY_TRANSFERS +25
      dailyTotal: { total: '490000' },                   // DAILY_LIMIT_EXCEEDED +40
      amount: 15000,
    });

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 15000,
      ipAddress: '1.2.3.4',
    });

    // Score: 25 + 40 = 65, which is < 70
    expect(result.passed).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it('returns passed:false and creates fraud_flag + notification when risk score >= 70', async () => {
    // HIGH_VELOCITY_TRANSFERS(25) + HIGH_HOURLY_VOLUME(20) + DAILY_LIMIT_EXCEEDED(40) = 85
    setupCleanP2PMocks({
      recentTransfers: { total: '60000', count: '10' }, // velocity(25) + volume(20)
      dailyTotal: { total: '490000' },                   // daily limit(40)
      amount: 15000,
    });

    mockQuery.mockResolvedValueOnce(undefined); // INSERT fraud_flags
    mockCreateNotification.mockResolvedValueOnce(undefined);

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'P2P_TRANSFER',
      amount: 15000,
      ipAddress: '1.2.3.4',
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(70);

    // Should have inserted fraud_flags record
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO fraud_flags'),
      expect.arrayContaining(['user-1']),
    );

    // Should have created notification
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'security_alert',
        title: 'Unusual Activity Detected',
      }),
    );
  });

  it('returns passed:true on DB error (dangerous silent pass)', async () => {
    mockQueryOne.mockRejectedValueOnce(new Error('DB error'));

    const result = await runFraudChecks({
      userId: 'user-1',
      action: 'LOGIN',
    });

    expect(result).toEqual({ passed: true, flags: [], score: 0 });
  });
});

describe('getUserTransactionLimits', () => {
  it('returns limits and current usage from DB', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ total: '100000' })  // daily
      .mockResolvedValueOnce({ total: '300000' })  // weekly
      .mockResolvedValueOnce({ total: '1000000' }); // monthly

    const result = await getUserTransactionLimits('user-1');

    expect(result).toEqual({
      limits: {
        dailyLimit: 500000,
        weeklyLimit: 2000000,
        monthlyLimit: 5000000,
        singleTransactionLimit: 100000,
      },
      usage: {
        daily: 100000,
        weekly: 300000,
        monthly: 1000000,
      },
    });
  });
});

describe('clearFraudFlag', () => {
  it('updates flag to resolved and returns true', async () => {
    mockQuery.mockResolvedValueOnce(undefined);

    const result = await clearFraudFlag('flag-1', 'admin-1', 'False positive');

    expect(result).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE fraud_flags'),
      ['admin-1', 'False positive', 'flag-1'],
    );
  });

  it('returns false on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const result = await clearFraudFlag('flag-1', 'admin-1', 'False positive');

    expect(result).toBe(false);
  });
});

describe('getFraudFlags', () => {
  it('returns flags filtered by userId and status', async () => {
    const mockFlags = [
      { id: 'flag-1', user_id: 'user-1', status: 'active', flag_type: 'HIGH_VELOCITY_TRANSFERS', user_email: 'test@example.com', user_name: 'Test User' },
    ];
    mockQuery.mockResolvedValueOnce(mockFlags);

    const result = await getFraudFlags({ userId: 'user-1', status: 'active' });

    expect(result).toEqual(mockFlags);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE'),
      ['user-1', 'active'],
    );
  });

  it('returns empty array on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const result = await getFraudFlags({ userId: 'user-1' });

    expect(result).toEqual([]);
  });
});
