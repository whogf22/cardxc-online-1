// Hook for locale-aware formatting of dates, numbers, and currencies

import { useMemo } from 'react';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrencyAmount,
  formatDateInUserTimezone,
  getUserLocale,
  getUserCountryCode,
  getUserTimezone,
} from '../lib/localeUtils';

export function useLocaleFormat() {
  const locale = useMemo(() => getUserLocale(), []);
  const countryCode = useMemo(() => getUserCountryCode(), []);
  const timezone = useMemo(() => getUserTimezone(), []);

  return {
    locale,
    countryCode,
    timezone,
    formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDate(date, options),
    formatDateTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(date, options),
    formatRelativeTime: (date: Date | string) => formatRelativeTime(date),
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(number, options),
    formatCurrency: (amount: number, currencyCode: string, options?: Intl.NumberFormatOptions) =>
      formatCurrencyAmount(amount, currencyCode, options),
    formatDateInTimezone: (date: Date | string, options?: Intl.DateTimeFormatOptions) =>
      formatDateInUserTimezone(date, options),
  };
}
