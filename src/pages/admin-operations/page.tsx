import { useState } from 'react';
import AdminRoute from '../../components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import OverviewTab from './components/OverviewTab';
import UsersTab from './components/UsersTab';
import WalletBalancesTab from './components/WalletBalancesTab';
import LedgerExplorerTab from './components/LedgerExplorerTab';
import WithdrawalsTab from './components/WithdrawalsTab';
import RiskMonitorTab from './components/RiskMonitorTab';
import PaymentSettingsTab from './components/PaymentSettingsTab';

// Admin operations dashboard - read-only data access, mutations via API Gateway only
export default function AdminOperations() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'users':
        return <UsersTab />;
      case 'balances':
        return <WalletBalancesTab />;
      case 'ledger':
        return <LedgerExplorerTab />;
      case 'withdrawals':
        return <WithdrawalsTab />;
      case 'risk':
        return <RiskMonitorTab />;
      case 'payments':
        return <PaymentSettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <AdminRoute>
      <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent()}
      </AdminLayout>
    </AdminRoute>
  );
}
