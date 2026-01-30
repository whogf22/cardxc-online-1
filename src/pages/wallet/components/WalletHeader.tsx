import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

interface WalletHeaderProps {
  user: any;
}

export default function WalletHeader({ user }: WalletHeaderProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <i className="ri-wallet-3-fill text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">CardXC</h1>
              <p className="text-xs text-slate-500">Secure & Fast</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
              <i className="ri-notification-3-line text-xl text-slate-600"></i>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">
                  {user?.email?.split('@')[0]}
                </span>
                <i className="ri-arrow-down-s-line text-slate-600"></i>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user?.email}</p>
                    <p className="text-xs text-slate-500 mt-1">Personal Account</p>
                  </div>
                  <a href="/wallet" className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer">
                    <i className="ri-wallet-3-line text-slate-600"></i>
                    <span className="text-sm text-slate-700">My Payment Account</span>
                  </a>
                  <a href="/transactions" className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer">
                    <i className="ri-history-line text-slate-600"></i>
                    <span className="text-sm text-slate-700">Transaction History</span>
                  </a>
                  <a href="/settings" className="flex items-center space-x-3 px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer">
                    <i className="ri-settings-3-line text-slate-600"></i>
                    <span className="text-sm text-slate-700">Settings</span>
                  </a>
                  <div className="border-t border-slate-100 mt-2 pt-2">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center space-x-3 px-4 py-2 hover:bg-red-50 transition-colors cursor-pointer w-full text-left whitespace-nowrap"
                    >
                      <i className="ri-logout-box-line text-red-600"></i>
                      <span className="text-sm text-red-600 font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
