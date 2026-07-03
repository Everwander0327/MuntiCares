import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const stats = [
  { label: 'Active Requests', value: '3', icon: Clock, color: 'bg-blue-50 text-primary' },
  { label: 'Accepted Providers', value: '2', icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
  { label: 'Pending Requests', value: '1', icon: AlertCircle, color: 'bg-yellow-50 text-yellow-600' },
];

const recentRequests = [
  { provider: 'Maria Santos', service: 'Senior Care', date: 'Jan 15, 2026', status: 'Accepted' },
  { provider: 'Juan Reyes', service: 'Physical Therapy', date: 'Jan 12, 2026', status: 'Completed' },
  { provider: 'Ana Cruz', service: 'Home Nursing', date: 'Jan 10, 2026', status: 'Pending' },
];

const PatientDashboard = () => {
  return (
    <DashboardLayout role="patient">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
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
            <h3 className="text-lg font-bold text-slate-900">Recent Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Provider</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-700">{r.provider}</td>
                    <td className="px-6 py-4 text-slate-600">{r.service}</td>
                    <td className="px-6 py-4 text-slate-600">{r.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        r.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                        r.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.status}</span>
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

export default PatientDashboard;
