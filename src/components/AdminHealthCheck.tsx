import { useState, useEffect } from 'react';
import { authApi, healthApi, userApi } from '../lib/api';

interface HealthCheckState {
  authConnected: boolean;
  realtimeConnected: boolean;
  adminRoleVerified: boolean;
  apiGatewayResponding: boolean;
  loading: boolean;
}

export function AdminHealthCheck() {
  const [health, setHealth] = useState<HealthCheckState>({
    authConnected: false,
    realtimeConnected: false,
    adminRoleVerified: false,
    apiGatewayResponding: false,
    loading: true,
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const runHealthCheck = async () => {
      try {
        const sessionResult = await authApi.getSession();
        const authConnected = sessionResult.success && !!sessionResult.data?.user;

        let adminRoleVerified = false;
        if (authConnected && sessionResult.data?.user) {
          try {
            const profileResult = await userApi.getProfile();
            adminRoleVerified = profileResult.success && 
              (profileResult.data?.user as any)?.role === 'admin';
          } catch (err) {
            console.warn('[HealthCheck] Profile check failed:', err);
          }
        }

        const realtimeConnected = authConnected;
        
        let apiGatewayResponding = false;
        try {
          const healthResult = await healthApi.check();
          apiGatewayResponding = healthResult.success;
        } catch (err) {
          console.warn('[HealthCheck] API Gateway check failed:', err);
        }

        if (mounted) {
          setHealth({
            authConnected,
            realtimeConnected,
            adminRoleVerified,
            apiGatewayResponding,
            loading: false,
          });
        }
      } catch (err) {
        console.error('[HealthCheck] Health check failed:', err);
        if (mounted) {
          setHealth({
            authConnected: false,
            realtimeConnected: false,
            adminRoleVerified: false,
            apiGatewayResponding: false,
            loading: false,
          });
        }
      }
    };

    runHealthCheck();

    return () => {
      mounted = false;
    };
  }, []);

  const allHealthy = 
    health.authConnected &&
    health.realtimeConnected &&
    health.adminRoleVerified &&
    health.apiGatewayResponding;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${allHealthy ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
          <span className="text-sm font-medium text-white">
            System Health Check
          </span>
        </div>
        <i className={`ri-arrow-${expanded ? 'up' : 'down'}-s-line text-slate-400`}></i>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <HealthCheckItem
            label="Auth Connected"
            status={health.authConnected}
            loading={health.loading}
          />
          <HealthCheckItem
            label="Realtime Connected"
            status={health.realtimeConnected}
            loading={health.loading}
          />
          <HealthCheckItem
            label="Admin Role Verified"
            status={health.adminRoleVerified}
            loading={health.loading}
          />
          <HealthCheckItem
            label="API Gateway Responding"
            status={health.apiGatewayResponding}
            loading={health.loading}
          />

          {!health.loading && (
            <div className="mt-4 pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400">
                {allHealthy
                  ? 'All systems operational'
                  : 'Some systems may need attention'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface HealthCheckItemProps {
  label: string;
  status: boolean;
  loading: boolean;
}

function HealthCheckItem({ label, status, loading }: HealthCheckItemProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg">
      <span className="text-sm text-slate-300">{label}</span>
      {loading ? (
        <i className="ri-loader-4-line animate-spin text-slate-400"></i>
      ) : status ? (
        <i className="ri-checkbox-circle-fill text-green-500"></i>
      ) : (
        <i className="ri-close-circle-fill text-red-500"></i>
      )}
    </div>
  );
}
