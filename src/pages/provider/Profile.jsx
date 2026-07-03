import DashboardLayout from '../../layouts/DashboardLayout';

const ProviderProfile = () => {
  return (
    <DashboardLayout role="provider">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">MR</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Maria Reyes</h1>
          <p className="text-slate-500">Registered Nurse</p>
          <p className="text-slate-400 text-sm mt-1">Muntinlupa City</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <span className="text-yellow-500 font-bold">★ 4.8</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">About</h2>
          <p className="text-slate-600">Experienced registered nurse with 5 years of home care experience. Specialized in senior care, wound care, and medication management.</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Services Offered</h2>
          <div className="flex flex-wrap gap-2">
            {['Home Nursing', 'Senior Care', 'Medication Management'].map((s, i) => (
              <span key={i} className="px-3 py-1 bg-blue-50 text-primary rounded-full text-sm font-medium">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderProfile;
