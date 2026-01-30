// Locale utilities for international users - auto-detects locale and formats dates/numbers

export function getUserLocale(): string {
  if (typeof window === 'undefined') {
    return 'en-US';
  }

  try {
    const locale = 
      navigator.language || 
      (navigator as any).userLanguage || 
      (navigator as any).browserLanguage ||
      'en-US';

    if (typeof locale === 'string' && locale.length >= 2) {
      return locale;
    }
  } catch (error) {
    console.warn('[Locale] Failed to detect locale, using en-US:', error);
  }

  return 'en-US';
}

export function getUserCountryCode(): string {
  const locale = getUserLocale();
  const parts = locale.split('-');
  return parts.length > 1 ? parts[1].toUpperCase() : 'US';
}

export function getUserLanguageCode(): string {
  const locale = getUserLocale();
  const parts = locale.split('-');
  return parts[0].toLowerCase();
}

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    const locale = getUserLocale();

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    };

    try {
      return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
    }
  } catch {
    return typeof date === 'string' ? date : date.toISOString().split('T')[0];
  }
}

export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getUserLocale();

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
  }
}

export function formatRelativeTime(date: Date | string): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    
    if (diffMs < 0) {
      return formatDate(dateObj);
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    const locale = getUserLocale();

    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (diffSeconds < 60) {
        return rtf.format(-diffSeconds, 'second');
      } else if (diffMinutes < 60) {
        return rtf.format(-diffMinutes, 'minute');
      } else if (diffHours < 24) {
        return rtf.format(-diffHours, 'hour');
      } else if (diffDays < 7) {
        return rtf.format(-diffDays, 'day');
      } else {
        return formatDate(dateObj);
      }
    } catch {
      try {
        const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
        if (diffMinutes < 60) {
          return rtf.format(-diffMinutes, 'minute');
        } else if (diffHours < 24) {
          return rtf.format(-diffHours, 'hour');
        } else if (diffDays < 7) {
          return rtf.format(-diffDays, 'day');
        }
      } catch {
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
      }
      return formatDate(dateObj);
    }
  } catch {
    return typeof date === 'string' ? date : date.toISOString().split('T')[0];
  }
}

export function formatNumber(
  number: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    if (typeof number !== 'number' || isNaN(number)) {
      number = 0;
    }

    const locale = getUserLocale();

    const defaultOptions: Intl.NumberFormatOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    };

    try {
      return new Intl.NumberFormat(locale, defaultOptions).format(number);
    } catch {
      return new Intl.NumberFormat('en-US', defaultOptions).format(number);
    }
  } catch {
    return number.toFixed(2);
  }
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  options?: Intl.NumberFormatOptions
): string {
  try {
    if (typeof amount !== 'number' || isNaN(amount)) {
      amount = 0;
    }

    if (!currencyCode || typeof currencyCode !== 'string') {
      currencyCode = 'USD';
    }

    const locale = getUserLocale();

    const defaultOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    };

    try {
      return new Intl.NumberFormat(locale, defaultOptions).format(amount);
    } catch {
      try {
        return new Intl.NumberFormat('en-US', defaultOptions).format(amount);
      } catch {
        const symbol = currencyCode === 'USD' ? '$' : currencyCode === 'NGN' ? '₦' : currencyCode === 'BDT' ? '৳' : '';
        return `${symbol}${amount.toFixed(2)}`;
      }
    }
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function suggestCurrencyByCountry(): 'USD' | 'NGN' | 'BDT' {
  const countryCode = getUserCountryCode();

  const countryToCurrency: Record<string, 'USD' | 'NGN' | 'BDT'> = {
    'NG': 'NGN',
    'BD': 'BDT',
    'US': 'USD',
  };

  if (countryToCurrency[countryCode]) {
    return countryToCurrency[countryCode];
  }

  return 'USD';
}

export function getUserTimezone(): string {
  if (typeof window === 'undefined') {
    return 'UTC';
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function formatDateInUserTimezone(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getUserLocale();
  const timeZone = getUserTimezone();

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, timeZone: 'UTC' }).format(dateObj);
  }
}
