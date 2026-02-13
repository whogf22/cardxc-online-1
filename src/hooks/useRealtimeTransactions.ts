import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

interface LedgerEntry {
  id: string;
  user_id: string;
  currency: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: string;
  created_at: string;
}

const POLL_INTERVAL = 10000;

export function useRealtimeTransactions(userId: string | undefined, limit = 50) {
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await apiClient.get(`/transactions?limit=${limit}`);
      const data = response as { success?: boolean; data?: { transactions?: unknown[] } };
      
      if (data.success && data.data?.transactions) {
        const mappedData: LedgerEntry[] = data.data.transactions.map((entry: any) => ({
          id: entry.id,
          user_id: entry.user_id || userId,
          currency: entry.currency,
          amount: entry.amount_cents / 100,
          type: entry.type === 'deposit' || entry.type === 'transfer_in' || entry.type === 'adjustment' ? 'credit' : 'debit',
          status: entry.status?.toLowerCase() === 'success' ? 'completed' : entry.status?.toLowerCase() || 'pending',
          description: entry.description || '',
          reference: entry.reference || '',
          created_at: entry.created_at,
        }));
        
        setTransactions(mappedData);
        setLastUpdated(new Date());
        setError(null);
        setIsConnected(true);
        
        return mappedData;
      }
    } catch (err) {
      console.error('[Transactions] Failed to fetch:', err);
      setError('Failed to load transactions');
      setIsConnected(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setIsConnected(false);
      setError(null);
      return;
    }

    let mounted = true;

    const startPolling = async () => {
      console.log('[Transactions] Starting polling for user:', userId);
      
      try {
        await fetchTransactions();
      } catch (err) {
        console.error('[Transactions] Initial fetch error:', err);
      }

      if (mounted) {
        pollIntervalRef.current = setInterval(async () => {
          if (mounted) {
            try {
              await fetchTransactions();
            } catch (err) {
              console.error('[Transactions] Polling error:', err);
            }
          }
        }, POLL_INTERVAL);
      }
    };

    startPolling();

    return () => {
      mounted = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [userId, limit, fetchTransactions]);

  return { 
    transactions, 
    lastUpdated, 
    isConnected, 
    error,
    refresh: fetchTransactions,
  };
}
