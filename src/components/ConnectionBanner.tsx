import { useConnectionState } from '../hooks/useConnectionState';

export function ConnectionBanner() {
  const { isOnline, wasOffline } = useConnectionState();

  if (isOnline && !wasOffline) {
    return null;
  }

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="ri-wifi-off-line text-xl"></i>
            <div>
              <p className="font-semibold">No Internet Connection</p>
              <p className="text-sm text-red-100">
                Please check your network connection. Your data is safe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse"></div>
            <span className="text-sm">Reconnecting...</span>
          </div>
        </div>
      </div>
    );
  }

  if (wasOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <i className="ri-wifi-line text-xl"></i>
          <div>
            <p className="font-semibold">Connection Restored</p>
            <p className="text-sm text-green-100">
              You're back online. All systems operational.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
