// Payment settings tab for toggling payment disabled mode

import { useState, useEffect } from 'react';

interface PaymentSettings {
  payment_disabled_mode: boolean;
  provider_configured: boolean;
  payment_enabled: boolean;
}

export default function PaymentSettingsTab() {
  const [settings, setSettings] = useState<PaymentSettings>({
    payment_disabled_mode: true,
    provider_configured: false,
    payment_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');

      // Check payment provider config via backend API
      let providerConfigured = false;
      try {
        const response = await fetch('/api/admin/payment-provider-status');
        if (response.ok) {
          const result = await response.json();
          providerConfigured = result.data?.configured === true;
        }
      } catch {
        providerConfigured = false;
      }

      // Use local state for payment disabled mode (no database table needed)
      const savedMode = localStorage.getItem('payment_disabled_mode');
      const paymentDisabled = savedMode === null ? true : savedMode === 'true';

      setSettings({
        payment_disabled_mode: paymentDisabled || !providerConfigured,
        provider_configured: providerConfigured,
        payment_enabled: !paymentDisabled && providerConfigured,
      });
    } catch (err: any) {
      console.error('[AdminSettings] Error loading settings');
      setError(err.message || 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentDisabledMode = async (enabled: boolean) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (enabled && !settings.provider_configured) {
        setError('Cannot enable payments: Payment gateway is not configured');
        return;
      }

      // Store in localStorage as fallback (no payment_settings table)
      localStorage.setItem('payment_disabled_mode', String(!enabled));

      setSettings({
        ...settings,
        payment_disabled_mode: !enabled,
        payment_enabled: enabled && settings.provider_configured,
      });

      setSuccess(`Payments ${enabled ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('[AdminSettings] Error updating settings');
      setError(err.message || 'Failed to update payment settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 animate-pulse">
          <div className="h-8 bg-slate-800 rounded mb-4"></div>
          <div className="h-32 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Payment Settings</h2>
        <p className="text-slate-400">Control payment feature availability</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="ri-error-warning-line text-red-400 text-xl flex-shrink-0"></i>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <i className="ri-checkbox-circle-line text-green-400 text-xl flex-shrink-0"></i>
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        </div>
      )}

      {/* Payment Disabled Mode Toggle */}
      <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">Payment Disabled Mode</h3>
            <p className="text-slate-400 text-sm mb-4">
              When enabled, all payment features are disabled. Users will see a message that payments are unavailable.
            </p>
            
            {/* Payment Gateway Config Status */}
            <div className="mb-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                settings.provider_configured
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}>
                <i className={`ri-${settings.provider_configured ? 'check' : 'close'}-circle-line`}></i>
                <span>
                  Payment Gateway: {settings.provider_configured ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            </div>

            {!settings.provider_configured && (
              <div className="bg-amber-900/50 border border-amber-700 rounded-lg p-4 mb-4">
                <p className="text-amber-300 text-sm">
                  <strong>Note:</strong> Payment gateway is not configured. Payments cannot be enabled until the payment gateway is set up.
                  Please contact your administrator to configure payment processing.
                </p>
              </div>
            )}
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center">
            <button
              onClick={() => updatePaymentDisabledMode(!settings.payment_disabled_mode)}
              disabled={saving || (!settings.provider_configured && !settings.payment_disabled_mode)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.payment_disabled_mode
                  ? 'bg-red-600'
                  : 'bg-green-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings.payment_disabled_mode ? 'translate-x-1' : 'translate-x-8'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Status Display */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Payment Status</p>
              <p className={`text-lg font-semibold ${
                settings.payment_enabled ? 'text-green-400' : 'text-red-400'
              }`}>
                {settings.payment_enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Current Mode</p>
              <p className="text-lg font-semibold text-white">
                {settings.payment_disabled_mode ? 'Disabled' : 'Enabled'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <i className="ri-information-line text-slate-400 text-xl flex-shrink-0"></i>
          <div className="flex-1">
            <h4 className="text-white font-semibold mb-2">How Payment Disabled Mode Works</h4>
            <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
              <li>When <strong>enabled</strong>, all payment features are disabled</li>
              <li>Users see: "Payments are currently unavailable. Please try again later."</li>
              <li>Deposit and withdrawal buttons are hidden/disabled</li>
              <li>No payment API calls are made</li>
              <li>Can only be enabled if payment gateway is configured</li>
              <li>Default to disabled if payment gateway is not set up</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
