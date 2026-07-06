import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';

const PatientProfile = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('mc_user');
    navigate('/');
  };

  return (
    <DashboardLayout role="patient">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">JD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Juan Dela Cruz</h1>
          <p className="text-slate-500">juan@example.com</p>
          <p className="text-slate-400 text-sm mt-1">Muntinlupa City</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Personal Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Full Name</span>
              <span className="font-semibold text-slate-900">Juan Dela Cruz</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-900">juan@example.com</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Phone</span>
              <span className="font-semibold text-slate-900">+63 912 345 6789</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Address</span>
              <span className="font-semibold text-slate-900">Muntinlupa City</span>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 hover:border-red-400 transition-all flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </DashboardLayout>
  );
};

export default PatientProfile;
