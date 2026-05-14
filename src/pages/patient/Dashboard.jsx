import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

const PatientDashboard = () => {
  const requests = [
    { provider: 'Maria Santos', service: 'Wound Care', date: 'Oct 24, 2025', status: 'Accepted' },
    { provider: 'Jose Reyes', service: 'Elder Care', date: 'Oct 25, 2025', status: 'Pending' },
    { provider: 'Ana Cruz', service: 'Physical Therapy', date: 'Oct 26, 2025', status: 'Rejected' },
  ];

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Active Requests" 
            value="2" 
            icon={<Clock />} 
            color="bg-blue-50 text-primary" 
          />
          <StatCard 
            label="Accepted Providers" 
            value="1" 
            icon={<CheckCircle2 />} 
            color="bg-green-50 text-green-600" 
          />
          <StatCard 
            label="Pending Requests" 
            value="3" 
            icon={<AlertCircle />} 
            color="bg-yellow-50 text-yellow-600" 
          />
        </div>

        {/* Recent Requests Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Recent Requests</h3>
            <button className="text-primary font-semibold text-sm hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Provider Name</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map((req, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                          {req.provider.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-slate-700">{req.provider}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{req.service}</td>
                    <td className="px-6 py-4 text-slate-600">{req.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        req.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                        req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {req.status}
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

export default PatientDashboard;
