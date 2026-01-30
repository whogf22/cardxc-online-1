import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, authApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

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
    } catch (err) {
      console.warn('Failed to load notifications:', err);
      setNotifications([]);
    }
  };

  const addNewNotification = (entry: any) => {
    const newNotif: Notification = {
      id: entry.id,
      type: entry.type === 'deposit' ? 'deposit' : entry.type === 'withdrawal' ? 'withdrawal' : 'transfer',
      title: getNotificationTitle(entry.type, entry.status),
      message: getNotificationMessage(entry.type, entry.amount, entry.currency),
      timestamp: new Date(entry.created_at),
      read: false,
      transactionId: entry.id,
    };

    setNotifications((prev) => [newNotif, ...prev.slice(0, 9)]);
    setUnreadCount((prev) => prev + 1);
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

  const handleLogout = async () => {
    await authApi.signOut();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <i className="ri-exchange-dollar-line text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">CardXC</h1>
              <p className="text-xs text-slate-500">Digital Payments</p>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Notifications - FIXED: Badge positioning */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <i className="ri-notification-3-line text-slate-600 text-xl"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[32rem] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <i className="ri-notification-off-line text-slate-300 text-4xl mb-2"></i>
                          <p className="text-sm text-slate-500">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                              !notification.read ? 'bg-teal-50/30' : ''
                            }`}
                          >
                            <div className="flex gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  notification.type === 'deposit'
                                    ? 'bg-green-100'
                                    : notification.type === 'withdrawal'
                                    ? 'bg-orange-100'
                                    : 'bg-blue-100'
                                }`}
                              >
                                <i
                                  className={`${
                                    notification.type === 'deposit'
                                      ? 'ri-arrow-down-line text-green-600'
                                      : notification.type === 'withdrawal'
                                      ? 'ri-arrow-up-line text-orange-600'
                                      : 'ri-exchange-line text-blue-600'
                                  } text-lg`}
                                ></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {notification.title}
                                  </p>
                                  {!notification.read && (
                                    <span className="w-2 h-2 bg-teal-500 rounded-full flex-shrink-0 mt-1.5"></span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {getTimeAgo(notification.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            navigate('/transactions');
                          }}
                          className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                        >
                          View all transactions
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-slate-500">Customer</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer text-slate-600"
                title="Sign Out"
              >
                <i className="ri-logout-box-r-line text-lg"></i>
                <span className="text-sm font-medium hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
