interface TrustBadgeProps {
  icon: string;
  title: string;
  description?: string;
  variant?: 'emerald' | 'lime' | 'neutral';
  className?: string;
}

const variantStyles = {
  emerald: {
    container: 'bg-[#0d0d0d] border-white/[0.06] hover:border-emerald-500/20',
    iconBg: 'bg-emerald-500/[0.08] border-emerald-500/10 group-hover:border-emerald-500/20',
    icon: 'text-emerald-400',
    chip: 'text-emerald-400 bg-emerald-500/[0.08] border-emerald-500/20',
  },
  lime: {
    container: 'bg-[#0d0d0d] border-white/[0.06] hover:border-lime-500/20',
    iconBg: 'bg-lime-500/[0.08] border-lime-500/10 group-hover:border-lime-500/20',
    icon: 'text-lime-400',
    chip: 'text-lime-400 bg-lime-500/[0.08] border-lime-500/20',
  },
  neutral: {
    container: 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.12]',
    iconBg: 'bg-white/[0.06] border-white/[0.08]',
    icon: 'text-white',
    chip: 'text-neutral-300 bg-white/[0.04] border-white/[0.08]',
  },
};

export default function TrustBadge({
  icon,
  title,
  description,
  variant = 'emerald',
  className = '',
}: TrustBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`group p-5 rounded-2xl border transition-all duration-300 ${styles.container} ${className}`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 transition-all ${styles.iconBg}`}
      >
        <i className={`${icon} text-2xl ${styles.icon}`}></i>
      </div>
      <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export function TrustChip({
  icon,
  title,
  variant = 'emerald',
  className = '',
}: Omit<TrustBadgeProps, 'description'>) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${styles.chip} ${className}`}
    >
      <i className={`${icon}`}></i>
      <span>{title}</span>
    </div>
  );
}
