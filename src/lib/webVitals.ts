// Web Vitals tracking - tracks Core Web Vitals for performance monitoring

interface WebVitalsMetric {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function reportWebVitals(metric: WebVitalsMetric): void {
  if (!import.meta.env.PROD) {
    console.log('[Web Vitals]', metric.name, metric.value, metric.rating);
    return;
  }

  if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
    fetch(import.meta.env.VITE_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: window.location.href,
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {
      // Silently fail
    });
  }
}

export function initWebVitals(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  import('web-vitals').then((webVitals) => {
    if (webVitals.onCLS) webVitals.onCLS(reportWebVitals);
    if (webVitals.onINP) webVitals.onINP(reportWebVitals);
    if (webVitals.onFCP) webVitals.onFCP(reportWebVitals);
    if (webVitals.onLCP) webVitals.onLCP(reportWebVitals);
    if (webVitals.onTTFB) webVitals.onTTFB(reportWebVitals);
  }).catch(() => {
    // Silently fail if web-vitals not available
  });
}
