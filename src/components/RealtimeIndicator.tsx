interface RealtimeIndicatorProps {
  isConnected: boolean;
  lastUpdated: Date | null;
  error?: string | null;
}

export function RealtimeIndicator({ isConnected, lastUpdated, error }: RealtimeIndicatorProps) {
  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
        <i className="ri-error-warning-line"></i>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
        ></div>
        <span className={isConnected ? 'text-green-600' : 'text-gray-500'}>
          {isConnected ? 'Live' : 'Offline'}
        </span>
      </div>
      {lastUpdated && (
        <>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600">Updated {getTimeAgo(lastUpdated)}</span>
        </>
      )}
    </div>
  );
}
