import DashboardLayout from '../../layouts/DashboardLayout';

const patients = [
  { name: 'Juan Dela Cruz', email: 'juan@example.com', requests: 5, joined: 'Jan 2026' },
  { name: 'Maria Santos', email: 'maria@example.com', requests: 3, joined: 'Dec 2025' },
  { name: 'Pedro Gonzales', email: 'pedro@example.com', requests: 8, joined: 'Nov 2025' },
  { name: 'Ana Cruz', email: 'ana@example.com', requests: 2, joined: 'Jan 2026' },
];

const AdminPatients = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Requests</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{p.name}</td>
                  <td className="px-6 py-4 text-slate-600">{p.email}</td>
                  <td className="px-6 py-4 text-slate-600">{p.requests}</td>
                  <td className="px-6 py-4 text-slate-600">{p.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPatients;
