interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  variant?: 'light' | 'dark';
}

export function Skeleton({ 
  className = '', 
  width = '100%', 
  height = '1rem',
  variant = 'light'
}: SkeletonProps) {
  const bgClass = variant === 'dark' ? 'bg-slate-700' : 'bg-slate-200';
  
  return (
    <div
      className={`animate-pulse ${bgClass} rounded-lg ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading content"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function BalanceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton height="2rem" width="8rem" />
      <Skeleton height="1rem" width="12rem" />
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
          <Skeleton height="3rem" width="3rem" className="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="0.875rem" width="40%" />
          </div>
          <Skeleton height="1.5rem" width="6rem" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton height="2rem" width="12rem" />
        <Skeleton height="2.5rem" width="8rem" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 bg-white rounded-lg border border-gray-200">
            <Skeleton height="1rem" width="8rem" className="mb-4" />
            <Skeleton height="2rem" width="10rem" />
          </div>
        ))}
      </div>
      
      <TransactionListSkeleton />
    </div>
  );
}

export function WalletSkeleton() {
  return (
    <div className="space-y-6">
      <BalanceSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <Skeleton height="1.5rem" width="10rem" className="mb-4" />
          <Skeleton height="3rem" width="100%" />
        </div>
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <Skeleton height="1.5rem" width="10rem" className="mb-4" />
          <Skeleton height="3rem" width="100%" />
        </div>
      </div>
    </div>
  );
}
