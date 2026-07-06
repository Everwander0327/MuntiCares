import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, FileText, MessageCircle, Settings, CalendarDays, Briefcase, Users, Heart, LogOut } from 'lucide-react';

const initials = {
  patient: 'JD',
  provider: 'MR',
  admin: 'AD',
};

const names = {
  patient: 'Juan Dela Cruz',
  provider: 'Maria Reyes',
  admin: 'Admin User',
};

const roleLinks = {
  patient: [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/patient/dashboard' },
    { icon: Search, label: 'Find Providers', to: '/patient/providers' },
    { icon: FileText, label: 'My Requests', to: '/patient/requests' },
    { icon: MessageCircle, label: 'Messages', to: '/patient/messages' },
    { icon: Settings, label: 'Profile', to: '/patient/profile' },
  ],
  provider: [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/provider/dashboard' },
    { icon: FileText, label: 'Requests', to: '/provider/requests' },
    { icon: Users, label: 'Patients', to: '/provider/patients' },
    { icon: CalendarDays, label: 'Schedule', to: '/provider/schedule' },
    { icon: Settings, label: 'Profile', to: '/provider/profile' },
    { icon: MessageCircle, label: 'Messages', to: '/provider/messages' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/admin/dashboard' },
    { icon: Users, label: 'Patients', to: '/admin/patients' },
    { icon: Briefcase, label: 'Providers', to: '/admin/providers' },
    { icon: FileText, label: 'Requests', to: '/admin/requests' },
    { icon: Settings, label: 'Profile', to: '/admin/profile' },
  ],
};

const DashboardLayout = ({ children, role = 'patient' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const links = roleLinks[role] || roleLinks.patient;

  const handleLogout = () => {
    localStorage.removeItem('mc_user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-100 min-h-screen p-6 hidden lg:flex flex-col">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="bg-primary p-2 rounded-lg">
            <Heart className="text-white w-5 h-5" fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-primary">MuntiCares</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  active
                    ? 'bg-primary text-white shadow-md'
                    : 'text-slate-500 hover:bg-blue-50 hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
            <p className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{names[role]}</p>
              <p className="text-xs text-slate-500 capitalize">{role}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
              {initials[role]}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10">
          {children}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-slate-100">
        <div className="flex items-center justify-around px-2 py-1">
          {links.slice(0, 5).map((link) => {
            const Icon = link.icon;
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.label}
                to={link.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                  active ? 'text-primary' : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-2xs font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
