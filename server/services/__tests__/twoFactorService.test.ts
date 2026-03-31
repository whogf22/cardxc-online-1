/**
 * @vitest-environment node
 */
import { beforeEach, vi, describe, it, expect } from 'vitest';

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../db/pool', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(),
    totp: {
      verify: vi.fn(),
    },
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import {
  generateTwoFactorSecret,
  verifyAndEnableTwoFactor,
  verifyTwoFactorToken,
  disableTwoFactor,
  isTwoFactorEnabled,
} from '../twoFactorService';

const mockGenerateSecret = speakeasy.generateSecret as ReturnType<typeof vi.fn>;
const mockTotpVerify = speakeasy.totp.verify as ReturnType<typeof vi.fn>;
const mockToDataURL = QRCode.toDataURL as ReturnType<typeof vi.fn>;

describe('twoFactorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    mockQueryOne.mockReset();
  });

  describe('generateTwoFactorSecret', () => {
    it('calls speakeasy.generateSecret, updates DB, and generates QR code', async () => {
      mockGenerateSecret.mockReturnValue({
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/CardXC:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=CardXC',
      });
      mockToDataURL.mockResolvedValue('data:image/png;base64,fakequrcode');

      const result = await generateTwoFactorSecret('user-1', 'test@example.com');

      expect(mockGenerateSecret).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'CardXC:test@example.com', issuer: 'CardXC' })
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET two_factor_secret'),
        ['JBSWY3DPEHPK3PXP', 'user-1']
      );
      expect(mockToDataURL).toHaveBeenCalled();
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCode).toBe('data:image/png;base64,fakequrcode');
      expect(result.otpauthUrl).toContain('otpauth://');
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    it('returns true and updates DB when token is valid', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_secret: 'JBSWY3DPEHPK3PXP' });
      mockTotpVerify.mockReturnValue(true);

      const result = await verifyAndEnableTwoFactor('user-1', '123456');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET two_factor_enabled = TRUE'),
        ['user-1']
      );
    });

    it('returns false when no secret found in DB', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await verifyAndEnableTwoFactor('user-1', '123456');

      expect(result).toBe(false);
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('two_factor_enabled = TRUE'),
        expect.anything()
      );
    });

    it('returns false when token is invalid', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_secret: 'JBSWY3DPEHPK3PXP' });
      mockTotpVerify.mockReturnValue(false);

      const result = await verifyAndEnableTwoFactor('user-1', '000000');

      expect(result).toBe(false);
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('returns true (bypass) when 2FA is not enabled', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_enabled: false, two_factor_secret: null });

      const result = await verifyTwoFactorToken('user-1', '123456');

      expect(result).toBe(true);
    });

    it('returns true when 2FA is enabled and token is valid', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_enabled: true, two_factor_secret: 'JBSWY3DPEHPK3PXP' });
      mockTotpVerify.mockReturnValue(true);

      const result = await verifyTwoFactorToken('user-1', '123456');

      expect(result).toBe(true);
    });

    it('returns false when 2FA is enabled and token is invalid', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_enabled: true, two_factor_secret: 'JBSWY3DPEHPK3PXP' });
      mockTotpVerify.mockReturnValue(false);

      const result = await verifyTwoFactorToken('user-1', '000000');

      expect(result).toBe(false);
    });
  });

  describe('disableTwoFactor', () => {
    it('updates DB to disable 2FA and clear secret', async () => {
      await disableTwoFactor('user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('two_factor_enabled = FALSE'),
        ['user-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('two_factor_secret = NULL'),
        ['user-1']
      );
    });
  });

  describe('isTwoFactorEnabled', () => {
    it('returns true when user has 2FA enabled', async () => {
      mockQueryOne.mockResolvedValue({ two_factor_enabled: true });

      const result = await isTwoFactorEnabled('user-1');

      expect(result).toBe(true);
    });

    it('returns false when user not found or 2FA not enabled', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await isTwoFactorEnabled('user-1');

      expect(result).toBe(false);
    });
  });
});
