// Currency utilities - all amounts stored in USD internally, display-only conversion

export type CurrencyCode = 'USD' | 'NGN' | 'BDT';

export interface CurrencyRate {
  currency_code: string;
  rate_to_usd: number;
  currency_name?: string;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  switch (currency) {
    case 'USD':
      return '$';
    case 'NGN':
      return '₦';
    case 'BDT':
      return '৳';
    default:
      return '$';
  }
}

export function convertAmount(
  amountInUSD: number,
  targetCurrency: CurrencyCode,
  rates: CurrencyRate[]
): number {
  if (targetCurrency === 'USD') {
    return amountInUSD;
  }

  const rate = rates.find(r => r.currency_code === targetCurrency);
  if (!rate || !rate.rate_to_usd || rate.rate_to_usd === 0) {
    const fallbackRates: Record<CurrencyCode, number> = {
      USD: 1,
      NGN: 1500,
      BDT: 110,
    };
    return amountInUSD * fallbackRates[targetCurrency];
  }

  return amountInUSD * rate.rate_to_usd;
}

export function formatCurrency(
  amountInUSD: number,
  currency: CurrencyCode,
  rates: CurrencyRate[],
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }
): string {
  const {
    showSymbol = true,
  } = options || {};
  
  let maxDigits = options?.maximumFractionDigits ?? 2;
  let minDigits = options?.minimumFractionDigits ?? 2;
  
  if (options?.maximumFractionDigits !== undefined && options?.minimumFractionDigits === undefined) {
    minDigits = Math.min(minDigits, maxDigits);
  }
  
  const minimumFractionDigits = Math.min(minDigits, maxDigits);
  const maximumFractionDigits = maxDigits;

  const convertedAmount = convertAmount(amountInUSD, currency, rates);
  const symbol = showSymbol ? getCurrencySymbol(currency) : '';

  let formatted: string;
  
  switch (currency) {
    case 'USD':
      formatted = convertedAmount.toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits,
      });
      break;
    case 'NGN':
      formatted = convertedAmount.toLocaleString('en-NG', {
        minimumFractionDigits,
        maximumFractionDigits,
      });
      break;
    case 'BDT':
      formatted = convertedAmount.toLocaleString('en-BD', {
        minimumFractionDigits,
        maximumFractionDigits,
      });
      break;
    default:
      formatted = convertedAmount.toLocaleString('en-US', {
        minimumFractionDigits,
        maximumFractionDigits,
      });
  }

  if (showSymbol) {
    if (currency === 'USD') {
      return `${symbol}${formatted}`;
    } else {
      return `${symbol}${formatted}`;
    }
  }

  return formatted;
}

export function parseToUSD(
  displayAmount: number,
  displayCurrency: CurrencyCode,
  rates: CurrencyRate[]
): number {
  if (displayCurrency === 'USD') {
    return displayAmount;
  }

  const rate = rates.find(r => r.currency_code === displayCurrency);
  if (!rate || !rate.rate_to_usd || rate.rate_to_usd === 0) {
    const fallbackRates: Record<CurrencyCode, number> = {
      USD: 1,
      NGN: 1500,
      BDT: 110,
    };
    return displayAmount / fallbackRates[displayCurrency];
  }

  return displayAmount / rate.rate_to_usd;
}
