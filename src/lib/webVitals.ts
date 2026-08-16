// Web Vitals tracking - tracks Core Web Vitals for performance monitoring

import { hasAnalyticsConsent, onConsentChange } from './consent';

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

  // Web Vitals reporting is non-essential; only send it with user consent.
  if (!hasAnalyticsConsent()) {
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

let started = false;

function startCollecting(): void {
  if (started) {
    return;
  }
  started = true;

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

export function initWebVitals(): void {
  if (!import.meta.env.PROD) {
    return;
  }

  // Only begin collecting once the user has consented. If they consent later,
  // start collecting at that point.
  if (hasAnalyticsConsent()) {
    startCollecting();
  } else {
    onConsentChange((value) => {
      if (value === 'accepted') {
        startCollecting();
      }
    });
  }
}
