import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, ChevronDown } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';

const AdminRequests = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  
  const requests = [
    { id: 'REQ-101', patient: 'Juan Dela Cruz', provider: 'Maria Santos', service: 'Wound Care', status: 'Accepted', date: 'Oct 24, 2025' },
    { id: 'REQ-102', patient: 'Liza Soberano', provider: 'Jose Reyes', service: 'Elder Care', status: 'Pending', date: 'Oct 24, 2025' },
    { id: 'REQ-103', patient: 'Enrique Gil', provider: 'Maria Santos', service: 'Medication', status: 'Accepted', date: 'Oct 23, 2025' },
    { id: 'REQ-104', patient: 'Kathryn Bernardo', provider: 'Ana Cruz', service: 'Physical Therapy', status: 'Rejected', date: 'Oct 22, 2025' },
    { id: 'REQ-105', patient: 'Daniel Padilla', provider: 'Pedro Lim', service: 'Checkup', status: 'Accepted', date: 'Oct 22, 2025' },
    { id: 'REQ-106', patient: 'Ricardo Dalisay', provider: 'Antonio Luna', service: 'Emergency', status: 'Accepted', date: 'Oct 21, 2025' },
    { id: 'REQ-107', patient: 'Nora Aunor', provider: 'Melchora Aquino', service: 'Elder Care', status: 'Accepted', date: 'Oct 20, 2025' },
    { id: 'REQ-108', patient: 'Vilma Santos', provider: 'Jose Rizal', service: 'Eye Care', status: 'Pending', date: 'Oct 19, 2025' },
    { id: 'REQ-109', patient: 'Sharon Cuneta', provider: 'Andres Bonifacio', service: 'Checkup', status: 'Accepted', date: 'Oct 18, 2025' },
    { id: 'REQ-110', patient: 'Piolo Pascual', provider: 'Apolinario Mabini', service: 'Rehab', status: 'Accepted', date: 'Oct 17, 2025' },
    { id: 'REQ-111', patient: 'Dolphy Quizon', provider: 'Gabriela Silang', service: 'Home Nursing', status: 'Accepted', date: 'Oct 16, 2025' },
    { id: 'REQ-112', patient: 'Gloria Romero', provider: 'Maria Santos', service: 'Wound Care', status: 'Pending', date: 'Oct 15, 2025' },
    { id: 'REQ-113', patient: 'Eddie Garcia', provider: 'Jose Reyes', service: 'Elder Care', status: 'Accepted', date: 'Oct 14, 2025' },
    { id: 'REQ-114', patient: 'Fernando Poe Jr.', provider: 'Ana Cruz', service: 'Physio', status: 'Accepted', date: 'Oct 13, 2025' },
    { id: 'REQ-115', patient: 'James Reid', provider: 'Pedro Lim', service: 'Medication', status: 'Rejected', date: 'Oct 12, 2025' },
  ];

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.patient.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Platform Requests</h1>
            <p className="text-slate-500">Monitor all service interactions across Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search requests..."
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
                { value: 'Accepted', label: 'Accepted' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredRequests.map((r, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{r.service}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    r.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                    r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <p><span className="text-slate-400">Patient:</span> {r.patient}</p>
                  <p><span className="text-slate-400">Provider:</span> {r.provider}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">{r.date}</span>
                  <button className="text-primary font-bold text-xs">Details</button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Request ID</th>
                  <th className="px-6 py-4 font-bold">Patient</th>
                  <th className="px-6 py-4 font-bold">Provider</th>
                  <th className="px-6 py-4 font-bold">Service</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRequests.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">{r.id}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">{r.patient}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-medium">{r.provider}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-50 rounded-lg text-xs text-slate-500 font-semibold">{r.service}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        r.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                        r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 text-sm">
                      {r.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRequests.length === 0 && (
            <div className="p-10 text-center text-slate-500">No requests found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRequests;
