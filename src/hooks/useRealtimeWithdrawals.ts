import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  rejection_reason?: string;
}

const POLL_INTERVAL = 10000;

export function useRealtimeWithdrawals(userId?: string, isAdmin = false) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    if (!isAdmin && !userId) return;

    try {
      const endpoint = isAdmin ? '/admin/withdrawals' : '/transactions/withdrawals';
      const response = await apiClient.get(endpoint);
      const data = response.data;
      
      if (data.success && data.data?.withdrawals) {
        const mappedData: WithdrawalRequest[] = data.data.withdrawals.map((w: any) => ({
          id: w.id,
          user_id: w.user_id,
          amount: typeof w.amount === 'number' ? w.amount : (w.amount_cents / 100),
          currency: w.currency,
          status: w.status,
          bank_name: w.bank_name,
          account_number: w.account_number,
          account_holder: w.account_name || w.account_holder,
          created_at: w.created_at,
          updated_at: w.updated_at || w.created_at,
          admin_notes: w.admin_notes,
          rejection_reason: w.rejection_reason,
        }));
        
        setWithdrawals(mappedData);
        setLastUpdated(new Date());
        setError(null);
        setIsConnected(true);
        
        return mappedData;
      }
    } catch (err) {
      console.error('[Withdrawals] Failed to fetch:', err);
      setError('Failed to load withdrawals');
      setIsConnected(false);
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    if (!isAdmin && !userId) {
      setWithdrawals([]);
      setIsConnected(false);
      setError(null);
      return;
    }

    let mounted = true;

    const startPolling = async () => {
      console.log('[Withdrawals] Starting polling');
      
      try {
        await fetchWithdrawals();
      } catch (err) {
        console.error('[Withdrawals] Initial fetch error:', err);
      }

      if (mounted) {
        pollIntervalRef.current = setInterval(async () => {
          if (mounted) {
            try {
              await fetchWithdrawals();
            } catch (err) {
              console.error('[Withdrawals] Polling error:', err);
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
  }, [userId, isAdmin, fetchWithdrawals]);

  return { 
    withdrawals, 
    lastUpdated, 
    isConnected, 
    error,
    refresh: fetchWithdrawals,
  };
}
