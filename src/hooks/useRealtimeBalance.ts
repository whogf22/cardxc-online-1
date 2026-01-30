import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

interface WalletBalance {
  user_id: string;
  currency: string;
  balance: number;
  last_updated: string;
}

const POLL_INTERVAL = 10000;

export function useRealtimeBalance(userId: string | undefined) {
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await apiClient.get('/transactions/balance');
      const data = response.data;
      
      if (data.success && data.data?.balances) {
        const mappedData: WalletBalance[] = data.data.balances.map((b: any) => ({
          user_id: userId,
          currency: b.currency,
          balance: b.available / 100,
          last_updated: new Date().toISOString(),
        }));
        
        setBalances(mappedData);
        setLastUpdated(new Date());
        setError(null);
        setIsConnected(true);
        
        return mappedData;
      }
    } catch (err) {
      console.error('[Balance] Failed to fetch:', err);
      setError('Failed to load balances');
      setIsConnected(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBalances([]);
      setIsConnected(false);
      setError(null);
      return;
    }

    let mounted = true;

    const startPolling = async () => {
      console.log('[Balance] Starting polling for user:', userId);
      
      try {
        await fetchBalances();
      } catch (err) {
        console.error('[Balance] Initial fetch error:', err);
      }

      if (mounted) {
        pollIntervalRef.current = setInterval(async () => {
          if (mounted) {
            try {
              await fetchBalances();
            } catch (err) {
              console.error('[Balance] Polling error:', err);
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
  }, [userId, fetchBalances]);

  return { 
    balances, 
    lastUpdated, 
    isConnected, 
    error,
    refresh: fetchBalances,
  };
}
