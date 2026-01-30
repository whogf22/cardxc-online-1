import { query } from '../db/pool';
import { logger } from '../middleware/logger';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      entry.newValues ? JSON.stringify(entry.newValues) : null,
      entry.ipAddress,
      entry.userAgent,
    ]);
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
}

export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }
  if (filters.action) {
    conditions.push(`action ILIKE $${paramIndex++}`);
    params.push(`%${filters.action}%`);
  }
  if (filters.entityType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entityType);
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const logs = await query(`
    SELECT al.*, u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, [...params, limit, offset]);

  return logs;
}

export function exportAuditLogsToCSV(logs: any[]): string {
  const headers = ['Timestamp', 'User Email', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Details'];
  const rows = logs.map(log => [
    log.created_at,
    log.user_email || 'N/A',
    log.action,
    log.entity_type || 'N/A',
    log.entity_id || 'N/A',
    log.ip_address || 'N/A',
    JSON.stringify({ old: log.old_values, new: log.new_values }),
  ]);

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
}
