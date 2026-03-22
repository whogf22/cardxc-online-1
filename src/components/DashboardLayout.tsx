import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

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
  { path: '/create-virtual-card', icon: 'ri-add-circle-line', label: 'Create Virtual Card' },
  { path: '/savings', icon: 'ri-safe-2-line', label: 'Savings' },
  { path: '/rewards', icon: 'ri-gift-line', label: 'Rewards' },
];

const secondaryNavItems: NavItem[] = [
  { path: '/dashboard/data', icon: 'ri-database-2-line', label: 'My Data' },
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
    <div className="min-h-screen bg-dark-bg w-full min-w-0 overflow-x-hidden">
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-dark-card border-r border-dark-border hidden lg:flex flex-col z-40">
        <div className="p-6 border-b border-dark-border">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center">
              <i className="ri-bank-card-fill text-xl text-black"></i>
            </div>
            <span className="text-xl font-bold text-white">CardXC</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="mb-4">
            <p className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Main</p>
            {mainNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-lime-500/20 text-lime-400'
                      : 'text-neutral-400 hover:bg-dark-elevated hover:text-white'
                  }`}
                >
                  <i className={`${item.icon} text-xl ${isActive ? 'text-lime-400' : ''}`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div>
            <p className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Account</p>
            {secondaryNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-lime-500/20 text-lime-400'
                      : 'text-neutral-400 hover:bg-dark-elevated hover:text-white'
                  }`}
                >
                  <i className={`${item.icon} text-xl ${isActive ? 'text-lime-400' : ''}`}></i>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-dark-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-dark-elevated rounded-full flex items-center justify-center">
              <i className="ri-user-line text-neutral-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <i className="ri-logout-box-r-line text-lg"></i>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-dark-card/95 backdrop-blur-lg border-b border-dark-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="lg:hidden flex items-center gap-2">
                  <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center">
                    <i className="ri-bank-card-fill text-black"></i>
                  </div>
                  <span className="font-bold text-white">CardXC</span>
                </Link>
                {title && (
                  <div className="hidden sm:block">
                    <h1 className="text-xl font-semibold text-white">{title}</h1>
                    {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {action}
                <Link
                  to="/notifications"
                  className="relative p-2 text-neutral-400 hover:text-lime-400 transition-colors"
                >
                  <i className="ri-notification-3-line text-xl"></i>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6 w-full min-w-0" tabIndex={-1}>
          {title && (
            <div className="sm:hidden mb-4">
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>

    </div>
  );
}
