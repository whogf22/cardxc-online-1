import { BrowserRouter } from 'react-router-dom';
import { Suspense } from 'react';
import { AppRoutes } from './router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SkipToContent } from './components/SkipToContent';
import { SessionGuard } from './components/SessionGuard';
import { MaintenanceGate } from './components/MaintenanceGate';
import { AdminDomainGuard } from './components/AdminDomainGuard';
import { ConnectionBanner } from './components/ConnectionBanner';
import { SystemHealthBanner } from './components/SystemHealthBanner';
import { AccountStateBanner } from './components/AccountStateBanner';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LocaleProvider } from './components/LocaleProvider';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { AIAssistant } from './components/AIAssistant';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={__BASE_PATH__}>
        <SkipToContent />
        <AuthProvider>
          <ToastProvider>
            <LocaleProvider>
              <CurrencyProvider>
                <MaintenanceGate>
                  <SessionGuard>
                    <AdminDomainGuard>
                      <ConnectionBanner />
                      <SystemHealthBanner />
                      <AccountStateBanner />
                      <Suspense fallback={
                        <div className="min-h-screen bg-[#030303] flex items-center justify-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin" />
                            <span className="text-neutral-500 text-sm font-medium">Loading...</span>
                          </div>
                        </div>
                      }>
                        <AppRoutes />
                      </Suspense>
                      <AIAssistant />
                    </AdminDomainGuard>
                  </SessionGuard>
                </MaintenanceGate>
              </CurrencyProvider>
            </LocaleProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
