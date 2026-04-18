import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { getCartoonAvatarUrl } from '../../../utils/avatar';

interface Notification {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  transactionId?: string;
}

export default function DashboardHeader() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    try {
      const result = await userApi.getTransactions({ limit: 10 });
      if (!result.success || !result.data?.transactions) {
        setNotifications([]);
        return;
      }
      const notifs: Notification[] = result.data.transactions.map((entry: any) => ({
        id: entry.id,
        type: entry.type === 'deposit' ? 'deposit' : entry.type === 'withdrawal' ? 'withdrawal' : 'transfer',
        title: getNotificationTitle(entry.type, entry.status),
        message: getNotificationMessage(entry.type, entry.amount, entry.currency),
        timestamp: new Date(entry.created_at),
        read: isOlderThan24Hours(entry.created_at),
      }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (_err) {
      setNotifications([]);
    }
  };

  const getNotificationTitle = (type: string, status: string) => {
    if (status === 'completed') {
      return type === 'deposit' ? 'Deposit Completed' : type === 'withdrawal' ? 'Withdrawal Completed' : 'Transaction Completed';
    }
    if (status === 'pending') {
      return type === 'deposit' ? 'Deposit Pending' : type === 'withdrawal' ? 'Withdrawal Pending' : 'Transaction Pending';
    }
    return 'Transaction Update';
  };

  const getNotificationMessage = (type: string, amount: number, currency: string) => {
    if (type === 'deposit') return `Your deposit of ${amount} ${currency} has been processed successfully`;
    if (type === 'withdrawal') return `Your withdrawal of ${amount} ${currency} has been processed`;
    return `Transaction of ${amount} ${currency} completed`;
  };

  const isOlderThan24Hours = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    return (now.getTime() - created.getTime()) / (1000 * 60 * 60) > 24;
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    setShowNotifications(false);
    navigate('/transactions', { state: { highlightId: notification.transactionId } });
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingIcon = hour < 12 ? 'ri-sun-line' : hour < 17 ? 'ri-sun-foggy-line' : 'ri-moon-line';

  return (
    <header className="px-5 pt-4 pb-2 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
      <div className="flex items-center justify-between">
        {/* Left: Avatar + Greeting */}
        <div className="flex items-center gap-3">
          <div
            className="relative cursor-pointer group"
            onClick={() => navigate('/profile')}
          >
            {/* Animated gradient ring */}
            <div
              className="absolute -inset-[2px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'conic-gradient(from 0deg, #84CC16, #65a30d, #bef264, #84CC16)',
                animation: 'avatarRingSpin 4s linear infinite',
              }}
            />
            <div className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-dark-bg border-2 border-dark-bg">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                <img src={getCartoonAvatarUrl((user?.id || user?.email || 'default').toString(), 96)} alt="" className="w-full h-full object-cover rounded-full" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <i className={`${greetingIcon} text-amber-400/80 text-xs`}></i>
              <p className="text-neutral-500 text-xs font-medium">{greeting}</p>
            </div>
            <h1 className="text-white text-base font-bold tracking-tight mt-0.5" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}>
              {displayName}
            </h1>
          </div>
        </div>

        {/* Right: Notification */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/[0.06]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <i className="ri-notification-3-line text-neutral-400 text-lg"></i>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-lime-400 text-black text-[10px] font-bold rounded-full flex items-center justify-center"
                style={{ boxShadow: '0 0 10px rgba(132,204,22,0.5)', animation: 'notifGlow 2s ease-in-out infinite' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown with glassmorphism */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div
                className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl z-50 max-h-[24rem] overflow-hidden flex flex-col animate-scale-in"
                style={{
                  background: 'linear-gradient(145deg, rgba(20,20,20,0.95), rgba(13,13,13,0.98))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(40px)',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.4)',
                }}
              >
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-lime-400 font-medium cursor-pointer hover:text-lime-300 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <i className="ri-notification-off-line text-neutral-700 text-3xl mb-2"></i>
                      <p className="text-sm text-neutral-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-all duration-200 cursor-pointer ${
                          !notification.read ? 'bg-lime-400/[0.03]' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              notification.type === 'deposit' ? 'bg-lime-500/10 border border-lime-500/20'
                              : notification.type === 'withdrawal' ? 'bg-orange-500/10 border border-orange-500/20'
                              : 'bg-blue-500/10 border border-blue-500/20'
                            }`}
                          >
                            <i className={`${
                              notification.type === 'deposit' ? 'ri-arrow-down-line text-lime-400'
                              : notification.type === 'withdrawal' ? 'ri-arrow-up-line text-orange-400'
                              : 'ri-exchange-line text-blue-400'
                            } text-sm`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-white">{notification.title}</p>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-lime-400 rounded-full flex-shrink-0 mt-1" style={{ boxShadow: '0 0 6px rgba(132,204,22,0.5)' }} />
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{notification.message}</p>
                            <p className="text-[10px] text-neutral-600 mt-0.5">{getTimeAgo(notification.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-white/[0.06]">
                    <button
                      onClick={() => { setShowNotifications(false); navigate('/transactions'); }}
                      className="w-full text-xs text-lime-400 font-medium cursor-pointer hover:text-lime-300 transition-colors"
                    >
                      View all transactions
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes avatarRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes notifGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(132,204,22,0.4); }
          50% { box-shadow: 0 0 16px rgba(132,204,22,0.7); }
        }
      `}</style>
    </header>
  );
}
