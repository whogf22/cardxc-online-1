import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import BottomNavigation from './BottomNavigation';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const mainNavItems: NavItem[] = [
  { path: '/dashboard', icon: 'ri-home-5-line', label: 'Home' },
  { path: '/wallet', icon: 'ri-wallet-3-line', label: 'Wallet' },
  { path: '/payments', icon: 'ri-exchange-funds-line', label: 'Payments' },
  { path: '/cards', icon: 'ri-bank-card-line', label: 'Cards' },
  { path: '/savings', icon: 'ri-safe-2-line', label: 'Savings' },
  { path: '/rewards', icon: 'ri-gift-line', label: 'Rewards' },
];

const secondaryNavItems: NavItem[] = [
  { path: '/transactions', icon: 'ri-file-list-3-line', label: 'Transactions' },
  { path: '/profile', icon: 'ri-user-settings-line', label: 'Settings' },
  { path: '/support', icon: 'ri-question-line', label: 'Support' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function DashboardLayout({ children, title, subtitle, action }: DashboardLayoutProps) {
  const location = useLocation();
  const { user, signOut } = useAuthContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col z-40">
        <div className="p-6 border-b border-slate-100">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center">
              <i className="ri-bank-card-fill text-xl text-white"></i>
            </div>
            <span className="text-xl font-bold text-slate-900">CardXC</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="mb-4">
            <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Main</p>
            {mainNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <i className={`${item.icon} text-xl ${isActive ? 'text-sky-600' : ''}`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div>
            <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Account</p>
            {secondaryNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <i className={`${item.icon} text-xl ${isActive ? 'text-sky-600' : ''}`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
              <i className="ri-user-line text-slate-600"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Sign out"
            >
              <i className="ri-logout-box-r-line text-lg"></i>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="lg:hidden flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-sky-600 rounded-lg flex items-center justify-center">
                    <i className="ri-bank-card-fill text-white"></i>
                  </div>
                  <span className="font-bold text-slate-900">CardXC</span>
                </Link>
                {title && (
                  <div className="hidden sm:block">
                    <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
                    {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {action}
                <Link
                  to="/notifications"
                  className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <i className="ri-notification-3-line text-xl"></i>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
          {title && (
            <div className="sm:hidden mb-4">
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}
