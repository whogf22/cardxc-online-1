// Hook for currency formatting based on selected currency

import { useCurrency } from '../contexts/CurrencyContext';
import { formatCurrency } from '../lib/currencyUtils';

export function useCurrencyFormat() {
  const { currency, rates } = useCurrency();

  return (amountInUSD: number, options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSymbol?: boolean;
  }) => {
    return formatCurrency(amountInUSD, currency, rates, options);
  };
}
