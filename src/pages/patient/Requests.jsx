import DashboardLayout from '../../layouts/DashboardLayout';

const requests = [
  { provider: 'Maria Santos', service: 'Senior Care', date: 'Jan 15, 2026', status: 'Accepted' },
  { provider: 'Juan Reyes', service: 'Physical Therapy', date: 'Jan 12, 2026', status: 'Completed' },
  { provider: 'Ana Cruz', service: 'Home Nursing', date: 'Jan 10, 2026', status: 'Pending' },
  { provider: 'Pedro Gonzales', service: 'Child Care', date: 'Jan 8, 2026', status: 'Cancelled' },
];

const PatientRequests = () => {
  return (
    <DashboardLayout role="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
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
              {requests.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{r.provider}</td>
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

export default PatientRequests;
