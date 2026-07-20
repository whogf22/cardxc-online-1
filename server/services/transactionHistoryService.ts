import { query } from '../db/pool';

// ── Public types ──────────────────────────────────────────────

export interface HistoryFilters {
  type?: string;
  status?: string;
  fromDate?: string; // ISO 8601
  toDate?: string;   // ISO 8601
}

export interface HistoryCursor {
  createdAt: string; // ISO timestamp
  id: string;        // UUID
}

export interface UnifiedTransaction {
  id: string;
  source: 'wallet' | 'card' | 'giftcard';
  type: string;
  status: string;
  amount: number;       // dollars (not cents)
  currency: string;
  description: string | null;
  category: string | null;
  merchantName: string | null;
  createdAt: string;
}

export interface HistoryResult {
  transactions: UnifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Constants ─────────────────────────────────────────────────

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/** All valid type values the frontend can filter on */
export const VALID_TYPES = [
  'deposit', 'withdrawal', 'transfer_in', 'transfer_out',
  'adjustment', 'payment', 'card_deposit',
  'card_spend', 'giftcard_buy', 'giftcard_sell',
] as const;

/** Normalised status values */
export const VALID_STATUSES = [
  'PENDING', 'SUCCESS', 'FAILED', 'REVERSED',
] as const;

// ── Cursor helpers (base64-encoded to avoid delimiter collisions) ──

export function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt, i: id })).toString('base64url');
}

export function decodeCursor(cursor: string): HistoryCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!decoded.t || !decoded.i) return null;
    if (isNaN(Date.parse(decoded.t))) return null;
    if (!/^[0-9a-f-]{36}$/i.test(decoded.i)) return null;
    return { createdAt: decoded.t, id: decoded.i };
  } catch {
    return null;
  }
}

// ── Main query ────────────────────────────────────────────────

