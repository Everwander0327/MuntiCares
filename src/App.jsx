import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { unlockAudio } from './lib/audio';
import { useTheme } from './contexts/ThemeContext';

// Layouts
import MainLayout from './layouts/MainLayout';
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

        {/* Dashboard Routes with Sidebar (lazy loaded) */}
        <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientDashboard /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientProviders /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="providers/:id/profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderProfileView /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientRequests /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientMessages /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="consent" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientConsent /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientProfile /></AnimatedPage></Suspense></ErrorBoundary>} />
        </Route>

        <Route path="/provider" element={<ProtectedRoute allowedRole="provider" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderDashboard /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderRequests /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderPatients /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="patients/:id/profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><PatientProfileView /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="schedule" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderSchedule /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderMessages /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><ProviderProfile /></AnimatedPage></Suspense></ErrorBoundary>} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute allowedRole="admin" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><AdminDashboard /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><AdminPatients /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><AdminProviders /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><AdminRequests /></AnimatedPage></Suspense></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><Suspense fallback={<SkeletonPage />}><AnimatedPage><AdminProfile /></AnimatedPage></Suspense></ErrorBoundary>} />
        </Route>
      </Routes>
    </AnimatePresence>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: dark ? '#1e293b' : '#fff',
          color: dark ? '#f1f5f9' : '#0f172a',
          border: dark ? '1px solid #334155' : '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          fontSize: '14px',
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 8px 32px rgba(0,0,0,0.1)',
        },
        success: {
          iconTheme: { primary: '#22c55e', secondary: '#fff' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#fff' },
        },
      }}
    />
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
