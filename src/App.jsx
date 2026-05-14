import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/Login';
import RegisterPage from './pages/auth/Register';

// Patient Pages
import PatientDashboard from './pages/patient/Dashboard';
import PatientProviders from './pages/patient/Providers';
import PatientConsent from './pages/patient/Consent';
import PatientRequests from './pages/patient/Requests';

// Provider Pages
import ProviderDashboard from './pages/provider/Dashboard';
import ProviderRequests from './pages/provider/Requests';
import ProviderPatients from './pages/provider/Patients';
import ProviderProfile from './pages/provider/Profile';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminPatients from './pages/admin/Patients';
import AdminProviders from './pages/admin/Providers';
import AdminRequests from './pages/admin/Requests';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes with Main Navbar/Footer */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        {/* Dashboard Routes with Sidebar */}
        <Route path="/patient">
          <Route path="dashboard" element={<PatientDashboard />} />
          <Route path="providers" element={<PatientProviders />} />
          <Route path="requests" element={<PatientRequests />} />
          <Route path="consent" element={<PatientConsent />} />
        </Route>

        <Route path="/provider">
          <Route path="dashboard" element={<ProviderDashboard />} />
          <Route path="requests" element={<ProviderRequests />} />
          <Route path="patients" element={<ProviderPatients />} />
          <Route path="profile" element={<ProviderProfile />} />
        </Route>

        <Route path="/admin">
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="patients" element={<AdminPatients />} />
          <Route path="providers" element={<AdminProviders />} />
          <Route path="requests" element={<AdminRequests />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
