import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { useAuthContext } from '../../contexts/AuthContext';
import { useToastContext } from '../../contexts/ToastContext';
import { normalizeError } from '../../utils/errorHandler';
import AdminDashboardLayout from './components/AdminDashboardLayout';
import OverviewTab from './components/OverviewTab';
import UsersTab from './components/UsersTab';
import WalletBalancesTab from './components/WalletBalancesTab';
import LedgerExplorerTab from './components/LedgerExplorerTab';
import WithdrawalsTab from './components/WithdrawalsTab';
import RiskMonitorTab from './components/RiskMonitorTab';
import SupportTicketsTab from './components/SupportTicketsTab';
import KYCManagementTab from './components/KYCManagementTab';
import DepositForUserTab from './components/DepositForUserTab';
import MyActivityTab from './components/MyActivityTab';
import GiftCardRequestsTab from './components/GiftCardRequestsTab';
import CardTransactionsTab from './components/CardTransactionsTab';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import AlertConfigModal from './components/AlertConfigModal';

type AdminTab = 'overview' | 'users' | 'balances' | 'ledger' | 'withdrawals' | 'deposits' | 'risk' | 'support' | 'kyc' | 'activity' | 'giftcards' | 'cardtx';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  
  const { user, loading, isAdmin, error: authError, signOut } = useAuthContext();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/signin', { replace: true });
    }
  }, [user, loading, isAdmin, navigate]);

  const toast = useToastContext();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      const normalized = normalizeError(err);
      toast.error(normalized.message);
    }
  };

  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      setRefreshKey(prev => prev + 1);
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    } catch (error) {
      console.error('Refresh failed:', error);
      setIsRefreshing(false);
    }
  };

  const handleExportReport = async () => {
    try {
      adminApi.exportAuditLogs();
      toast.success('Downloading audit report...');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export report. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-medium">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (authError || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-slate-700">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-cross-line text-3xl text-red-500"></i>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">
            {authError || 'Admin privileges required to access this dashboard.'}
          </p>
          <button
            onClick={() => navigate('/signin')}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/25"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AdminDashboardLayout
        adminUser={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
      >
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all duration-200 border border-slate-700 hover:border-slate-600 disabled:opacity-50 cursor-pointer"
            >
              <i className={`ri-refresh-line text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`}></i>
              <span className="text-sm font-medium text-white">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>

            <button 
              onClick={handleExportReport}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all duration-200 border border-slate-700 hover:border-slate-600 cursor-pointer"
            >
              <i className="ri-download-line text-blue-400"></i>
              <span className="text-sm font-medium text-white">Export Report</span>
            </button>

            <button 
              onClick={() => setShowAlertConfig(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all duration-200 border border-slate-700 hover:border-slate-600 cursor-pointer"
            >
              <i className="ri-notification-3-line text-amber-400"></i>
              <span className="text-sm font-medium text-white">Alerts</span>
            </button>
          </div>

          {activeTab === 'overview' && <OverviewTab key={`overview-${refreshKey}`} />}
          {activeTab === 'users' && <UsersTab key={`users-${refreshKey}`} />}
          {activeTab === 'balances' && <WalletBalancesTab key={`balances-${refreshKey}`} />}
          {activeTab === 'ledger' && <LedgerExplorerTab key={`ledger-${refreshKey}`} />}
          {activeTab === 'withdrawals' && <WithdrawalsTab key={`withdrawals-${refreshKey}`} />}
          {activeTab === 'deposits' && <DepositForUserTab key={`deposits-${refreshKey}`} />}
          {activeTab === 'risk' && <RiskMonitorTab key={`risk-${refreshKey}`} />}
          {activeTab === 'support' && <SupportTicketsTab key={`support-${refreshKey}`} />}
          {activeTab === 'kyc' && <KYCManagementTab key={`kyc-${refreshKey}`} />}
          {activeTab === 'activity' && <MyActivityTab key={`activity-${refreshKey}`} />}
          {activeTab === 'giftcards' && <GiftCardRequestsTab key={`giftcards-${refreshKey}`} />}
          {activeTab === 'cardtx' && <CardTransactionsTab key={`cardtx-${refreshKey}`} />}
        </div>
      </AdminDashboardLayout>

      {showAlertConfig && (
        <AlertConfigModal onClose={() => setShowAlertConfig(false)} />
      )}
    </ErrorBoundary>
  );
}
