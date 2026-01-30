import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isAdminDomain, redirectToAdminDomain } from '../lib/domainUtils';

interface AdminDomainGuardProps {
  children: React.ReactNode;
}

export function AdminDomainGuard({ children }: AdminDomainGuardProps) {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith('/admin') || 
                        location.pathname.startsWith('/admin-');

    if (isAdminRoute && !isAdminDomain()) {
      console.warn('[AdminDomainGuard] Redirecting to admin domain');
      redirectToAdminDomain(location.pathname);
    }
  }, [location.pathname]);

  return <>{children}</>;
}
