import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BrandLoader } from '@/shared/ui';

const ProtectedRoute = ({ allowedRole }) => {
  const { user, authInitialized } = useAuth();
  const location = useLocation();

  const spinner = (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-surface-page px-4">
      <BrandLoader size={64} label="Loading your MuntiCares portal" />
      <p className="text-sm font-medium text-tertiary">Loading...</p>
    </div>
  );

  // Wait for auth to initialize to prevent flicker / incorrect redirects
  if (!authInitialized) {
    return spinner;
  }

  if (!user) {
    // Not logged in, redirect to login page preserving destination
    const target = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} state={{ from: location }} replace />;
  }

  // The role is confirmed from public.users, not client metadata. Until that read
  // returns, redirecting would send a provider to /patient/… and a patient to /null/.
  if (!user.role) {
    return spinner;
  }

  if (user?.is_banned) {
    return <Navigate to="/login" state={{ error: 'Your account has been suspended. Please contact support.' }} replace />;
  }

  if (user.setup_pending) return <Navigate to="/login" replace />;

  // Support allowedRole as string or array
  const allowed = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
  if (allowed[0] && !allowed.includes(user.role)) {
    // If they try to access a route they shouldn't, send them to their own dashboard
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  // Role matches, allow access to the nested routes
  return <Outlet />;
};

export default ProtectedRoute;
