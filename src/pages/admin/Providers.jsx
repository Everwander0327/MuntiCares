import DashboardLayout from '../../layouts/DashboardLayout';

const providers = [
  { name: 'Maria Reyes', service: 'Home Nursing', rating: 4.8, approved: true },
  { name: 'Juan Santos', service: 'Physical Therapy', rating: 4.6, approved: true },
  { name: 'Ana Cruz', service: 'Senior Care', rating: 4.9, approved: false },
  { name: 'Pedro Gonzales', service: 'Child Care', rating: 4.5, approved: true },
];

const AdminProviders = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Providers</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Rating</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{p.name}</td>
                  <td className="px-6 py-4 text-slate-600">{p.service}</td>
                  <td className="px-6 py-4">
                    <span className="text-yellow-500 font-bold">★ {p.rating}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      p.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{p.approved ? 'Approved' : 'Pending'}</span>
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

export default AdminProviders;
