import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Filter, ShieldCheck, MoreVertical, Star, ChevronDown } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';

const AdminProviders = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const providers = [
    { id: 'PRO-001', name: 'Dr. Maria Santos', service: 'Wound Care', rating: 5.0, status: 'Verified' },
    { id: 'PRO-002', name: 'Nurse Jose Reyes', service: 'Elder Care', rating: 4.5, status: 'Verified' },
    { id: 'PRO-003', name: 'Dr. Ana Cruz', service: 'Physical Therapy', rating: 4.8, status: 'Pending' },
    { id: 'PRO-004', name: 'Pedro Lim, RN', service: 'Medication Management', rating: 4.2, status: 'Verified' },
    { id: 'PRO-005', name: 'Rosa Garcia, PT', service: 'Post-Surgery Care', rating: 5.0, status: 'Under Review' },
    { id: 'PRO-006', name: 'Dr. Antonio Luna', service: 'General Checkup', rating: 4.9, status: 'Verified' },
    { id: 'PRO-007', name: 'Melchora Aquino', service: 'Elder Care', rating: 5.0, status: 'Verified' },
    { id: 'PRO-008', name: 'Juan Luna, RN', service: 'Wound Care', rating: 4.6, status: 'Verified' },
    { id: 'PRO-009', name: 'Marcelo Del Pilar', service: 'Medication', rating: 4.4, status: 'Pending' },
    { id: 'PRO-010', name: 'Gregorio Del Pilar', service: 'Physical Therapy', rating: 4.7, status: 'Verified' },
    { id: 'PRO-011', name: 'Dr. Jose Rizal', service: 'Ophthalmology', rating: 5.0, status: 'Verified' },
    { id: 'PRO-012', name: 'Andres Bonifacio', service: 'Emergency Care', rating: 4.8, status: 'Verified' },
    { id: 'PRO-013', name: 'Apolinario Mabini', service: 'Rehabilitation', rating: 4.9, status: 'Verified' },
    { id: 'PRO-014', name: 'Gabriela Silang', service: 'Post-Surgery Care', rating: 4.5, status: 'Verified' },
    { id: 'PRO-015', name: 'Emilio Aguinaldo', service: 'Elder Care', rating: 4.0, status: 'Pending' },
  ];

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Providers</h1>
            <p className="text-slate-500">Review and verify healthcare professionals</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm"
              />
            </div>
            <CustomSelect 
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'All', label: 'All Status' },
                { value: 'Verified', label: 'Verified' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Under Review', label: 'Under Review' },
              ]}
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredProviders.map((p, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{p.id}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    p.status === 'Verified' ? 'bg-green-100 text-green-700' :
                    p.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-primary'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{p.service}</span>
                  <div className="flex items-center gap-1 text-yellow-500 font-bold">
                    <Star className="w-3 h-3 fill-current" />
                    {p.rating.toFixed(1)}
                  </div>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button className="text-primary font-bold text-xs" onClick={() => alert(`Reviewing provider ${p.name}`)}>
                    Review Provider
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Provider ID</th>
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">Specialization</th>
                  <th className="px-6 py-4 font-bold">Rating</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProviders.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">{p.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-bold text-slate-700 block">{p.name}</span>
                          {p.status === 'Verified' && <div className="flex items-center gap-1 text-[10px] text-primary font-bold"><ShieldCheck className="w-3 h-3" /> VERIFIED</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{p.service}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                        <Star className="w-4 h-4 fill-current" />
                        {p.rating.toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        p.status === 'Verified' ? 'bg-green-100 text-green-700' :
                        p.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-primary'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => alert(`Reviewing provider ${p.name}`)}>
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredProviders.length === 0 && (
            <div className="p-10 text-center text-slate-500">No providers found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminProviders;
