import { formatDistanceToNow } from 'date-fns';

interface RealtimeStatusIndicatorProps {
  isConnected: boolean;
  lastUpdated: Date | null;
  error?: string | null;
  className?: string;
}

export function RealtimeStatusIndicator({
  isConnected,
  lastUpdated,
  error,
  className = '',
}: RealtimeStatusIndicatorProps) {
  if (error) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-red-600 font-medium">Connection Error</span>
        </div>
        <span className="text-gray-400">•</span>
        <span className="text-gray-500">{error}</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          <span className="text-amber-600 font-medium">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <span className="text-emerald-600 font-medium">Live</span>
      </div>
      {lastUpdated && (
        <>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">
            Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </span>
        </>
      )}
    </div>
  );
}
