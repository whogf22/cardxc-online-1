// Analytics tracking - only sends data in production mode

export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  if (!import.meta.env.PROD) {
    console.log('[Analytics]', eventName, properties);
    return;
  }

  if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
    fetch(import.meta.env.VITE_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventName,
        properties: properties || {},
        url: window.location.href,
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {
      // Silently fail
    });
  }
}

export function trackPageView(pageName: string): void {
  trackEvent('page_view', { page: pageName });
}

export function trackLogin(method: string = 'email'): void {
  trackEvent('user_login', { method });
}

export function trackSignup(): void {
  trackEvent('user_signup');
}

export function trackDeposit(amount: number, currency: string, method: string): void {
  trackEvent('deposit', { amount, currency, method });
}

export function trackWithdrawal(amount: number, currency: string): void {
  trackEvent('withdrawal', { amount, currency });
}

export function trackCurrencySwitch(fromCurrency: string, toCurrency: string): void {
  trackEvent('currency_switch', { from: fromCurrency, to: toCurrency });
}
