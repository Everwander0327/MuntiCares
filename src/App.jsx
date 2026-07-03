import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/auth/AuthPage';
import PatientDashboard from './pages/patient/Dashboard';
import PatientProviders from './pages/patient/Providers';
import PatientRequests from './pages/patient/Requests';
import PatientMessages from './pages/patient/Messages';
import PatientProfile from './pages/patient/Profile';
import ProviderDashboard from './pages/provider/Dashboard';
import ProviderRequests from './pages/provider/Requests';
import ProviderPatients from './pages/provider/Patients';
import ProviderSchedule from './pages/provider/Schedule';
import ProviderProfile from './pages/provider/Profile';
import ProviderMessages from './pages/provider/Messages';
import AdminDashboard from './pages/admin/Dashboard';
import AdminPatients from './pages/admin/Patients';
import AdminProviders from './pages/admin/Providers';
import AdminRequests from './pages/admin/Requests';
import AdminProfile from './pages/admin/Profile';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<AuthPage />} />
          <Route path="register" element={<AuthPage />} />
        </Route>
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient/providers" element={<PatientProviders />} />
        <Route path="/patient/requests" element={<PatientRequests />} />
        <Route path="/patient/messages" element={<PatientMessages />} />
        <Route path="/patient/profile" element={<PatientProfile />} />
        <Route path="/provider/dashboard" element={<ProviderDashboard />} />
        <Route path="/provider/requests" element={<ProviderRequests />} />
        <Route path="/provider/patients" element={<ProviderPatients />} />
        <Route path="/provider/schedule" element={<ProviderSchedule />} />
        <Route path="/provider/profile" element={<ProviderProfile />} />
        <Route path="/provider/messages" element={<ProviderMessages />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/patients" element={<AdminPatients />} />
        <Route path="/admin/providers" element={<AdminProviders />} />
        <Route path="/admin/requests" element={<AdminRequests />} />
        <Route path="/admin/profile" element={<AdminProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
