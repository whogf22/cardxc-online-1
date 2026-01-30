import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../db/pool';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { getUserDevices, trustDevice, revokeDevice } from '../services/deviceService';
import { createAuditLog } from '../services/auditService';

const router = Router();
router.use(authenticate);

// Get user preferences
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  let prefs = await queryOne(`
    SELECT * FROM user_preferences WHERE user_id = $1
  `, [req.user!.id]);

  // Create default preferences if not exists
  if (!prefs) {
    prefs = await queryOne(`
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      RETURNING *
    `, [req.user!.id]);
  }

  res.json({ success: true, data: { preferences: prefs } });
}));

// Update preferences
router.put('/',
  body('theme').optional().isIn(['dark', 'light', 'system']),
  body('notificationsEnabled').optional().isBoolean(),
  body('emailNotifications').optional().isBoolean(),
  body('pushNotifications').optional().isBoolean(),
  body('language').optional().isIn(['en', 'es', 'fr', 'de', 'zh', 'ar', 'bn']),
  body('timezone').optional().isString(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400, 'VALIDATION_ERROR');
    }

    const { theme, notificationsEnabled, emailNotifications, pushNotifications, language, timezone } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (theme !== undefined) { updates.push(`theme = $${idx++}`); values.push(theme); }
    if (notificationsEnabled !== undefined) { updates.push(`notifications_enabled = $${idx++}`); values.push(notificationsEnabled); }
    if (emailNotifications !== undefined) { updates.push(`email_notifications = $${idx++}`); values.push(emailNotifications); }
    if (pushNotifications !== undefined) { updates.push(`push_notifications = $${idx++}`); values.push(pushNotifications); }
    if (language !== undefined) { updates.push(`language = $${idx++}`); values.push(language); }
    if (timezone !== undefined) { updates.push(`timezone = $${idx++}`); values.push(timezone); }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(req.user!.id);
      
      await query(`
        INSERT INTO user_preferences (user_id) VALUES ($${idx})
        ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}
      `, values);
    }

    res.json({ success: true, message: 'Preferences updated' });
  })
);

// Get user devices
router.get('/devices', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const devices = await getUserDevices(req.user!.id);
  
  const formatted = devices.map(d => ({
    id: d.id,
    ipAddress: d.ip_address,
    userAgent: d.user_agent,
    country: d.country,
    city: d.city,
    isTrusted: d.is_trusted,
    firstSeen: d.first_seen_at,
    lastSeen: d.last_seen_at,
  }));

  res.json({ success: true, data: { devices: formatted } });
}));

// Trust a device
router.post('/devices/:deviceId/trust', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { deviceId } = req.params;
  
  const success = await trustDevice(req.user!.id, deviceId);
  if (!success) {
    throw new AppError('Device not found', 404, 'NOT_FOUND');
  }

  await createAuditLog({
    userId: req.user!.id,
    action: 'DEVICE_TRUSTED',
    entityType: 'device',
    entityId: deviceId,
  });

  res.json({ success: true, message: 'Device trusted' });
}));

// Revoke a device
router.delete('/devices/:deviceId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { deviceId } = req.params;
  
  const success = await revokeDevice(req.user!.id, deviceId);
  if (!success) {
    throw new AppError('Device not found', 404, 'NOT_FOUND');
  }

  await createAuditLog({
    userId: req.user!.id,
    action: 'DEVICE_REVOKED',
    entityType: 'device',
    entityId: deviceId,
  });

  res.json({ success: true, message: 'Device revoked' });
}));

// Get activity log
router.get('/activity', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  
  const logs = await query(`
    SELECT id, action, entity_type, entity_id, ip_address, created_at
    FROM audit_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [req.user!.id, limit, offset]);

  res.json({ success: true, data: { activity: logs } });
}));

export { router as preferencesRouter };
