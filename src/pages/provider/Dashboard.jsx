import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, Users, CheckCircle } from 'lucide-react';

const stats = [
  { label: 'Pending Requests', value: '2', icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
  { label: 'Active Patients', value: '5', icon: Users, color: 'bg-blue-50 text-primary' },
  { label: 'Completed Services', value: '12', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
];

const upcomingSchedule = [
  { patient: 'Juana Santos', time: '09:00 AM', service: 'Senior Care', date: 'Jan 15' },
  { patient: 'Pedro Reyes', time: '02:00 PM', service: 'Physical Therapy', date: 'Jan 15' },
];

const ProviderDashboard = () => {
  return (
    <DashboardLayout role="provider">
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

        <div className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 text-white">
          <h3 className="font-semibold text-blue-200 mb-4">Upcoming Schedule</h3>
          <div className="space-y-3">
            {upcomingSchedule.map((a, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/10 rounded-2xl p-4">
                <div className="text-center w-20">
                  <p className="text-lg font-bold">{a.time}</p>
                  <p className="text-xs text-blue-200">{a.date}</p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div>
                  <p className="font-bold">{a.patient}</p>
                  <p className="text-blue-200 text-sm">{a.service}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Incoming Requests</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patient</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {[
                { patient: 'Maria Santos', service: 'Home Nursing', date: 'Jan 20' },
                { patient: 'Jose Garcia', service: 'Child Care', date: 'Jan 22' },
              ].map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{r.patient}</td>
                  <td className="px-6 py-4 text-slate-600">{r.service}</td>
                  <td className="px-6 py-4 text-slate-600">{r.date}</td>
                  <td className="px-6 py-4 flex gap-2">
                    <button className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white">Accept</button>
                    <button className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white">Decline</button>
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

export default ProviderDashboard;
