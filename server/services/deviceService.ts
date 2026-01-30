import { query, queryOne } from '../db/pool';
import { logger } from '../middleware/logger';
import { createNotification } from './notificationService';
import crypto from 'crypto';

interface DeviceInfo {
  ipAddress: string;
  userAgent: string;
  country?: string;
  city?: string;
}

export function generateDeviceFingerprint(info: DeviceInfo): string {
  const data = `${info.userAgent}|${info.ipAddress.split('.').slice(0, 2).join('.')}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

export async function trackDevice(userId: string, info: DeviceInfo): Promise<{ isNew: boolean; isTrusted: boolean }> {
  const fingerprint = generateDeviceFingerprint(info);
  
  try {
    // Check if device exists
    const existingDevice = await queryOne<any>(`
      SELECT id, is_trusted, first_seen_at FROM user_devices
      WHERE user_id = $1 AND device_fingerprint = $2
    `, [userId, fingerprint]);

    if (existingDevice) {
      // Update last seen
      await query(`
        UPDATE user_devices 
        SET last_seen_at = NOW(), ip_address = $1, country = $2, city = $3
        WHERE id = $4
      `, [info.ipAddress, info.country, info.city, existingDevice.id]);
      
      return { isNew: false, isTrusted: existingDevice.is_trusted };
    }

    // New device - create record
    await query(`
      INSERT INTO user_devices (user_id, device_fingerprint, ip_address, user_agent, country, city)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, fingerprint, info.ipAddress, info.userAgent?.substring(0, 500), info.country, info.city]);

    // Notify user of new device
    await createNotification({
      userId,
      type: 'security_alert',
      title: 'New Device Login',
      message: `A new device logged into your account from ${info.city || 'Unknown Location'}, ${info.country || 'Unknown Country'}`,
      metadata: { ipAddress: info.ipAddress, country: info.country, city: info.city },
    });

    logger.info(`[Device] New device detected for user ${userId}`, { fingerprint, country: info.country });
    
    return { isNew: true, isTrusted: false };
  } catch (err) {
    logger.error('[Device] Error tracking device:', err);
    return { isNew: false, isTrusted: false };
  }
}

export async function getUserDevices(userId: string) {
  return query(`
    SELECT id, device_fingerprint, ip_address, user_agent, country, city, is_trusted, first_seen_at, last_seen_at
    FROM user_devices
    WHERE user_id = $1
    ORDER BY last_seen_at DESC
    LIMIT 20
  `, [userId]);
}

export async function trustDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    await query(`
      UPDATE user_devices SET is_trusted = TRUE
      WHERE id = $1 AND user_id = $2
    `, [deviceId, userId]);
    return true;
  } catch (err) {
    logger.error('[Device] Error trusting device:', err);
    return false;
  }
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  try {
    await query(`
      DELETE FROM user_devices WHERE id = $1 AND user_id = $2
    `, [deviceId, userId]);
    return true;
  } catch (err) {
    logger.error('[Device] Error revoking device:', err);
    return false;
  }
}

export async function checkForAnomalousLogin(userId: string, info: DeviceInfo): Promise<{ anomaly: boolean; reason?: string }> {
  try {
    // Get user's common countries
    const commonCountries = await query(`
      SELECT DISTINCT country FROM user_devices
      WHERE user_id = $1 AND country IS NOT NULL
    `, [userId]);

    const knownCountries = commonCountries.map(c => c.country);
    
    // If this is a new country and user has logged in before
    if (info.country && knownCountries.length > 0 && !knownCountries.includes(info.country)) {
      return { anomaly: true, reason: `Login from new country: ${info.country}` };
    }

    // Check for rapid IP changes (possible VPN hopping)
    const recentLogins = await query(`
      SELECT ip_address, created_at FROM login_attempts
      WHERE email = (SELECT email FROM users WHERE id = $1)
        AND success = TRUE
        AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    const uniqueIPs = new Set(recentLogins.map(l => l.ip_address));
    if (uniqueIPs.size >= 3) {
      return { anomaly: true, reason: 'Multiple IP addresses detected in short time' };
    }

    return { anomaly: false };
  } catch (err) {
    logger.error('[Device] Error checking for anomalous login:', err);
    return { anomaly: false };
  }
}
