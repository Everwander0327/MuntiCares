import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRole }) => {
  const { user, authInitialized } = useAuth();

  // Wait for auth to initialize to prevent flicker / incorrect redirects
  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

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
