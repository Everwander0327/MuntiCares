import DashboardLayout from '../../layouts/DashboardLayout';

const requests = [
  { patient: 'Maria Santos', provider: 'Maria Reyes', service: 'Home Nursing', date: 'Jan 15, 2026', status: 'Pending' },
  { patient: 'Pedro Gonzales', provider: 'Juan Santos', service: 'Physical Therapy', date: 'Jan 14, 2026', status: 'Accepted' },
  { patient: 'Ana Cruz', provider: 'Ana Cruz', service: 'Senior Care', date: 'Jan 13, 2026', status: 'Completed' },
  { patient: 'Jose Garcia', provider: 'Pedro Gonzales', service: 'Child Care', date: 'Jan 12, 2026', status: 'Cancelled' },
];

const AdminRequests = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">All Requests</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patient</th>
                <th className="px-6 py-4 font-semibold">Provider</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{r.patient}</td>
                  <td className="px-6 py-4 text-slate-600">{r.provider}</td>
                  <td className="px-6 py-4 text-slate-600">{r.service}</td>
                  <td className="px-6 py-4 text-slate-600">{r.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      r.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                      r.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                      r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.status}</span>
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

export default AdminRequests;
