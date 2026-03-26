import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';

interface ActionButtonsProps {
  onDepositClick: () => void;
  onWithdrawClick: () => void;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

function ActionButton({ icon, label, onClick, index, accentColor }: { icon: string; label: string; onClick: () => void; index: number; accentColor: string }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick();
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className="flex flex-col items-center gap-2.5 cursor-pointer group flex-1 min-w-0 py-2 opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'forwards' }}
    >
      <div
        className="relative w-[60px] h-[60px] rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, rgba(20,20,20,0.9), rgba(13,13,13,0.95))',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: isPressed
            ? 'inset 0 4px 12px rgba(0,0,0,0.6)'
            : '0 8px 24px -4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          transform: isPressed ? 'scale(0.92) translateY(2px)' : 'scale(1) translateY(0)',
        }}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${accentColor}15 0%, transparent 70%)`,
          }}
        />
        
        {/* Icon */}
        <i className={`${icon} text-xl text-neutral-300 group-hover:text-lime-400 transition-colors duration-300 relative z-10`}></i>

        {/* Ripple effects */}
        {ripples.map(ripple => (
          <span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x - 20,
              top: ripple.y - 20,
              width: 40,
              height: 40,
              background: 'rgba(132,204,22,0.3)',
              animation: 'rippleExpand 0.6s ease-out forwards',
            }}
          />
        ))}
      </div>
      <span className="text-neutral-500 text-[11px] font-medium group-hover:text-white transition-colors duration-300 truncate w-full text-center">
        {label}
      </span>

      <style>{`
        @keyframes rippleExpand {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </button>
  );
}

export default function ActionButtons({ onDepositClick, onWithdrawClick }: ActionButtonsProps) {
  const navigate = useNavigate();

  const actions = [
    { icon: 'ri-arrow-right-up-line', label: 'Withdraw', onClick: onWithdrawClick, accentColor: '#f97316' },
    { icon: 'ri-arrow-left-down-line', label: 'Deposit', onClick: onDepositClick, accentColor: '#84CC16' },
    { icon: 'ri-bank-card-line', label: 'Pay', onClick: () => navigate('/payments'), accentColor: '#3b82f6' },
    { icon: 'ri-qr-scan-2-line', label: 'Scan', onClick: () => navigate('/transfer'), accentColor: '#8b5cf6' },
  ];

  return (
    <div className="flex items-center justify-between px-2 sm:px-4 gap-2">
      {actions.map((action, index) => (
        <ActionButton key={index} {...action} index={index} />
      ))}
    </div>
  );
}
