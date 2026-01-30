import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  path: string;
  icon: string;
  activeIcon: string;
  label: string;
  shortLabel: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill', label: 'Home', shortLabel: 'Home' },
  { path: '/wallet', icon: 'ri-wallet-3-line', activeIcon: 'ri-wallet-3-fill', label: 'Wallet', shortLabel: 'Wallet' },
  { path: '/cards', icon: 'ri-bank-card-line', activeIcon: 'ri-bank-card-fill', label: 'Prepaid Card', shortLabel: 'Card' },
  { path: '/profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Account', shortLabel: 'Account' },
];

export default function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 sm:px-6 py-2 sm:py-3 z-50" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path === '/dashboard' && location.pathname === '/');
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 sm:gap-1 transition-colors min-w-0 px-1 py-1 ${
                isActive ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              <i className={`${isActive ? item.activeIcon : item.icon} text-lg sm:text-xl`}></i>
              <span className={`text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-none text-center ${isActive ? 'font-medium' : ''}`}>
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
