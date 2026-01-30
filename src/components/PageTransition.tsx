import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

export function SlideUp({ children, className = '', delay = 0 }: PageTransitionProps & { delay?: number }) {
  return (
    <div 
      className={`animate-slide-up ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function ScaleIn({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`animate-scale-in ${className}`}>
      {children}
    </div>
  );
}
