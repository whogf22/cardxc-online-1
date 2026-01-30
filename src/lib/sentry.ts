// Sentry error tracking - only initialized in production

import * as Sentry from '@sentry/react';

export function initSentry(): void {
  if (!import.meta.env.PROD) {
    console.log('[Sentry] Skipping initialization in development mode');
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn || dsn.trim() === '') {
    console.warn('[Sentry] VITE_SENTRY_DSN not set, error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      beforeSend(event) {
        if (event.request?.url) {
          event.request.url = event.request.url.replace(/[?&]token=[^&]*/gi, '[REDACTED]');
        }
        
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['authorization'];
        }
        
        return event;
      },
      
      ignoreErrors: [
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        'atomicFindClose',
        'fb_xd_fragment',
        'bmi_SafeAddOnload',
        'EBCallBackMessageReceived',
        'conduitPage',
        'NetworkError',
        'Network request failed',
        'ResizeObserver loop limit exceeded',
      ],
    });
    
    console.log('[Sentry] Error tracking initialized');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

export function captureException(error: Error, context?: Record<string, any>): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        custom: context || {},
      },
    });
  } else {
    console.error('[Error]', error, context);
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level.toUpperCase()}]`, message);
  }
}
