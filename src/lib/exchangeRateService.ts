// Exchange rate service - fetches and caches rates from external API

import type { CurrencyRate } from './currencyUtils';

const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedRates {
  rates: CurrencyRate[];
  timestamp: number;
}

const FALLBACK_RATES: CurrencyRate[] = [
  { currency_code: 'USD', rate_to_usd: 1, currency_name: 'US Dollar' },
  { currency_code: 'NGN', rate_to_usd: 1500, currency_name: 'Nigerian Naira' },
  { currency_code: 'BDT', rate_to_usd: 110, currency_name: 'Bangladeshi Taka' },
];

function getCachedRates(): CurrencyRate[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedRates = JSON.parse(cached);
    const now = Date.now();

    if (now - parsed.timestamp < CACHE_DURATION) {
      return parsed.rates;
    }

    return null;
  } catch (error) {
    console.warn('[ExchangeRate] Failed to read cache:', error);
    return null;
  }
}

function setCachedRates(rates: CurrencyRate[]): void {
  try {
    const cache: CachedRates = {
      rates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('[ExchangeRate] Failed to cache rates:', error);
  }
}

export async function fetchExchangeRates(): Promise<CurrencyRate[]> {
  const cached = getCachedRates();
  if (cached) {
    console.log('[ExchangeRate] Using cached rates');
    return cached;
  }

  try {
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      const rates: CurrencyRate[] = [
        { currency_code: 'USD', rate_to_usd: 1, currency_name: 'US Dollar' },
        {
          currency_code: 'NGN',
          rate_to_usd: data.rates?.NGN || 1500,
          currency_name: 'Nigerian Naira',
        },
        {
          currency_code: 'BDT',
          rate_to_usd: data.rates?.BDT || 110,
          currency_name: 'Bangladeshi Taka',
        },
      ];

      setCachedRates(rates);
      console.log('[ExchangeRate] Fetched rates from external API');
      return rates;
    }
  } catch (error) {
    console.warn('[ExchangeRate] Failed to fetch from external API:', error);
  }

  console.warn('[ExchangeRate] Using fallback rates');
  return FALLBACK_RATES;
}

export function clearRateCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn('[ExchangeRate] Failed to clear cache:', error);
  }
}
