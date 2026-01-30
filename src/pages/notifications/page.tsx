import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNavigation from '../../components/BottomNavigation';

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
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-6 pt-12 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100"
          >
            <i className="ri-arrow-left-s-line text-xl text-gray-600"></i>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          <button 
            onClick={markAllAsRead}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100"
          >
            <i className="ri-check-double-line text-xl text-gray-600"></i>
          </button>
        </div>
      </div>

      <main className="px-6 pt-8">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-32 h-32 mb-6 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <rect x="25" y="10" width="50" height="70" rx="4" fill="none" stroke="#E5E7EB" strokeWidth="2"/>
                <line x1="35" y1="25" x2="65" y2="25" stroke="#E5E7EB" strokeWidth="2"/>
                <line x1="35" y1="35" x2="55" y2="35" stroke="#E5E7EB" strokeWidth="2"/>
                <rect x="25" y="50" width="50" height="30" rx="2" fill="none" stroke="#E5E7EB" strokeWidth="2"/>
                <line x1="35" y1="60" x2="65" y2="60" stroke="#E5E7EB" strokeWidth="2"/>
                <line x1="35" y1="70" x2="55" y2="70" stroke="#E5E7EB" strokeWidth="2"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No notifications</h2>
            <p className="text-gray-500 text-center">All notifications will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl p-4 border ${
                  notification.read ? 'border-gray-100' : 'border-fintech-200 bg-fintech-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'transaction' ? 'bg-blue-100' :
                    notification.type === 'security' ? 'bg-red-100' :
                    notification.type === 'promotion' ? 'bg-yellow-100' :
                    'bg-gray-100'
                  }`}>
                    <i className={`text-lg ${
                      notification.type === 'transaction' ? 'ri-exchange-line text-blue-600' :
                      notification.type === 'security' ? 'ri-shield-line text-red-600' :
                      notification.type === 'promotion' ? 'ri-gift-line text-yellow-600' :
                      'ri-notification-line text-gray-600'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{notification.title}</h3>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-fintech-500 rounded-full flex-shrink-0 ml-2"></div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                    <span className="text-xs text-gray-400 mt-2 block">
                      {new Date(notification.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
