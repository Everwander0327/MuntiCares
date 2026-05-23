import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

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

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes with Main Navbar/Footer */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        {/* Dashboard Routes with Sidebar */}
        <Route path="/patient" element={<ProtectedRoute allowedRole="patient" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><PatientDashboard /></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><PatientProviders /></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><PatientRequests /></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><PatientMessages /></ErrorBoundary>} />
          <Route path="consent" element={<ErrorBoundary><PatientConsent /></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><PatientProfile /></ErrorBoundary>} />
        </Route>

        <Route path="/provider" element={<ProtectedRoute allowedRole="provider" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><ProviderDashboard /></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><ProviderRequests /></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><ProviderPatients /></ErrorBoundary>} />
          <Route path="schedule" element={<ErrorBoundary><ProviderSchedule /></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><ProviderMessages /></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><ProviderProfile /></ErrorBoundary>} />
        </Route>

        <Route path="/admin" element={<ProtectedRoute allowedRole="admin" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
          <Route path="patients" element={<ErrorBoundary><AdminPatients /></ErrorBoundary>} />
          <Route path="providers" element={<ErrorBoundary><AdminProviders /></ErrorBoundary>} />
          <Route path="requests" element={<ErrorBoundary><AdminRequests /></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><AdminProfile /></ErrorBoundary>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
