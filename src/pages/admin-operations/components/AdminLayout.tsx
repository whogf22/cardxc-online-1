import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Admin layout with header, navigation, and protected access
export default function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const loadAdminProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setAdminEmail(session.user.email || 'Admin');
      }
    };
    loadAdminProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/signin');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'users', label: 'Users', icon: 'ri-user-line' },
    { id: 'balances', label: 'Wallet Balances', icon: 'ri-wallet-line' },
    { id: 'ledger', label: 'Ledger Explorer', icon: 'ri-file-list-line' },
    { id: 'withdrawals', label: 'Withdrawals', icon: 'ri-bank-card-line' },
    { id: 'risk', label: 'Risk Monitor', icon: 'ri-shield-check-line' },
    { id: 'payments', label: 'Payment Settings', icon: 'ri-bank-card-2-line' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Header - Fixed */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <i className="ri-bank-card-2-line text-white text-xl"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-['Space_Grotesk']">
                    CardXC Admin
                  </h1>
                  <p className="text-xs text-slate-500">Operations Dashboard</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                SUPER ADMIN ACCESS
              </span>
            </div>

            {/* Admin User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {adminEmail.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">{adminEmail}</p>
                  <p className="text-xs text-slate-500">Administrator</p>
                </div>
                <i className="ri-arrow-down-s-line text-slate-400"></i>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <i className="ri-logout-box-line"></i>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-t border-slate-200">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
                  activeTab === tab.id
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {children}
      </main>

      {/* Security Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 mt-12">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <i className="ri-shield-check-line text-green-600"></i>
              Secure Admin Access
            </span>
            <span className="flex items-center gap-1">
              <i className="ri-lock-line text-sky-600"></i>
              All actions logged server-side
            </span>
          </div>
          <span>CardXC Admin Dashboard v1.0</span>
        </div>
      </footer>
    </div>
  );
}
