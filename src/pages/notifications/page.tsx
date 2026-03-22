import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../lib/localeUtils';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  type: 'transaction' | 'security' | 'promotion' | 'system';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications] = useState<Notification[]>([]);

  const markAllAsRead = () => {
  };

  return (
    <div className="min-h-screen bg-dark-bg pb-24">
      <div className="bg-dark-card border-b border-dark-border">
        <div className="flex items-center justify-between px-6 pt-12 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-arrow-left-s-line text-xl text-neutral-300"></i>
          </button>
          <h1 className="text-lg font-semibold text-white">Notifications</h1>
          <button 
            onClick={markAllAsRead}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-dark-elevated transition-colors"
          >
            <i className="ri-check-double-line text-xl text-neutral-300"></i>
          </button>
        </div>
      </div>

      <main id="main-content" className="px-6 pt-8" tabIndex={-1}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 mb-6 rounded-2xl bg-dark-elevated flex items-center justify-center">
              <i className="ri-notification-3-line text-4xl text-neutral-500"></i>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No notifications</h2>
            <p className="text-neutral-400 text-center">All notifications will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-dark-card rounded-xl p-4 border transition-colors ${
                  notification.read ? 'border-dark-border' : 'border-lime-500/30 bg-lime-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'transaction' ? 'bg-lime-500/20' :
                    notification.type === 'security' ? 'bg-red-500/20' :
                    notification.type === 'promotion' ? 'bg-amber-500/20' :
                    'bg-dark-elevated'
                  }`}>
                    <i className={`text-lg ${
                      notification.type === 'transaction' ? 'ri-exchange-line text-lime-400' :
                      notification.type === 'security' ? 'ri-shield-line text-red-400' :
                      notification.type === 'promotion' ? 'ri-gift-line text-amber-400' :
                      'ri-notification-line text-neutral-400'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white truncate">{notification.title}</h3>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-lime-500 rounded-full flex-shrink-0 ml-2"></div>
                      )}
                    </div>
                    <p className="text-sm text-neutral-400 line-clamp-2">{notification.message}</p>
                    <span className="text-xs text-neutral-500 mt-2 block">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
