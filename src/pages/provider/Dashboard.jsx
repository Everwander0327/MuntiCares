import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, Users, CheckCircle, ChevronRight, Check, X } from 'lucide-react';

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
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

const ProviderDashboard = () => {
  const requests = [
    { patient: 'Juan Dela Cruz', service: 'Wound Care Dressing', date: 'Oct 28, 2025' },
    { patient: 'Liza Soberano', service: 'Blood Pressure Monitoring', date: 'Oct 29, 2025' },
    { patient: 'Enrique Gil', service: 'Medication Assistance', date: 'Oct 30, 2025' },
  ];

  return (
    <DashboardLayout role="provider">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Pending Requests" 
            value="4" 
            icon={<Clock />} 
            color="bg-yellow-50 text-yellow-600" 
          />
          <StatCard 
            label="Active Patients" 
            value="6" 
            icon={<Users />} 
            color="bg-blue-50 text-primary" 
          />
          <StatCard 
            label="Completed Services" 
            value="23" 
            icon={<CheckCircle />} 
            color="bg-green-50 text-green-600" 
          />
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Incoming Requests</h3>
            <button className="text-primary font-semibold text-sm hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Service Needed</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map((req, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-700">{req.patient}</td>
                    <td className="px-6 py-4 text-slate-600">{req.service}</td>
                    <td className="px-6 py-4 text-slate-600">{req.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm">
                          <Check className="w-5 h-5" />
                        </button>
                        <button className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
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

export default ProviderDashboard;
