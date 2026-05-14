import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Briefcase, FileText, ShieldAlert, TrendingUp } from 'lucide-react';

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-lg">
        <TrendingUp className="w-3 h-3" />
        <span>+12%</span>
      </div>
    </div>
    <p className="text-slate-500 text-sm font-medium">{label}</p>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

const AdminDashboard = () => {
  const activities = [
    { user: 'Juan Dela Cruz', action: 'Requested Wound Care', date: 'Oct 24, 2:15 PM', status: 'Pending' },
    { user: 'Maria Santos', action: 'Updated Profile', date: 'Oct 24, 1:45 PM', status: 'Success' },
    { user: 'Admin', action: 'Verified Provider Jose Reyes', date: 'Oct 24, 11:30 AM', status: 'Success' },
    { user: 'Pedro Lim', action: 'New Provider Registration', date: 'Oct 24, 9:20 AM', status: 'Review' },
    { user: 'System', action: 'Automated Backup Completed', date: 'Oct 24, 3:00 AM', status: 'Success' },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Patients" 
            value="128" 
            icon={<Users />} 
            color="bg-blue-50 text-primary" 
          />
          <StatCard 
            label="Total Providers" 
            value="34" 
            icon={<Briefcase />} 
            color="bg-purple-50 text-purple-600" 
          />
          <StatCard 
            label="Total Requests" 
            value="267" 
            icon={<FileText />} 
            color="bg-orange-50 text-orange-600" 
          />
          <StatCard 
            label="Pending Approvals" 
            value="5" 
            icon={<ShieldAlert />} 
            color="bg-red-50 text-red-600" 
          />
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
            <button className="text-primary font-semibold text-sm hover:underline">Download Log</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activities.map((act, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{act.user}</td>
                    <td className="px-6 py-4 text-slate-600">{act.action}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{act.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        act.status === 'Success' ? 'bg-green-100 text-green-700' :
                        act.status === 'Review' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-primary'
                      }`}>
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
