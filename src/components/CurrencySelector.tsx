import { useCurrency } from '../contexts/CurrencyContext';
import type { CurrencyCode } from '../lib/currencyUtils';

interface CurrencySelectorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
}

export default function CurrencySelector({
  className = '',
  size = 'md',
  variant = 'default',
}: CurrencySelectorProps) {
  const { currency, setCurrency, isAdmin } = useCurrency();

  if (isAdmin) {
    return null;
  }

  const currencies: { code: CurrencyCode; label: string; symbol: string }[] = [
    { code: 'USD', label: 'USD', symbol: '$' },
    { code: 'NGN', label: 'NGN', symbol: '₦' },
    { code: 'BDT', label: 'BDT', symbol: '৳' },
  ];

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2.5',
  };

  if (variant === 'minimal') {
    return (
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className={`bg-transparent border-none outline-none cursor-pointer font-medium ${sizeClasses[size]} ${className}`}
      >
        {currencies.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <i className="ri-money-dollar-circle-line text-slate-600"></i>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        className={`bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all ${sizeClasses[size]}`}
      >
        {currencies.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </option>
        ))}
      </select>
    </div>
  );
}
