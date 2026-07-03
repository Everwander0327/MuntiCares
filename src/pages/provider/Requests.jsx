import DashboardLayout from '../../layouts/DashboardLayout';

const ProviderRequests = () => {
  const requests = [
    { patient: 'Maria Santos', service: 'Home Nursing', date: 'Jan 20, 2026', status: 'Pending' },
    { patient: 'Jose Garcia', service: 'Child Care', date: 'Jan 22, 2026', status: 'Pending' },
    { patient: 'Ana Cruz', service: 'Senior Care', date: 'Jan 18, 2026', status: 'Accepted' },
    { patient: 'Pedro Gonzales', service: 'Physical Therapy', date: 'Jan 15, 2026', status: 'Completed' },
  ];

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Service Requests</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patient</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{r.patient}</td>
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
    </DashboardLayout>
  );
};

export default ProviderRequests;
