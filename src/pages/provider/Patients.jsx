import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { MessageSquare, Phone, ChevronRight, Search } from 'lucide-react';

const ProviderPatients = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const patients = [
    { name: 'Juan Dela Cruz', service: 'Wound Care', lastVisit: 'Oct 20, 2025', status: 'Active' },
    { name: 'Maria Makiling', service: 'Elder Care', lastVisit: 'Oct 22, 2025', status: 'Active' },
    { name: 'Leonor Rivera', service: 'Physical Therapy', lastVisit: 'Oct 15, 2025', status: 'On Hold' },
    { name: 'Crisostomo Ibarra', service: 'Medication Management', lastVisit: 'Oct 23, 2025', status: 'Active' },
    { name: 'Simoun Reyes', service: 'Palliative Care', lastVisit: 'Oct 10, 2025', status: 'Active' },
    { name: 'Basilio Santos', service: 'Wound Care', lastVisit: 'Oct 24, 2025', status: 'Active' },
    { name: 'Crispin Roxas', service: 'Checkup', lastVisit: 'Oct 21, 2025', status: 'Active' },
    { name: 'Sisa Dela Cruz', service: 'Mental Health', lastVisit: 'Oct 18, 2025', status: 'Active' },
    { name: 'Padre Florentino', service: 'Elder Care', lastVisit: 'Oct 19, 2025', status: 'Active' },
    { name: 'Isagani Gil', service: 'Physio', lastVisit: 'Oct 22, 2025', status: 'Active' },
    { name: 'Paulita Gomez', service: 'Medication', lastVisit: 'Oct 23, 2025', status: 'Active' },
    { name: 'Doña Victorina', service: 'Post-Surgery', lastVisit: 'Oct 24, 2025', status: 'Active' },
  ];

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.service.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="provider">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Patients</h1>
            <p className="text-slate-500">Manage your active patient list</p>
          </div>
          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredPatients.map((p, idx) => (
              <div key={idx} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-primary font-semibold">{p.service}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Last Visit: {p.lastVisit}</p>
                  <div className="flex gap-2">
                    <button className="p-2 bg-slate-50 text-slate-400 hover:text-primary rounded-lg transition-colors" onClick={() => alert(`Messaging ${p.name}`)}>
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button className="p-2 bg-slate-50 text-slate-400 hover:text-primary rounded-lg transition-colors" onClick={() => alert(`Calling ${p.name}`)}>
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Last Visit</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPatients.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-bold text-slate-700">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{p.service}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{p.lastVisit}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 text-slate-400 hover:text-primary transition-colors" onClick={() => alert(`Messaging ${p.name}`)}>
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-primary transition-colors" onClick={() => alert(`Calling ${p.name}`)}>
                          <Phone className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-primary transition-colors" onClick={() => alert(`Viewing details for ${p.name}`)}>
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPatients.length === 0 && (
            <div className="p-10 text-center text-slate-500">No patients found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderPatients;
