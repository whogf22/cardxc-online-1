// Global currency state management with exchange rates and admin detection

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchExchangeRates } from '../lib/exchangeRateService';
import type { CurrencyCode, CurrencyRate } from '../lib/currencyUtils';
import { trackCurrencySwitch } from '../lib/analytics';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  rates: CurrencyRate[];
  loading: boolean;
  error: string | null;
  refreshRates: () => Promise<void>;
  isAdmin: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'selected_currency';

function isAdminPage(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/admin-') ||
    pathname.includes('/admin/')
  );
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAdmin: authIsAdmin } = useAuth({ requireAuth: false });
  
  const isAdminRoute = isAdminPage(location.pathname);
  const isAdmin = authIsAdmin || isAdminRoute;

  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY) as CurrencyCode;
      if (saved && (saved === 'USD' || saved === 'NGN' || saved === 'BDT')) {
        setCurrencyState(saved);
      }
    } catch (err) {
      console.warn('[Currency] Failed to load saved currency:', err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setCurrencyState('USD');
    }
  }, [isAdmin]);

  const setCurrency = useCallback(
    (newCurrency: CurrencyCode) => {
      if (isAdmin) {
        return;
      }

      if (currency !== newCurrency) {
        trackCurrencySwitch(currency, newCurrency);
      }

      setCurrencyState(newCurrency);
      try {
        localStorage.setItem(CURRENCY_STORAGE_KEY, newCurrency);
      } catch (err) {
        console.warn('[Currency] Failed to save currency:', err);
      }
    },
    [isAdmin, currency]
  );

  const refreshRates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedRates = await fetchExchangeRates();
      setRates(fetchedRates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch rates';
      console.error('[Currency] Rate fetch error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRates();
  }, [refreshRates]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRates();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshRates]);

  const effectiveCurrency = isAdmin ? 'USD' : currency;

  const value: CurrencyContextType = {
    currency: effectiveCurrency,
    setCurrency,
    rates,
    loading,
    error,
    refreshRates,
    isAdmin,
  };

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
