import { useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useCurrencyFormat } from '../../../hooks/useCurrencyFormat';

interface TotalAssetCardProps {
  usdBalance: number;
  usdtBalance: number;
  showBalance: boolean;
  onToggleBalance: () => void;
}

export default function TotalAssetCard({ usdBalance, usdtBalance, showBalance, onToggleBalance }: TotalAssetCardProps) {
  const navigate = useNavigate();
  const format = useCurrencyFormat();
  const totalBalance = usdBalance + usdtBalance;
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [displayBalance, setDisplayBalance] = useState(0);

  // Count-up animation
  useEffect(() => {
    if (!showBalance) return;
    const duration = 1200;
    const start = performance.now();
    const from = displayBalance;
    const to = totalBalance;
    
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayBalance(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [totalBalance, showBalance]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (y - 0.5) * 12,
      y: (x - 0.5) * -12,
    });
    setGlare({ x: x * 100, y: y * 100 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setGlare({ x: 50, y: 50 });
    setIsHovered(false);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative group cursor-default"
      style={{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Animated gradient border */}
      <div
        className="absolute -inset-[1px] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: 'linear-gradient(135deg, rgba(132,204,22,0.4), rgba(190,242,100,0.2), rgba(132,204,22,0.1), rgba(190,242,100,0.4))',
          backgroundSize: '300% 300%',
          animation: isHovered ? 'gradientShift 3s ease infinite' : 'none',
          filter: 'blur(1px)',
        }}
      />

      {/* Main card */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] p-6 transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, rgba(13,13,13,0.95) 0%, rgba(20,20,20,0.9) 50%, rgba(13,13,13,0.95) 100%)',
          backdropFilter: 'blur(40px)',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered ? '20px' : '0px'})`,
          boxShadow: isHovered
            ? '0 30px 60px -12px rgba(0,0,0,0.9), 0 0 40px rgba(132,204,22,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 20px 40px -10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Glare overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 rounded-3xl"
          style={{
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.06) 0%, transparent 60%)`,
            opacity: isHovered ? 1 : 0,
          }}
        />

        {/* Mesh gradient background */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-lime-500/[0.04] rounded-full blur-[80px] transition-all duration-700 group-hover:bg-lime-500/[0.08] group-hover:scale-110" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-emerald-500/[0.03] rounded-full blur-[60px] transition-all duration-700 group-hover:bg-emerald-500/[0.06]" />
        </div>

        {/* Content */}
        <div className="relative z-10" style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-neutral-400 text-sm font-medium tracking-wide">Total Balance</span>
            </div>
            <button
              onClick={() => navigate('/cards')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white text-xs font-medium hover:bg-white/[0.1] hover:border-lime-500/30 transition-all duration-300 cursor-pointer backdrop-blur-sm"
            >
              <i className="ri-add-line text-lime-400 text-sm"></i>
              Add Card
            </button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button onClick={onToggleBalance} className="cursor-pointer focus:outline-none">
              {showBalance ? (
                <span className="text-[42px] font-bold text-white tracking-tight leading-none" style={{ textShadow: '0 2px 20px rgba(132,204,22,0.15)' }}>
                  {format(displayBalance, { maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-[42px] font-bold text-white tracking-tight leading-none flex gap-1">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="w-3 h-3 rounded-full bg-white/30 inline-block" style={{ animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
                  ))}
                </span>
              )}
            </button>
            <button
              onClick={onToggleBalance}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] cursor-pointer hover:bg-white/[0.1] transition-all duration-200"
            >
              <i className={`${showBalance ? 'ri-eye-line' : 'ri-eye-off-line'} text-neutral-400 text-sm`}></i>
            </button>
          </div>

          {/* Balance breakdown */}
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-lime-400" />
              <span className="text-neutral-500 text-xs">USD</span>
              <span className="text-white/80 text-xs font-medium">{showBalance ? format(usdBalance) : '***'}</span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-neutral-500 text-xs">USDT</span>
              <span className="text-white/80 text-xs font-medium">{showBalance ? format(usdtBalance) : '***'}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <i className="ri-arrow-up-s-fill text-lime-400 text-sm"></i>
              <span className="text-lime-400 text-xs font-semibold">
                {totalBalance > 0 ? '+2.06%' : '0.00%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
