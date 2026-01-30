interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'outline';
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  paused: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  frozen: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
};

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const colors = statusColors[normalizedStatus] || statusColors.pending;

  if (variant === 'outline') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors.border} ${colors.text} bg-white`}>
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {status}
    </span>
  );
}
