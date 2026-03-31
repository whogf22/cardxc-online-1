/**
 * @vitest-environment node
 */
import { beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockClient = { query: vi.fn() };
const mockTransaction = vi.fn(async (cb: any) => cb(mockClient));
const mockCreateAuditLog = vi.fn().mockResolvedValue(undefined);
const mockSendCryptoToWallet = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  transaction: (...args: unknown[]) => mockTransaction(...args),
}));
vi.mock('../auditService', () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));
vi.mock('../cryptoProviderService', () => ({
  sendCryptoToWallet: (...args: unknown[]) => mockSendCryptoToWallet(...args),
}));
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { processWithdrawal } from '../withdrawalService';
import { AppError } from '../../middleware/errorHandler';

beforeEach(() => {
  mockQuery.mockReset();
  mockQueryOne.mockReset();
  mockClient.query.mockReset();
  mockTransaction.mockReset().mockImplementation(async (cb: any) => cb(mockClient));
  mockCreateAuditLog.mockReset().mockResolvedValue(undefined);
  mockSendCryptoToWallet.mockReset();
});

describe('processWithdrawal', () => {
  // ─── Bank Withdrawal ───────────────────────────────────────────────

  describe('bank withdrawal', () => {
    const baseBankRequest = {
      type: 'bank' as const,
      userId: 'user-1',
      amount: 50,
      currency: 'USD',
      walletType: 'fiat' as const,
      bankName: 'Test Bank',
      accountNumber: '123456',
      accountName: 'John Doe',
    };

    it('fiat: checks balance, reserves amount, creates withdrawal + transaction records, returns success', async () => {
      mockClient.query
        // SELECT wallet
        .mockResolvedValueOnce({
          rows: [{ balance_cents: 10000, usdt_balance_cents: 0, reserved_cents: 0 }],
        })
        // UPDATE wallets (reserve)
        .mockResolvedValueOnce({ rows: [] })
        // INSERT withdrawal_requests
        .mockResolvedValueOnce({ rows: [{ id: 'wd-1' }] })
        // INSERT transactions
        .mockResolvedValueOnce({ rows: [] });

      const result = await processWithdrawal(baseBankRequest);

      expect(result.success).toBe(true);
      expect(result.withdrawalId).toBe('wd-1');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT balance_cents'),
        ['user-1', 'USD'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('reserved_cents = reserved_cents + $1'),
        [5000, 'user-1', 'USD'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO withdrawal_requests'),
        ['user-1', 5000, 'USD', 'Test Bank', '123456', 'John Doe'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining(['user-1', 5000, 'USD', 'wd-1']),
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_WITHDRAWAL_REQUESTED' }),
      );
    });

    it('USDT: checks usdt_balance_cents, deducts from USDT, creates records', async () => {
      const usdtRequest = { ...baseBankRequest, walletType: 'usdt' as const };

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ balance_cents: 0, usdt_balance_cents: 10000, reserved_cents: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'wd-2' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await processWithdrawal(usdtRequest);

      expect(result.success).toBe(true);
      expect(result.withdrawalId).toBe('wd-2');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('usdt_balance_cents = usdt_balance_cents - $1'),
        [5000, 'user-1', 'USD'],
      );
    });

    it('insufficient fiat balance throws AppError 400', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ balance_cents: 1000, usdt_balance_cents: 0, reserved_cents: 500 }],
      });

      await expect(processWithdrawal(baseBankRequest)).rejects.toThrow('Insufficient balance');
    });

    it('insufficient USDT balance throws AppError 400', async () => {
      const usdtRequest = { ...baseBankRequest, walletType: 'usdt' as const };

      mockClient.query.mockResolvedValueOnce({
        rows: [{ balance_cents: 0, usdt_balance_cents: 100, reserved_cents: 0 }],
      });

      await expect(processWithdrawal(usdtRequest)).rejects.toThrow('Insufficient USDT balance');
    });

    it('wallet not found throws AppError 404', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(processWithdrawal(baseBankRequest)).rejects.toThrow('Wallet not found');
    });
  });

  // ─── Crypto Withdrawal ─────────────────────────────────────────────

  describe('crypto withdrawal', () => {
    const baseCryptoRequest = {
      type: 'crypto' as const,
      userId: 'user-1',
      amount: 50,
      walletAddress: 'TXyz1234567890abcdef',
      network: 'TRC20',
    };

    it('minimum amount < 10 throws AppError 400', async () => {
      const lowRequest = { ...baseCryptoRequest, amount: 5 };

      await expect(processWithdrawal(lowRequest)).rejects.toThrow('Minimum crypto withdrawal is 10 USDT');
    });

    it('insufficient USDT balance throws AppError 400', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ usdt_balance_cents: 100 }],
      });

      await expect(processWithdrawal(baseCryptoRequest)).rejects.toThrow('Insufficient USDT balance');
    });

    it('successful: deducts balance, calls sendCryptoToWallet, updates status to processing', async () => {
      // First transaction: deduct balance + create withdrawal
      mockTransaction.mockImplementationOnce(async (cb: any) => {
        const client1 = { query: vi.fn() };
        client1.query
          .mockResolvedValueOnce({ rows: [{ usdt_balance_cents: 10000 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'wd-crypto-1' }] });
        return cb(client1);
      });

      mockSendCryptoToWallet.mockResolvedValue({
        success: true,
        payoutId: 'payout-1',
        txHash: 'hash-abc',
        status: 'processing',
        estimatedCompletionTime: '5 minutes',
      });

      // Second transaction: update status + ledger entry
      mockTransaction.mockImplementationOnce(async (cb: any) => {
        const client2 = { query: vi.fn() };
        client2.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });
        return cb(client2);
      });

      const result = await processWithdrawal(baseCryptoRequest);

      expect(result.success).toBe(true);
      expect(result.withdrawalId).toBe('wd-crypto-1');
      expect(result.payoutId).toBe('payout-1');
      expect(result.txHash).toBe('hash-abc');
      expect(mockSendCryptoToWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: 50,
          walletAddress: 'TXyz1234567890abcdef',
          network: 'TRC20',
          transactionId: 'wd-crypto-1',
        }),
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CRYPTO_WITHDRAWAL_INITIATED' }),
      );
    });

    it('sendCryptoToWallet fails: refunds balance, marks as failed, throws AppError 500', async () => {
      // First transaction: deduct balance + create withdrawal
      mockTransaction.mockImplementationOnce(async (cb: any) => {
        const client1 = { query: vi.fn() };
        client1.query
          .mockResolvedValueOnce({ rows: [{ usdt_balance_cents: 10000 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'wd-crypto-2' }] });
        return cb(client1);
      });

      mockSendCryptoToWallet.mockRejectedValue(new Error('Network timeout'));

      // Third transaction (refund): refund balance + mark failed
      mockTransaction.mockImplementationOnce(async (cb: any) => {
        const client3 = { query: vi.fn() };
        client3.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });
        return cb(client3);
      });

      await expect(processWithdrawal(baseCryptoRequest)).rejects.toThrow(/Crypto withdrawal failed/);
    });
  });

  // ─── Platform Transfer ─────────────────────────────────────────────

  describe('platform transfer', () => {
    const basePlatformRequest = {
      type: 'platform' as const,
      userId: 'user-1',
      recipientEmail: 'recipient@example.com',
      amount: 25,
      walletType: 'fiat' as const,
    };

    it('recipient not found throws AppError 404', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(processWithdrawal(basePlatformRequest)).rejects.toThrow('Recipient not found on platform');
    });

    it('self-transfer throws AppError 400', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'user-1', email: 'self@example.com', full_name: 'Self' }],
      });

      await expect(processWithdrawal(basePlatformRequest)).rejects.toThrow('Cannot transfer to yourself');
    });

    it('insufficient fiat balance throws AppError 400', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'user-2', email: 'recipient@example.com', full_name: 'Jane' }],
        })
        .mockResolvedValueOnce({
          rows: [{ balance_cents: 1000, usdt_balance_cents: 0, reserved_cents: 900 }],
        });

      await expect(processWithdrawal(basePlatformRequest)).rejects.toThrow('Insufficient balance');
    });

    it('successful fiat transfer: deducts sender, credits recipient, creates both transaction records', async () => {
      mockClient.query
        // SELECT recipient
        .mockResolvedValueOnce({
          rows: [{ id: 'user-2', email: 'recipient@example.com', full_name: 'Jane Doe' }],
        })
        // SELECT sender wallet
        .mockResolvedValueOnce({
          rows: [{ balance_cents: 10000, usdt_balance_cents: 0, reserved_cents: 0 }],
        })
        // UPDATE sender balance
        .mockResolvedValueOnce({ rows: [] })
        // UPSERT recipient balance
        .mockResolvedValueOnce({ rows: [] })
        // INSERT sender transaction
        .mockResolvedValueOnce({ rows: [] })
        // INSERT recipient transaction
        .mockResolvedValueOnce({ rows: [] });

      const result = await processWithdrawal(basePlatformRequest);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Jane Doe');
      expect(result.recipient).toEqual({
        email: 'recipient@example.com',
        name: 'Jane Doe',
      });

      // Deduct sender
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('balance_cents = balance_cents - $1'),
        [2500, 'user-1', 'USD'],
      );
      // Credit recipient
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('balance_cents = wallets.balance_cents + $3'),
        ['user-2', 'USD', 2500],
      );
      // Sender transaction
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("'transfer_out'"),
        expect.arrayContaining(['user-1', 2500, 'USD']),
      );
      // Recipient transaction
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("'transfer_in'"),
        expect.arrayContaining(['user-2', 2500, 'USD']),
      );
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PLATFORM_TRANSFER_SENT' }),
      );
    });
  });
});
