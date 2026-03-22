import { BrowserRouter } from 'react-router-dom';
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
                      <AppRoutes />
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
