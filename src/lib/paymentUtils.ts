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
  const hasAdyenConfig = !!(
    import.meta.env.VITE_ADYEN_CLIENT_KEY ||
    import.meta.env.ADYEN_CLIENT_KEY
  );

  return hasAdyenConfig;
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
  return !!(
    import.meta.env.VITE_ADYEN_API_KEY &&
    import.meta.env.VITE_ADYEN_MERCHANT_ACCOUNT &&
    import.meta.env.VITE_ADYEN_CLIENT_KEY
  );
}

export function setPaymentDisabled(disabled: boolean): void {
  const settings = getPaymentSettings();
  settings.payment_disabled_mode = disabled;
  localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(settings));
}
