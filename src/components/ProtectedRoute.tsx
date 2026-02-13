import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import BottomNavigation from './BottomNavigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/signin', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 font-medium">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <div className="pb-20 lg:pb-0">
        {children}
      </div>
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </>
  );
}
