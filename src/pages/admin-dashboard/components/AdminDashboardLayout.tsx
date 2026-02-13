import { ReactNode, useState } from 'react';

type AdminTab = 'overview' | 'users' | 'balances' | 'ledger' | 'withdrawals' | 'deposits' | 'risk' | 'support' | 'kyc' | 'activity' | 'giftcards' | 'cardtx' | 'data' | 'localuserdb';

interface AdminDashboardLayoutProps {
  adminUser: any;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onSignOut: () => void;
  children: ReactNode;
}

export default function AdminDashboardLayout({
  adminUser,
  activeTab,
  onTabChange,
  onSignOut,
  children,
}: AdminDashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', subtitle: 'Platform metrics', icon: 'ri-dashboard-3-line' },
    { id: 'users', label: 'Users', subtitle: 'Manage accounts', icon: 'ri-user-line' },
    { id: 'balances', label: 'Balances', subtitle: 'Account balances', icon: 'ri-wallet-3-line' },
    { id: 'ledger', label: 'Ledger', subtitle: 'Audit trail', icon: 'ri-file-list-3-line' },
    { id: 'withdrawals', label: 'Withdrawals', subtitle: 'Process requests', icon: 'ri-arrow-right-up-line' },
    { id: 'deposits', label: 'Add Funds', subtitle: 'User deposits', icon: 'ri-coin-line' },
    { id: 'giftcards', label: 'Gift Cards', subtitle: 'Buy/Sell requests', icon: 'ri-gift-line' },
    { id: 'cardtx', label: 'Card Txns', subtitle: 'Card activity', icon: 'ri-bank-card-2-line' },
    { id: 'risk', label: 'Risk Monitor', subtitle: 'Fraud detection', icon: 'ri-shield-check-line' },
    { id: 'support', label: 'Support', subtitle: 'Tickets', icon: 'ri-customer-service-2-line' },
    { id: 'kyc', label: 'KYC', subtitle: 'Verification', icon: 'ri-user-search-line' },
    { id: 'activity', label: 'My Activity', subtitle: 'Admin actions', icon: 'ri-history-line' },
    { id: 'data', label: 'Data', subtitle: 'DB Explorer', icon: 'ri-database-2-line' },
    { id: 'localuserdb', label: 'Local User DB', subtitle: 'Users, sessions, wallets', icon: 'ri-database-2-line' },
  ];

  if (!adminUser) {
    console.error('AdminDashboardLayout: adminUser prop is required');
    return null;
  }

  const handleTabClick = (tabId: AdminTab) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside 
        className={`hidden lg:flex flex-col bg-[#1e293b] border-r border-slate-700/50 transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <i className="ri-bank-card-line text-white text-xl"></i>
            </div>
            {!sidebarCollapsed && (
              <div className="animate-fadeIn">
                <h1 className="text-lg font-bold text-white">CardXC</h1>
                <p className="text-xs text-slate-400">Admin Portal</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/5'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                }`}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  isActive 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-slate-700/50 text-slate-400 group-hover:bg-slate-600/50 group-hover:text-white'
                }`}>
                  <i className={`${tab.icon} text-lg`}></i>
                </div>
                {!sidebarCollapsed && (
                  <div className="text-left min-w-0 animate-fadeIn">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-400' : ''}`}>
                      {tab.label}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{tab.subtitle}</p>
                  </div>
                )}
                {isActive && !sidebarCollapsed && (
                  <div className="ml-auto w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors cursor-pointer"
          >
            <i className={`ri-side-bar-${sidebarCollapsed ? 'fill' : 'line'} text-lg`}></i>
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="relative w-72 bg-[#1e293b] flex flex-col animate-slideIn">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="ri-bank-card-line text-white text-xl"></i>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">CardXC</h1>
                  <p className="text-xs text-slate-400">Admin Portal</p>
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-slate-400 text-xl"></i>
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id as AdminTab)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-emerald-500/20' : 'bg-slate-700/50'
                    }`}>
                      <i className={`${tab.icon} text-lg`}></i>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">{tab.label}</p>
                      <p className="text-xs text-slate-500">{tab.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="lg:hidden p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <i className="ri-menu-line text-slate-400 text-xl"></i>
                </button>
                
                <div className="hidden sm:block">
                  <h2 className="text-lg font-bold text-white capitalize">
                    {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {tabs.find(t => t.id === activeTab)?.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-emerald-400">Admin</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium text-white">{adminUser?.full_name || 'Admin'}</p>
                    <p className="text-xs text-slate-400">{adminUser?.email || 'admin@yourcompany.com'}</p>
                  </div>
                  
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                    {adminUser?.full_name?.charAt(0).toUpperCase() || 'A'}
                  </div>

                  <button
                    onClick={onSignOut}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all duration-200 cursor-pointer group"
                    title="Sign Out"
                  >
                    <i className="ri-logout-box-r-line text-slate-400 group-hover:text-white"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <div className="animate-fadeIn">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideIn {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
