import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Briefcase, FileText, ShieldAlert } from 'lucide-react';

const stats = [
  { label: 'Total Patients', value: '1,250', icon: Users, color: 'bg-blue-50 text-primary' },
  { label: 'Total Providers', value: '85', icon: Briefcase, color: 'bg-purple-50 text-purple-600' },
  { label: 'Total Requests', value: '520', icon: FileText, color: 'bg-orange-50 text-orange-600' },
  { label: 'Pending Approvals', value: '3', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
];

const recentActivity = [
  { user: 'Maria Santos', action: 'Requested Home Nursing', date: 'Jan 15, 2026', status: 'Pending' },
  { user: 'Pedro Gonzales', action: 'Requested Physical Therapy', date: 'Jan 14, 2026', status: 'Accepted' },
  { user: 'Ana Cruz', action: 'Requested Senior Care', date: 'Jan 13, 2026', status: 'Completed' },
];

const AdminDashboard = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Platform overview</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-gradient-to-br from-blue-50 to-white">
              <div className={`p-2 w-fit rounded-xl ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-sm mt-2">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Recent Service Requests</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patient</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((a, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{a.user}</td>
                  <td className="px-6 py-4 text-slate-600">{a.action}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">{a.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      a.status === 'Completed' ? 'bg-green-100 text-green-700' :
                      a.status === 'Accepted' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
