/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import {
  getUserLocale,
  getUserCountryCode,
  getUserTimezone,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrencyAmount,
  formatDateInUserTimezone,
  suggestCurrencyByCountry,
} from '../lib/localeUtils';

interface LocaleContextType {
  locale: string;
  countryCode: string;
  timezone: string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date | string) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currencyCode: string, options?: Intl.NumberFormatOptions) => string;
  formatDateInTimezone: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  suggestCurrency: () => 'USD' | 'NGN' | 'BDT';
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useMemo(() => getUserLocale(), []);
  const countryCode = useMemo(() => getUserCountryCode(), []);
  const timezone = useMemo(() => getUserTimezone(), []);

  const value: LocaleContextType = useMemo(
    () => ({
      locale,
      countryCode,
      timezone,
      formatDate: (date, options) => formatDate(date, options),
      formatDateTime: (date, options) => formatDateTime(date, options),
      formatRelativeTime: (date) => formatRelativeTime(date),
      formatNumber: (number, options) => formatNumber(number, options),
      formatCurrency: (amount, currencyCode, options) =>
        formatCurrencyAmount(amount, currencyCode, options),
      formatDateInTimezone: (date, options) => formatDateInUserTimezone(date, options),
      suggestCurrency: () => suggestCurrencyByCountry(),
    }),
    [locale, countryCode, timezone]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
