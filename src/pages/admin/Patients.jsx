import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Filter, MoreVertical, Shield, ChevronDown } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';

const AdminPatients = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const patients = [
    { id: 'PAT-001', name: 'Juan Dela Cruz', email: 'juan.dc@email.ph', joinDate: 'Jan 12, 2025', status: 'Verified' },
    { id: 'PAT-002', name: 'Maria Makiling', email: 'm.makiling@cloud.com', joinDate: 'Jan 15, 2025', status: 'Pending' },
    { id: 'PAT-003', name: 'Pedro Penduko', email: 'pedro.p@munti.gov.ph', joinDate: 'Feb 02, 2025', status: 'Verified' },
    { id: 'PAT-004', name: 'Liza Soberano', email: 'liza.s@star.ph', joinDate: 'Feb 10, 2025', status: 'Verified' },
    { id: 'PAT-005', name: 'Enrique Gil', email: 'egil@mail.com', joinDate: 'Feb 12, 2025', status: 'Banned' },
    { id: 'PAT-006', name: 'Ricardo Dalisay', email: 'carding.d@pnp.gov.ph', joinDate: 'Mar 01, 2025', status: 'Verified' },
    { id: 'PAT-007', name: 'Nora Aunor', email: 'superstar@nora.ph', joinDate: 'Mar 05, 2025', status: 'Verified' },
    { id: 'PAT-008', name: 'Vilma Santos', email: 'ate.vi@batangas.ph', joinDate: 'Mar 12, 2025', status: 'Pending' },
    { id: 'PAT-009', name: 'Fernando Poe Jr.', label: 'Da King', email: 'fpj@king.ph', joinDate: 'Apr 20, 2025', status: 'Verified' },
    { id: 'PAT-010', name: 'Dolphy Quizon', email: 'dolphy@comedy.ph', joinDate: 'May 05, 2025', status: 'Verified' },
    { id: 'PAT-011', name: 'Gloria Romero', email: 'gloria@cinema.ph', joinDate: 'May 10, 2025', status: 'Verified' },
    { id: 'PAT-012', name: 'Eddie Garcia', email: 'manoy@mail.ph', joinDate: 'May 15, 2025', status: 'Verified' },
    { id: 'PAT-013', name: 'Sharon Cuneta', email: 'sharon.c@mega.ph', joinDate: 'Jun 01, 2025', status: 'Pending' },
    { id: 'PAT-014', name: 'Piolo Pascual', email: 'pj@pascual.ph', joinDate: 'Jun 05, 2025', status: 'Verified' },
    { id: 'PAT-015', name: 'Kathryn Bernardo', email: 'kath@bernardo.ph', joinDate: 'Jun 10, 2025', status: 'Verified' },
  ];

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Patients</h1>
            <p className="text-slate-500">Overview of all registered patients in Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search patients..."
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
                { value: 'Banned', label: 'Banned' },
              ]}
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredPatients.map((p, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.id}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    p.status === 'Verified' ? 'bg-green-100 text-green-700' :
                    p.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{p.email}</p>
                  <p className="text-slate-400 text-xs mt-1">Joined: {p.joinDate}</p>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button className="text-primary font-bold text-xs" onClick={() => alert(`Options for ${p.name}`)}>
                    View Options
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
                  <th className="px-6 py-4 font-bold">Patient ID</th>
                  <th className="px-6 py-4 font-bold">Full Name</th>
                  <th className="px-6 py-4 font-bold">Email</th>
                  <th className="px-6 py-4 font-bold">Join Date</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPatients.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">{p.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-bold text-slate-700">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{p.email}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{p.joinDate}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        p.status === 'Verified' ? 'bg-green-100 text-green-700' :
                        p.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => alert(`Options for ${p.name}`)}>
                        <MoreVertical className="w-5 h-5" />
                      </button>
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

export default AdminPatients;
