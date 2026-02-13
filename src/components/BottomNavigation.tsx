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
  { path: '/transfer', icon: 'ri-send-plane-line', activeIcon: 'ri-send-plane-fill', label: 'Transfer', shortLabel: 'Send' },
  { path: '/cards', icon: 'ri-bank-card-line', activeIcon: 'ri-bank-card-fill', label: 'Prepaid Card', shortLabel: 'Card' },
  { path: '/profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill', label: 'Account', shortLabel: 'Account' },
];

export default function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/5 px-2 z-50" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around max-w-lg mx-auto py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/dashboard' && location.pathname === '/');

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 min-w-[56px] py-1 transition-all ${isActive ? 'text-lime-400' : 'text-gray-500'
                }`}
            >
              <i className={`${isActive ? item.activeIcon : item.icon} text-xl`}></i>
              <span className={`text-[10px] font-medium text-center`}>
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
