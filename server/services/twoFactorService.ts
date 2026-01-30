import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';

export async function generateTwoFactorSecret(userId: string, email: string): Promise<{ secret: string; qrCode: string; otpauthUrl: string }> {
  const secret = speakeasy.generateSecret({
    name: `CardXC:${email}`,
    issuer: 'CardXC',
    length: 20,
  });
  
  await query(`
    UPDATE users SET two_factor_secret = $1 WHERE id = $2
  `, [secret.base32, userId]);
  
  const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');
  
  return {
    secret: secret.base32,
    qrCode,
    otpauthUrl: secret.otpauth_url || '',
  };
}

export async function verifyAndEnableTwoFactor(userId: string, token: string): Promise<boolean> {
  const user = await queryOne<{ two_factor_secret: string }>(`
    SELECT two_factor_secret FROM users WHERE id = $1
  `, [userId]);
  
  if (!user?.two_factor_secret) {
    return false;
  }
  
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
    window: 1,
  });
  
  if (verified) {
    await query(`
      UPDATE users SET two_factor_enabled = TRUE WHERE id = $1
    `, [userId]);
    logger.info(`2FA enabled for user ${userId}`);
  }
  
  return verified;
}

export async function verifyTwoFactorToken(userId: string, token: string): Promise<boolean> {
  const user = await queryOne<{ two_factor_secret: string; two_factor_enabled: boolean }>(`
    SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1
  `, [userId]);
  
  if (!user?.two_factor_enabled || !user?.two_factor_secret) {
    return true;
  }
  
  return speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await query(`
    UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1
  `, [userId]);
  logger.info(`2FA disabled for user ${userId}`);
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const user = await queryOne<{ two_factor_enabled: boolean }>(`
    SELECT two_factor_enabled FROM users WHERE id = $1
  `, [userId]);
  return user?.two_factor_enabled || false;
}
