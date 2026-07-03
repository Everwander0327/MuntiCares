import DashboardLayout from '../../layouts/DashboardLayout';

const providers = [
  { name: 'Maria Santos', service: 'Senior Care', rating: 4.8, location: 'Muntinlupa City' },
  { name: 'Juan Reyes', service: 'Physical Therapy', rating: 4.6, location: 'Alabang' },
  { name: 'Ana Cruz', service: 'Home Nursing', rating: 4.9, location: 'Sucat' },
  { name: 'Pedro Gonzales', service: 'Child Care', rating: 4.5, location: 'Putatan' },
  { name: 'Luzviminda Torres', service: 'Elderly Companion', rating: 4.7, location: 'Tunasan' },
];

const PatientProviders = () => {
  return (
    <DashboardLayout role="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Find a Provider</h1>
        <input
          type="text"
          placeholder="Search providers..."
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary"
        />
        <div className="grid gap-4">
          {providers.map((p, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                  <p className="text-slate-500 text-sm">{p.service}</p>
                  <p className="text-slate-400 text-xs mt-1">{p.location}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-500 font-bold">★ {p.rating}</p>
                  <button className="mt-2 btn-primary text-xs px-4 py-1.5">Book</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientProviders;
