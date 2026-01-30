import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface MaintenanceGateProps {
  children: React.ReactNode;
}

interface MaintenanceResponse {
  maintenance: boolean;
  message: string;
  estimated_completion?: string;
  admin?: boolean;
}

const MaintenancePage = ({ message, estimatedCompletion }: { message: string; estimatedCompletion?: string }) => {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="max-w-2xl w-full dark-card p-8 md:p-12 text-center">
        <div className="w-20 h-20 bg-warning-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <i className="ri-tools-line text-4xl text-warning-500"></i>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          System Maintenance
        </h1>
        
        <p className="text-lg text-neutral-400 mb-6">
          {message}
        </p>
        
        {estimatedCompletion && (
          <div className="bg-dark-elevated rounded-xl p-4 mb-6">
            <p className="text-sm text-neutral-500 mb-1">Estimated Completion</p>
            <p className="text-lg font-semibold text-white">{estimatedCompletion}</p>
          </div>
        )}
        
        <div className="flex items-center justify-center gap-2 text-neutral-500 mb-8">
          <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></div>
          <p className="text-sm">We'll be back shortly</p>
        </div>
        
        <div className="border-t border-dark-border pt-6">
          <p className="text-sm text-neutral-500 mb-4">Need immediate assistance?</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a 
              href="tel:+88017302752121" 
              className="btn-primary whitespace-nowrap"
            >
              <i className="ri-phone-line mr-2"></i>
              +88017302752121
            </a>
            <a 
              href="tel:+17373781872" 
              className="btn-secondary whitespace-nowrap"
            >
              <i className="ri-phone-line mr-2"></i>
              +1 (737) 378-1872
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export function MaintenanceGate({ children }: MaintenanceGateProps) {
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceResponse | null>(null);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkMaintenance = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('maintenance-gate', {
          method: 'GET',
        });

        if (error) {
          if (import.meta.env.DEV) {
            console.debug('[MaintenanceGate] Check skipped:', error.message);
          }
          return;
        }

        if (data?.maintenance === true) {
          setMaintenanceData(data);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('[MaintenanceGate] Check error:', error);
        }
      }
    };

    checkMaintenance();

    const interval = setInterval(() => {
      hasChecked.current = false;
      checkMaintenance();
    }, 300000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (maintenanceData?.maintenance) {
    return (
      <MaintenancePage 
        message={maintenanceData.message}
        estimatedCompletion={maintenanceData.estimated_completion}
      />
    );
  }

  return <>{children}</>;
}
