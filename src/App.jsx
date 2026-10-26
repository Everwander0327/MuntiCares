import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { NeumorphicToast, ErrorBoundary, CookieConsent } from '@/shared/feedback';
import { unlockAudio } from '@/lib/audio';

import { useAuth } from '@/contexts/AuthContext';
import { CallProvider } from '@/contexts/CallContext';
import { IncomingCallOverlay } from '@/features/chat';

// Layouts
import MainLayout from '@/layouts/MainLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import { ProtectedRoute } from '@/features/auth';
import { AnimatedPage } from '@/shared/components';
import { SkeletonPage } from '@/shared/ui';
const ProviderTrackingManager = lazy(() => import('@/features/tracking/components/ProviderTrackingManager'));
const PatientTrackingMonitor = lazy(() => import('@/features/tracking/components/PatientTrackingMonitor'));

// Pages (eager — critical path)
import { LandingPage } from '@/features/landing';
import { AuthPage } from '@/features/auth';

// Dashboard pages (lazy — only loaded after login)
const PatientDashboard = lazy(() => import('@/features/patient/pages/Dashboard'));
const PatientOnboarding = lazy(() => import('@/features/patient/pages/Onboarding'));
const PatientProviders = lazy(() => import('@/features/patient/pages/Providers'));
const PatientConsent = lazy(() => import('@/features/patient/pages/Consent'));
const PatientRequests = lazy(() => import('@/features/patient/pages/Requests'));
const PatientProfile = lazy(() => import('@/features/patient/pages/Profile'));
const PatientMessages = lazy(() => import('@/features/patient/pages/Messages'));
const ProviderProfileView = lazy(() => import('@/features/patient/pages/ProviderProfileView'));

const ProviderDashboard = lazy(() => import('@/features/provider/pages/Dashboard'));
const ProviderRequests = lazy(() => import('@/features/provider/pages/Requests'));
const ProviderPatients = lazy(() => import('@/features/provider/pages/Patients'));
const ProviderSchedule = lazy(() => import('@/features/provider/pages/Schedule'));
const ProviderProfile = lazy(() => import('@/features/provider/pages/Profile'));
const ProviderMessages = lazy(() => import('@/features/provider/pages/Messages'));
const PatientProfileView = lazy(() => import('@/features/provider/pages/PatientProfileView'));

const AdminDashboard = lazy(() => import('@/features/admin/pages/Dashboard'));
const AdminPatients = lazy(() => import('@/features/admin/pages/Patients'));
const AdminProviders = lazy(() => import('@/features/admin/pages/Providers'));
const AdminRequests = lazy(() => import('@/features/admin/pages/Requests'));
const AdminProfile = lazy(() => import('@/features/admin/pages/Profile'));
const AdminAnnouncements = lazy(() => import('@/features/admin/pages/Announcements'));

function AppContent() {
  const location = useLocation();

  const auth = useAuth();
  const user = auth?.user;

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
    <CallProvider>
      <IncomingCallOverlay />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname.split('/')[1] || 'public'}>
          {/* Standalone Onboarding Route (No Landing Navbar/Footer) */}
          <Route path="/onboarding" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientOnboarding isPreview={true} /></Suspense></ErrorBoundary>} />

          {/* Public Routes */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<AnimatedPage><LandingPage /></AnimatedPage>} />
            <Route path="login" element={<AnimatedPage><AuthPage /></AnimatedPage>} />
            <Route path="register" element={<AnimatedPage><AuthPage /></AnimatedPage>} />
          </Route>

          {/* Dashboard Routes with Persistent Shell (Top Bar & Bottom Nav stay mounted) */}
          <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
            <Route path="onboarding" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientOnboarding /></Suspense></ErrorBoundary>} />
            <Route element={<DashboardLayout role="patient" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientDashboard /></Suspense></ErrorBoundary>} />
              <Route path="providers" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientProviders /></Suspense></ErrorBoundary>} />
              <Route path="providers/:id/profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderProfileView /></Suspense></ErrorBoundary>} />
              <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientRequests /></Suspense></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientMessages /></Suspense></ErrorBoundary>} />
              <Route path="consent" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientConsent /></Suspense></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientProfile /></Suspense></ErrorBoundary>} />
            </Route>
          </Route>

          <Route path="/provider" element={<ProtectedRoute allowedRole="provider" />}>
            <Route element={<DashboardLayout role="provider" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderDashboard /></Suspense></ErrorBoundary>} />
              <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderRequests /></Suspense></ErrorBoundary>} />
              <Route path="patients" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderPatients /></Suspense></ErrorBoundary>} />
              <Route path="patients/:id/profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><PatientProfileView /></Suspense></ErrorBoundary>} />
              <Route path="schedule" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderSchedule /></Suspense></ErrorBoundary>} />
              <Route path="messages" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderMessages /></Suspense></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><ProviderProfile /></Suspense></ErrorBoundary>} />
            </Route>
          </Route>

          <Route path="/admin" element={<ProtectedRoute allowedRole="admin" />}>
            <Route element={<DashboardLayout role="admin" />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminDashboard /></Suspense></ErrorBoundary>} />
              <Route path="patients" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminPatients /></Suspense></ErrorBoundary>} />
              <Route path="providers" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminProviders /></Suspense></ErrorBoundary>} />
              <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminRequests /></Suspense></ErrorBoundary>} />
              <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminProfile /></Suspense></ErrorBoundary>} />
              <Route path="announcements" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AdminAnnouncements /></Suspense></ErrorBoundary>} />
            </Route>
          </Route>
        </Routes>
      </AnimatePresence>
      {user?.role === 'provider' && <Suspense fallback={null}><ProviderTrackingManager /></Suspense>}
      {user?.role === 'patient' && <Suspense fallback={null}><PatientTrackingMonitor /></Suspense>}
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{
          top: 'max(0.75rem, env(safe-area-inset-top, 12px))',
          left: 0,
          right: 0,
          zIndex: 99999,
          pointerEvents: 'none',
        }}
        toastOptions={{
          duration: 3500,
          removeDelay: 1000,
        }}
      >
        {(t) => <NeumorphicToast t={t} />}
      </Toaster>
    </CallProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
      <CookieConsent />
    </Router>
  );
}

export default App;
