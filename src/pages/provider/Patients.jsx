import DashboardLayout from '../../layouts/DashboardLayout';

const ProviderPatients = () => {
  const patients = [
    { name: 'Maria Santos', service: 'Home Nursing', lastVisit: 'Jan 12, 2026', status: 'Active' },
    { name: 'Pedro Gonzales', service: 'Physical Therapy', lastVisit: 'Jan 10, 2026', status: 'Active' },
    { name: 'Juana Torres', service: 'Senior Care', lastVisit: 'Dec 28, 2025', status: 'Completed' },
  ];

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Last Visit</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{p.name}</td>
                  <td className="px-6 py-4 text-slate-600">{p.service}</td>
                  <td className="px-6 py-4 text-slate-600">{p.lastVisit}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>{p.status}</span>
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

export default ProviderPatients;
