import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { unlockAudio } from './lib/audio';

// Layouts
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AnimatedPage from './components/AnimatedPage';
import CookieConsent from './components/CookieConsent';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/Login';
import RegisterPage from './pages/auth/Register';

// Patient Pages
import PatientDashboard from './pages/patient/Dashboard';
import PatientProviders from './pages/patient/Providers';
import PatientConsent from './pages/patient/Consent';
import PatientRequests from './pages/patient/Requests';
import PatientProfile from './pages/patient/Profile';
import PatientMessages from './pages/patient/Messages';

// Provider Pages
import ProviderDashboard from './pages/provider/Dashboard';
import ProviderRequests from './pages/provider/Requests';
import ProviderPatients from './pages/provider/Patients';
import ProviderSchedule from './pages/provider/Schedule';
import ProviderProfile from './pages/provider/Profile';
import ProviderMessages from './pages/provider/Messages';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminPatients from './pages/admin/Patients';
import AdminProviders from './pages/admin/Providers';
import AdminRequests from './pages/admin/Requests';
import AdminProfile from './pages/admin/Profile';

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => { unlockAudio(); document.removeEventListener('pointerdown', handler); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes with Main Navbar/Footer */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<AnimatedPage><LandingPage /></AnimatedPage>} />
          <Route path="login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
          <Route path="register" element={<AnimatedPage><RegisterPage /></AnimatedPage>} />
        </Route>

        {/* Dashboard Routes with Sidebar */}
        <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><AnimatedPage><PatientDashboard /></AnimatedPage></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><AnimatedPage><PatientProviders /></AnimatedPage></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><AnimatedPage><PatientRequests /></AnimatedPage></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><AnimatedPage><PatientMessages /></AnimatedPage></ErrorBoundary>} />
          <Route path="consent" element={<ErrorBoundary><AnimatedPage><PatientConsent /></AnimatedPage></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><AnimatedPage><PatientProfile /></AnimatedPage></ErrorBoundary>} />
        </Route>

        <Route path="/provider" element={<ProtectedRoute allowedRole="provider" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><AnimatedPage><ProviderDashboard /></AnimatedPage></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><AnimatedPage><ProviderRequests /></AnimatedPage></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><AnimatedPage><ProviderPatients /></AnimatedPage></ErrorBoundary>} />
          <Route path="schedule" element={<ErrorBoundary><AnimatedPage><ProviderSchedule /></AnimatedPage></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><AnimatedPage><ProviderMessages /></AnimatedPage></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><AnimatedPage><ProviderProfile /></AnimatedPage></ErrorBoundary>} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute allowedRole="admin" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><AnimatedPage><AdminDashboard /></AnimatedPage></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><AnimatedPage><AdminPatients /></AnimatedPage></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><AnimatedPage><AdminProviders /></AnimatedPage></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><AnimatedPage><AdminRequests /></AnimatedPage></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><AnimatedPage><AdminProfile /></AnimatedPage></ErrorBoundary>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <AppContent />
      <CookieConsent />
    </Router>
  );
}

export default App;
