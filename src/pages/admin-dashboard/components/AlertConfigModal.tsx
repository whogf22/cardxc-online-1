import { useState, useEffect } from 'react';
import { useToastContext } from '../../../contexts/ToastContext';

interface AlertConfigModalProps {
  onClose: () => void;
}

interface AlertConfig {
  largeTransactionThreshold: number;
  multipleFailedLoginsThreshold: number;
  suspiciousActivityEnabled: boolean;
  withdrawalApprovalEnabled: boolean;
  lowBalanceThreshold: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export default function AlertConfigModal({ onClose }: AlertConfigModalProps) {
  const toast = useToastContext();
  const [config, setConfig] = useState<AlertConfig>({
    largeTransactionThreshold: 10000,
    multipleFailedLoginsThreshold: 5,
    suspiciousActivityEnabled: true,
    withdrawalApprovalEnabled: true,
    lowBalanceThreshold: 100,
    emailNotifications: true,
    pushNotifications: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Load from localStorage for now (can be moved to database)
      const saved = localStorage.getItem('admin_alert_config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage (can be moved to database)
      localStorage.setItem('admin_alert_config', JSON.stringify(config));
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <i className="ri-notification-3-line text-amber-400 text-xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Alert Configuration</h2>
              <p className="text-sm text-slate-400">Configure system alerts and notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-slate-400 text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Transaction Alerts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Transaction Alerts</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Large Transaction Threshold (USD)</label>
              <input
                type="number"
                value={config.largeTransactionThreshold}
                onChange={(e) => setConfig({ ...config, largeTransactionThreshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                min="0"
                step="100"
              />
              <p className="text-xs text-slate-500">Alert when a transaction exceeds this amount</p>
            </div>
          </div>

          {/* Security Alerts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Security Alerts</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Failed Login Attempts Threshold</label>
              <input
                type="number"
                value={config.multipleFailedLoginsThreshold}
                onChange={(e) => setConfig({ ...config, multipleFailedLoginsThreshold: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                min="1"
                max="10"
              />
              <p className="text-xs text-slate-500">Alert after this many failed login attempts</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Suspicious Activity Detection</p>
                <p className="text-xs text-slate-400">Monitor for unusual patterns</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, suspiciousActivityEnabled: !config.suspiciousActivityEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  config.suspiciousActivityEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.suspiciousActivityEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Withdrawal Alerts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Withdrawal Alerts</h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-white">Withdrawal Approval Notifications</p>
                <p className="text-xs text-slate-400">Alert when withdrawals need approval</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, withdrawalApprovalEnabled: !config.withdrawalApprovalEnabled })}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  config.withdrawalApprovalEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.withdrawalApprovalEnabled ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Balance Alerts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Balance Alerts</h3>
            
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Low Balance Threshold (USD)</label>
              <input
                type="number"
                value={config.lowBalanceThreshold}
                onChange={(e) => setConfig({ ...config, lowBalanceThreshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                min="0"
                step="10"
              />
              <p className="text-xs text-slate-500">Alert when system balance falls below this amount</p>
            </div>
          </div>

          {/* Notification Channels */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Notification Channels</h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <i className="ri-mail-line text-sky-400 text-xl"></i>
                <div>
                  <p className="text-sm font-medium text-white">Email Notifications</p>
                  <p className="text-xs text-slate-400">Receive alerts via email</p>
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, emailNotifications: !config.emailNotifications })}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  config.emailNotifications ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.emailNotifications ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <i className="ri-notification-badge-line text-purple-400 text-xl"></i>
                <div>
                  <p className="text-sm font-medium text-white">Push Notifications</p>
                  <p className="text-xs text-slate-400">Receive browser push notifications</p>
                </div>
              </div>
              <button
                onClick={() => setConfig({ ...config, pushNotifications: !config.pushNotifications })}
                className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                  config.pushNotifications ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.pushNotifications ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
              <i className="ri-checkbox-circle-line text-emerald-400 text-xl"></i>
              <p className="text-sm text-emerald-400">Configuration saved successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
