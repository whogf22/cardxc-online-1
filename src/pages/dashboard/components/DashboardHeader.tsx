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
        console.warn('Failed to load notifications:', result.error);
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
    } catch (err) {
      console.warn('Failed to load notifications:', err);
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
    if (type === 'deposit') {
      return `Your deposit of ${amount} ${currency} has been processed successfully`;
    }
    if (type === 'withdrawal') {
      return `Your withdrawal of ${amount} ${currency} has been processed`;
    }
    return `Transaction of ${amount} ${currency} completed`;
  };

  const isOlderThan24Hours = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    return diffHours > 24;
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setShowNotifications(false);
    navigate('/transactions', { state: { highlightId: notification.transactionId } });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';

  const getAvatarAnimation = () => {
    const seed = (user?.id || user?.email || 'default').toString();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    const idx = Math.abs(hash) % 5;
    return ['avatar-bounce', 'avatar-wiggle', 'avatar-float', 'avatar-pulse', 'avatar-pop'][idx];
  };

  return (
    <header className="px-5 pt-4 pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer overflow-hidden bg-[#fde047]/20 ${getAvatarAnimation()}`}
            onClick={() => navigate('/profile')}
          >
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <img src={getCartoonAvatarUrl((user?.id || user?.email || 'default').toString(), 96)} alt="" className="w-full h-full object-cover rounded-full" />
            )}
          </div>
          <div>
            <h1 className="text-white text-lg font-semibold">
              Hello, {displayName}
            </h1>
            <p className="text-gray-500 text-xs">Welcome Back</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-11 h-11 flex items-center justify-center rounded-full bg-[#1a1a1a] border border-white/10 cursor-pointer"
          >
            <i className="ri-notification-3-line text-white text-lg"></i>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-lime-400 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-[#1a1a1a] rounded-2xl border border-white/10 z-50 max-h-[24rem] overflow-hidden flex flex-col shadow-2xl">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-lime-400 font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <i className="ri-notification-off-line text-gray-600 text-3xl mb-2"></i>
                      <p className="text-sm text-gray-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                          !notification.read ? 'bg-lime-400/5' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                              notification.type === 'deposit'
                                ? 'bg-emerald-500/20'
                                : notification.type === 'withdrawal'
                                ? 'bg-orange-500/20'
                                : 'bg-blue-500/20'
                            }`}
                          >
                            <i
                              className={`${
                                notification.type === 'deposit'
                                  ? 'ri-arrow-down-line text-emerald-400'
                                  : notification.type === 'withdrawal'
                                  ? 'ri-arrow-up-line text-orange-400'
                                  : 'ri-exchange-line text-blue-400'
                              } text-sm`}
                            ></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-white">{notification.title}</p>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-lime-400 rounded-full flex-shrink-0 mt-1"></span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{notification.message}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{getTimeAgo(notification.timestamp)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-white/10">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/transactions');
                      }}
                      className="w-full text-xs text-lime-400 font-medium cursor-pointer"
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
        @keyframes avatarBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes avatarWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-8deg); }
          75% { transform: rotate(8deg); }
        }
        @keyframes avatarFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes avatarPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(132, 204, 22, 0.4); }
          50% { opacity: 0.95; box-shadow: 0 0 0 8px rgba(132, 204, 22, 0); }
        }
        @keyframes avatarPop {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.1); }
          50% { transform: scale(0.95); }
          75% { transform: scale(1.05); }
        }
        .avatar-bounce { animation: avatarBounce 2s ease-in-out infinite; }
        .avatar-wiggle { animation: avatarWiggle 1.5s ease-in-out infinite; }
        .avatar-float { animation: avatarFloat 2.5s ease-in-out infinite; }
        .avatar-pulse { animation: avatarPulse 2s ease-in-out infinite; }
        .avatar-pop { animation: avatarPop 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .avatar-bounce, .avatar-wiggle, .avatar-float, .avatar-pulse, .avatar-pop { animation: none; }
        }
      `}</style>
    </header>
  );
}
