/**
 * Lazy-loads a section component when it enters the viewport.
 * Reduces initial bundle size and improves homepage load performance.
 */
import { useState, useEffect, useRef, type ComponentType } from 'react';

interface LazySectionProps {
  load: () => Promise<{ default: ComponentType<any> }>;
  fallback?: React.ReactNode;
  rootMargin?: string;
  minHeight?: string;
}

export function LazySection({ load, fallback, rootMargin = '200px', minHeight = '200px' }: LazySectionProps) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          load().then((mod) => setComponent(() => mod.default));
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [load, rootMargin]);

  if (Component) return <Component />;

  return (
    <div ref={ref} style={{ minHeight }} aria-hidden="true">
      {fallback ?? null}
    </div>
  );
}
