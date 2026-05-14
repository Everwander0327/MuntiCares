import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Heart,
  Users,
  Briefcase,
  Bell,
  ChevronLeft
} from 'lucide-react';

const SidebarItem = ({ icon, label, to, active, onClick }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-blue-50 hover:text-primary'}`}
  >
    {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-primary'}` })}
    <span className="font-semibold">{label}</span>
  </Link>
);

const DashboardLayout = ({ children, role = 'patient' }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const patientLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/patient/dashboard' },
    { icon: <Search />, label: 'Find Providers', to: '/patient/providers' },
    { icon: <FileText />, label: 'My Requests', to: '/patient/requests' },
    { icon: <Settings />, label: 'Consent Settings', to: '/patient/consent' },
  ];

  const providerLinks = [
    { icon: <LayoutDashboard />, label: 'Dashboard', to: '/provider/dashboard' },
    { icon: <Bell />, label: 'Incoming Requests', to: '/provider/requests' },
    { icon: <Users />, label: 'My Patients', to: '/provider/patients' },
    { icon: <User />, label: 'Profile', to: '/provider/profile' },
  ];

  const adminLinks = [
    { icon: <LayoutDashboard />, label: 'Overview', to: '/admin/dashboard' },
    { icon: <Users />, label: 'Patients', to: '/admin/patients' },
    { icon: <Briefcase />, label: 'Providers', to: '/admin/providers' },
    { icon: <FileText />, label: 'Requests', to: '/admin/requests' },
  ];

  const links = role === 'patient' ? patientLinks : role === 'provider' ? providerLinks : adminLinks;

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-10">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-primary p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <Heart className="text-white w-5 h-5" fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-primary tracking-tight">MuntiCares</span>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto">
            {links.map((link) => (
              <SidebarItem 
                key={link.label} 
                {...link} 
                active={location.pathname === link.to}
                onClick={() => setIsSidebarOpen(false)}
              />
            ))}
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all w-full group"
            >
              <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
              <span className="font-semibold">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-10 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-500 p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-sm md:text-lg font-bold text-slate-900 truncate max-w-[200px] md:max-w-none">
              {role === 'patient' ? 'Welcome back, Juan!' : role === 'provider' ? 'Welcome, Maria Santos!' : 'Admin Panel'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-primary font-bold shadow-sm border border-white shrink-0">
              {role === 'patient' ? 'JD' : role === 'provider' ? 'MS' : 'AD'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
};

const User = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default DashboardLayout;
