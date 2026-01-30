import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type SystemStatus = 'healthy' | 'degraded' | 'offline';

interface SystemHealthState {
  apiStatus: SystemStatus;
  realtimeStatus: SystemStatus;
  lastChecked: Date;
}

export function SystemHealthBanner() {
  const [health, setHealth] = useState<SystemHealthState>({
    apiStatus: 'healthy',
    realtimeStatus: 'healthy',
    lastChecked: new Date(),
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const { error: apiError } = await supabase.auth.getSession();
        const apiStatus: SystemStatus = apiError ? 'offline' : 'healthy';

        const realtimeStatus: SystemStatus = 
          supabase.realtime.channels.length > 0 ? 'healthy' : 'degraded';

        if (mounted) {
          setHealth({
            apiStatus,
            realtimeStatus,
            lastChecked: new Date(),
          });
        }
      } catch (err) {
        console.error('[SystemHealth] Health check failed:', err);
        if (mounted) {
          setHealth({
            apiStatus: 'offline',
            realtimeStatus: 'offline',
            lastChecked: new Date(),
          });
        }
      }
    };

    // Initial check
    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if ((health.apiStatus === 'healthy' && health.realtimeStatus === 'healthy') || 
      (health.apiStatus === 'degraded' || health.realtimeStatus === 'degraded') ||
      dismissed) {
    return null;
  }

  if (health.apiStatus === 'offline') {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="ri-alert-line text-xl"></i>
            <div>
              <p className="font-semibold">Connection Issue</p>
              <p className="text-sm text-red-100">
                We're having trouble connecting to our services. Please try again in a moment.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-white hover:text-red-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
