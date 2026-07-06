import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';

const AdminProfile = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('mc_user');
    navigate('/');
  };

  return (
    <DashboardLayout role="admin">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">AD</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Admin User</h1>
          <p className="text-slate-500">Platform Administrator</p>
          <p className="text-slate-400 text-sm mt-1">admin@mnticares.com</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Account Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Full Name</span>
              <span className="font-semibold text-slate-900">Admin User</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-900">admin@mnticares.com</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Role</span>
              <span className="font-semibold text-slate-900">Administrator</span>
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

export default AdminProfile;
