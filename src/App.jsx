import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import NeumorphicToast from './components/NeumorphicToast';
import { unlockAudio } from './lib/audio';
import { useTheme } from './contexts/ThemeContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AnimatedPage from './components/AnimatedPage';
import CookieConsent from './components/CookieConsent';
import { SkeletonPage } from './components/Skeleton';

// Pages (eager — critical path)
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/auth/AuthPage';

// Dashboard pages (lazy — only loaded after login)
const PatientDashboard = lazy(() => import('./pages/patient/Dashboard'));
const PatientProviders = lazy(() => import('./pages/patient/Providers'));
const PatientConsent = lazy(() => import('./pages/patient/Consent'));
const PatientRequests = lazy(() => import('./pages/patient/Requests'));
const PatientProfile = lazy(() => import('./pages/patient/Profile'));
const PatientMessages = lazy(() => import('./pages/patient/Messages'));
const ProviderProfileView = lazy(() => import('./pages/patient/ProviderProfileView'));

const ProviderDashboard = lazy(() => import('./pages/provider/Dashboard'));
const ProviderRequests = lazy(() => import('./pages/provider/Requests'));
const ProviderPatients = lazy(() => import('./pages/provider/Patients'));
const ProviderSchedule = lazy(() => import('./pages/provider/Schedule'));
const ProviderProfile = lazy(() => import('./pages/provider/Profile'));
const ProviderMessages = lazy(() => import('./pages/provider/Messages'));
const PatientProfileView = lazy(() => import('./pages/provider/PatientProfileView'));

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminPatients = lazy(() => import('./pages/admin/Patients'));
const AdminProviders = lazy(() => import('./pages/admin/Providers'));
const AdminRequests = lazy(() => import('./pages/admin/Requests'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));

function AppContent() {
  const location = useLocation();
  const { dark } = useTheme();

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
    <><AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<AnimatedPage><LandingPage /></AnimatedPage>} />
          <Route path="login" element={<AnimatedPage><AuthPage /></AnimatedPage>} />
          <Route path="register" element={<AnimatedPage><AuthPage /></AnimatedPage>} />
        </Route>

        {/* Dashboard Routes with Persistent Shell (Top Bar & Bottom Nav stay mounted) */}
        <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
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
  </>
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
