// Exchange rate service - fetches and caches rates from external API
// Uses mid-market rates similar to Wise

import type { CurrencyRate } from './currencyUtils';

const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedRates {
  rates: CurrencyRate[];
  rawRates: Record<string, number>;
  timestamp: number;
}

// Supported currencies (similar to Wise)
const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'BDT', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'PKR', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'MYR', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭' },
];

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  NGN: 1580,
  BDT: 110,
  INR: 83.5,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.5,
  CNY: 7.25,
  PKR: 278,
  AED: 3.67,
  SAR: 3.75,
  MYR: 4.47,
  SGD: 1.34,
  PHP: 56.5,
};

let cachedRawRates: Record<string, number> | null = null;

function getCachedRates(): CachedRates | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedRates = JSON.parse(cached);
    const now = Date.now();

    if (now - parsed.timestamp < CACHE_DURATION) {
      cachedRawRates = parsed.rawRates;
      return parsed;
    }

    return null;
  } catch (error) {
    console.warn('[ExchangeRate] Failed to read cache:', error);
    return null;
  }
}

function setCachedRates(rates: CurrencyRate[], rawRates: Record<string, number>): void {
  try {
    const cache: CachedRates = {
      rates,
      rawRates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    cachedRawRates = rawRates;
  } catch (error) {
    console.warn('[ExchangeRate] Failed to cache rates:', error);
  }
}

export async function fetchExchangeRates(): Promise<CurrencyRate[]> {
  const cached = getCachedRates();
  if (cached) {
    console.log('[ExchangeRate] Using cached rates');
    return cached.rates;
  }

  try {
    // Using exchangerate-api.com for mid-market rates (similar to Wise)
    const response = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD',
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      const rawRates: Record<string, number> = { USD: 1 };
      
      const rates: CurrencyRate[] = SUPPORTED_CURRENCIES.map((currency) => {
        const rate = currency.code === 'USD' ? 1 : (data.rates?.[currency.code] || FALLBACK_RATES[currency.code]);
        rawRates[currency.code] = rate;
        return {
          currency_code: currency.code,
          rate_to_usd: rate,
          currency_name: currency.name,
        };
      });

      setCachedRates(rates, rawRates);
      console.log('[ExchangeRate] Fetched rates from external API');
      return rates;
    }
  } catch (error) {
    console.warn('[ExchangeRate] Failed to fetch from external API:', error);
  }

  console.warn('[ExchangeRate] Using fallback rates');
  const fallbackRates: CurrencyRate[] = SUPPORTED_CURRENCIES.map((currency) => ({
    currency_code: currency.code,
    rate_to_usd: FALLBACK_RATES[currency.code] || 1,
    currency_name: currency.name,
  }));
  return fallbackRates;
}

// Get rate for converting from one currency to another
export function getConversionRate(from: string, to: string): number {
  const rates = cachedRawRates || FALLBACK_RATES;
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return toRate / fromRate;
}

// Get all raw rates (for calculator)
export function getRawRates(): Record<string, number> {
  return cachedRawRates || FALLBACK_RATES;
}

// Get currency info
export function getCurrencyInfo() {
  return SUPPORTED_CURRENCIES;
}

export function clearRateCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    cachedRawRates = null;
  } catch (error) {
    console.warn('[ExchangeRate] Failed to clear cache:', error);
  }
}