export async function getUnifiedHistory(
  userId: string,
  filters: HistoryFilters,
  cursor: HistoryCursor | null,
  limit: number,
): Promise<HistoryResult> {
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT));
  // Fetch one extra to detect hasMore
  const fetchLimit = safeLimit + 1;

  const params: unknown[] = [userId];
  let paramIdx = 2;

  // ── Shared WHERE fragments built from filters ──────────

  // Date filters — applied to every sub-query
  let dateFilter = '';
  if (filters.fromDate) {
    dateFilter += ` AND created_at >= $${paramIdx}`;
    params.push(filters.fromDate);
    paramIdx++;
  }
  if (filters.toDate) {
    dateFilter += ` AND created_at <= $${paramIdx}`;
    params.push(filters.toDate);
    paramIdx++;
  }

  // Cursor filter — applied to every sub-query
  let cursorFilter = '';
  if (cursor) {
    cursorFilter = ` AND (created_at, id) < ($${paramIdx}, $${paramIdx + 1})`;
    params.push(cursor.createdAt, cursor.id);
    paramIdx += 2;
  }

  // ── Determine which sub-queries to include based on type filter ──

  const typeFilter = filters.type;
  const statusFilter = filters.status?.toUpperCase();

  // Map of source → types it provides
  const walletTypes = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'adjustment', 'payment', 'card_deposit'];
  const cardTypes = ['card_spend'];
  const giftcardTypes = ['giftcard_buy', 'giftcard_sell'];

  const includeWallet = !typeFilter || walletTypes.includes(typeFilter);
  const includeCard = !typeFilter || cardTypes.includes(typeFilter);
  const includeGiftcard = !typeFilter || giftcardTypes.includes(typeFilter);

  const subQueries: string[] = [];

  // ── Sub-query 1: transactions table ──────────────────
  // Exclude 'payment' rows that reference a gift_card_request to prevent duplicates.
  // Gift card buys insert both a transactions row (type='payment', reference=gift_card_request.id)
  // and a gift_card_requests row. We surface the richer gift_card_requests row instead.
  if (includeWallet) {
    let walletWhere = `WHERE t.user_id = $1${dateFilter}${cursorFilter}`;

    // Exclude payment transactions that are gift-card duplicates
    walletWhere += ` AND NOT (t.type = 'payment' AND t.reference IS NOT NULL AND EXISTS (
      SELECT 1 FROM gift_card_requests gcr WHERE gcr.id::text = t.reference AND gcr.user_id = t.user_id
    ))`;

    if (typeFilter && walletTypes.includes(typeFilter)) {
      walletWhere += ` AND t.type = $${paramIdx}`;
      params.push(typeFilter);
      paramIdx++;
    }
    if (statusFilter) {
      walletWhere += ` AND t.status = $${paramIdx}`;
      params.push(statusFilter);
      paramIdx++;
    }

    subQueries.push(`
      SELECT
        t.id,
        'wallet'::text AS source,
        t.type,
        t.status,
        t.amount_cents,
        t.currency,
        t.description,
        NULL::text AS category,
        COALESCE(t.merchant_display_name, t.merchant_name) AS merchant_name,
        t.created_at
      FROM transactions t
      ${walletWhere}
    `);
  }

  // ── Sub-query 2: card_transactions (via virtual_cards) ──
  if (includeCard) {
    let cardWhere = `WHERE vc.user_id = $1${dateFilter.replace(/created_at/g, 'ct.created_at')}${cursorFilter.replace(/created_at/g, 'ct.created_at').replace(/\bid\b/g, 'ct.id')}`;
    let includeCardQuery = true;

    if (statusFilter) {
      const cardStatusMap: Record<string, string> = {
        PENDING: 'pending',
        SUCCESS: 'completed',
        FAILED: 'declined',
        REVERSED: 'reversed',
      };
      const mappedStatus = cardStatusMap[statusFilter];
      if (mappedStatus) {
        cardWhere += ` AND ct.status = $${paramIdx}`;
        params.push(mappedStatus);
        paramIdx++;
      } else {
        includeCardQuery = false;
      }
    }

    if (includeCardQuery) {
      subQueries.push(`
        SELECT
          ct.id,
          'card'::text AS source,
          'card_spend'::text AS type,
          ct.status,
          ct.amount_cents,
          ct.currency,
          NULL::text AS description,
          ct.category,
          ct.merchant AS merchant_name,
          ct.created_at
        FROM card_transactions ct
        JOIN virtual_cards vc ON ct.card_id = vc.id
        ${cardWhere}
      `);
    }
  }

  // ── Sub-query 3: gift_card_requests (buy AND sell) ──────
  if (includeGiftcard) {
    // Determine which gc types to include based on type filter
    let gcTypeFilter = '';
    if (typeFilter === 'giftcard_buy') {
      gcTypeFilter = ` AND gc.type = 'buy'`;
    } else if (typeFilter === 'giftcard_sell') {
      gcTypeFilter = ` AND gc.type = 'sell'`;
    }
    // No typeFilter or typeFilter is one of the giftcard types → include both

    let gcWhere = `WHERE gc.user_id = $1${gcTypeFilter}${dateFilter.replace(/created_at/g, 'gc.created_at')}${cursorFilter.replace(/created_at/g, 'gc.created_at').replace(/\bid\b/g, 'gc.id')}`;
    let includeGcQuery = true;

    if (statusFilter) {
      const gcStatusMap: Record<string, string> = {
        PENDING: 'pending',
        SUCCESS: 'completed',
        FAILED: 'rejected',
      };
      const mappedStatus = gcStatusMap[statusFilter];
      if (mappedStatus) {
        gcWhere += ` AND gc.status = $${paramIdx}`;
        params.push(mappedStatus);
        paramIdx++;
      } else {
        // REVERSED has no gift card equivalent — skip
        includeGcQuery = false;
      }
    }

    if (includeGcQuery) {
      // Note: card_code is intentionally excluded (sensitive field — never exposed via API)
      subQueries.push(`
        SELECT
          gc.id,
          'giftcard'::text AS source,
          CASE gc.type WHEN 'buy' THEN 'giftcard_buy' ELSE 'giftcard_sell' END AS type,
          gc.status,
          gc.amount_cents,
          gc.currency,
          CASE gc.type
            WHEN 'buy' THEN CONCAT('Purchase ', gc.brand, ' gift card')
            ELSE CONCAT('Sell ', gc.brand, ' gift card')
          END AS description,
          NULL::text AS category,
          gc.brand AS merchant_name,
          gc.created_at
        FROM gift_card_requests gc
        ${gcWhere}
      `);
    }
  }

  // Filter out empty strings
  const validQueries = subQueries.filter(q => q.trim().length > 0);

  if (validQueries.length === 0) {
    return { transactions: [], nextCursor: null, hasMore: false };
  }

  // LIMIT placeholder
  const limitParamIdx = paramIdx;
  params.push(fetchLimit);

  const sql = `
    SELECT * FROM (
      ${validQueries.join('\n      UNION ALL\n      ')}
    ) unified
    ORDER BY created_at DESC, id DESC
    LIMIT $${limitParamIdx}
  `;

  const rows = await query<{
    id: string;
    source: string;
    type: string;
    status: string;
    amount_cents: string | number;
    currency: string;
    description: string | null;
    category: string | null;
    merchant_name: string | null;
    created_at: string;
  }>(sql, params);

  const hasMore = rows.length > safeLimit;
  const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

  const transactions: UnifiedTransaction[] = resultRows.map(row => ({
    id: row.id,
    source: row.source as UnifiedTransaction['source'],
    type: row.type,
    status: normalizeStatus(row.status, row.source),
    amount: Number(row.amount_cents) / 100,
    currency: row.currency,
    description: row.description,
    category: row.category,
    merchantName: row.merchant_name,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  let nextCursor: string | null = null;
  if (hasMore && resultRows.length > 0) {
    const last = resultRows[resultRows.length - 1];
    nextCursor = encodeCursor(new Date(last.created_at).toISOString(), last.id);
  }

  return { transactions, nextCursor, hasMore };
}

// ── Status normalisation ──────────────────────────────────────

function normalizeStatus(raw: string, source: string): string {
  if (source === 'wallet') {
    // Already uppercase: PENDING, SUCCESS, FAILED, REVERSED
    return raw;
  }

  // card_transactions & gift_card_requests use lowercase
  const map: Record<string, string> = {
    pending: 'PENDING',
    processing: 'PENDING',
    completed: 'SUCCESS',
    declined: 'FAILED',
    rejected: 'FAILED',
    reversed: 'REVERSED',
  };
  return map[raw] || raw.toUpperCase();
}
