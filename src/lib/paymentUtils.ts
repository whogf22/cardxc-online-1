// Payment utilities - handles payment feature availability with safe fallbacks
// Uses localStorage for mock payment settings

const PAYMENT_SETTINGS_KEY = 'cardxc-payment-settings';

interface PaymentSettings {
  payment_disabled_mode: boolean;
}

function getPaymentSettings(): PaymentSettings {
  try {
    const stored = localStorage.getItem(PAYMENT_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : { payment_disabled_mode: false };
  } catch {
    return { payment_disabled_mode: false };
  }
}

export async function isPaymentEnabled(): Promise<boolean> {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const settings = getPaymentSettings();
    
    if (settings.payment_disabled_mode) {
      return false;
    }

    return checkAdyenConfig();
  } catch (error) {
    console.error('Error checking payment enabled status:', error);
    return false;
  }
}

function checkAdyenConfig(): boolean {
  // Only the public client key may live in the browser bundle.
  // The server-side API key must never be referenced client-side.
  if (!import.meta.env.VITE_ADYEN_CLIENT_KEY) {
    if (import.meta.env.DEV) {
      console.warn('[paymentUtils] VITE_ADYEN_CLIENT_KEY missing — Adyen UI disabled');
    }
    return false;
  }

  return true;
}

export function getPaymentDisabledMessage(): string {
  return 'Payments are currently unavailable. Please try again later.';
}

export async function withPaymentCheck<T>(
  operation: () => Promise<T>
): Promise<{ data?: T; error?: string }> {
  try {
    const enabled = await isPaymentEnabled();
    
    if (!enabled) {
      return { error: getPaymentDisabledMessage() };
    }

    const data = await operation();
    return { data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment operation failed';
    return { error: message };
  }
}

export function hasAdyenConfig(): boolean {
  // SECURITY: Adyen server API key and merchant account must never be in the
  // browser bundle. Server-side config is verified by a backend endpoint; the
  // client may only reference the public client key.
  // TODO(backend): expose GET /api/payments/adyen/config returning { configured: boolean }
  //                and replace this local check with that fetch result.
  return !!import.meta.env.VITE_ADYEN_CLIENT_KEY;
}

export function setPaymentDisabled(disabled: boolean): void {
  const settings = getPaymentSettings();
  settings.payment_disabled_mode = disabled;
  localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings));
}
