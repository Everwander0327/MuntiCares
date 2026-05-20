import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRole }) => {
  const { user } = useAuth();
  
  if (!user) {
    // Not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // Check if the user's role matches the allowed role for this route
  if (user.role !== allowedRole) {
    // If they try to access a route they shouldn't, send them to their own dashboard
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  // Role matches, allow access to the nested routes
  return <Outlet />;
};

export default ProtectedRoute;
