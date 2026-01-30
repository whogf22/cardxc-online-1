import type { VirtualCard } from '../../../types/card';

interface VirtualCardDisplayProps {
  card: VirtualCard;
  onClick?: () => void;
  variant?: 'lime' | 'orange' | 'blue';
  size?: 'sm' | 'md' | 'lg';
}

export default function VirtualCardDisplay({ 
  card, 
  onClick,
  variant = 'lime',
  size = 'md'
}: VirtualCardDisplayProps) {
  const variants = {
    lime: 'from-[#9AF941] to-[#7ED321] text-black',
    orange: 'from-[#F9AC41] to-[#F79C14] text-black',
    blue: 'from-[#4A90D9] to-[#357ABD] text-white',
  };

  const sizes = {
    sm: 'p-4 rounded-2xl min-w-[200px]',
    md: 'p-6 rounded-3xl min-w-[280px]',
    lg: 'p-8 rounded-3xl min-w-[340px]',
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance);
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-gradient-to-br ${variants[variant]} ${sizes[size]}
        cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl
        flex flex-col justify-between overflow-hidden
        ${size === 'lg' ? 'min-h-[200px]' : size === 'md' ? 'min-h-[170px]' : 'min-h-[140px]'}
      `}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium opacity-80 uppercase tracking-wider">Balance</span>
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${card.status === 'ACTIVE' ? 'bg-green-600' : 'bg-red-500'}`}></span>
            <span className="text-xs font-semibold">{card.status}</span>
          </div>
        </div>
        <div className={`font-bold tracking-tight ${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'}`}>
          ${formatBalance(card.balance)}
        </div>
      </div>
      
      <div className="relative z-10 mt-4">
        <div className="font-mono text-sm opacity-90 mb-2 tracking-wider">
          {card.card_number_masked}
          <span className="ml-2 text-xs font-sans">| {card.card_type}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs opacity-70 block">VALID THRU</span>
            <span className="font-semibold text-sm">
              {String(card.expiry_month).padStart(2, '0')}/{String(card.expiry_year).slice(-2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {card.card_brand === 'VISA' ? (
              <svg className="w-12 h-8" viewBox="0 0 48 32" fill="currentColor">
                <path d="M18.5 10.5L15.5 21.5H12.5L15.5 10.5H18.5ZM32 10.5L28 21.5H25L21 10.5H24L26.5 18L29 10.5H32ZM35 10.5H38L35 21.5H32L35 10.5ZM10 21.5L7 10.5H4L1 21.5H4L4.5 19.5H8.5L9 21.5H10ZM5 17.5L6.5 12L8 17.5H5Z"/>
              </svg>
            ) : (
              <div className="flex -space-x-2">
                <div className="w-6 h-6 bg-red-500 rounded-full opacity-80"></div>
                <div className="w-6 h-6 bg-yellow-500 rounded-full opacity-80"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {card.status === 'FROZEN' && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20 rounded-3xl">
          <div className="text-white text-center">
            <i className="ri-lock-line text-3xl mb-1 block"></i>
            <span className="text-sm font-semibold">FROZEN</span>
          </div>
        </div>
      )}
    </div>
  );
}
