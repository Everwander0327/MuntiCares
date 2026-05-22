import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const AdminRequests = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select(`
            id, 
            service, 
            status, 
            date, 
            time, 
            created_at,
            patient:patient_id(full_name),
            provider:provider_id(full_name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(r => ({
          id: r.id,
          patient: r.patient?.full_name || 'Unknown',
          provider: r.provider?.full_name || 'Unknown',
          service: r.service,
          status: r.status,
          date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }));

        setRequests(formatted);
      } catch (err) {
        console.error('Error fetching requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.patient.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || r.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Platform Requests</h1>
            <p className="text-slate-500">Monitor all service interactions across Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
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
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredRequests.map((r, idx) => (
              <motion.div 
                key={r.id} 
                className="p-4 space-y-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{r.service}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{r.id}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    r.status === 'Accepted' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                      r.status === 'Accepted' ? 'bg-blue-500' :
                      r.status === 'Completed' ? 'bg-green-500' :
                      r.status === 'Pending' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <p><span className="text-slate-400">Patient:</span> {r.patient}</p>
                  <p><span className="text-slate-400">Provider:</span> {r.provider}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">{r.date}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
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
              <tbody>
                {filteredRequests.map((r, idx) => (
                  <motion.tr 
                    key={r.id} 
                    className="transition-colors group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.03 }}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">{r.id.split('-')[0]}...</td>
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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        r.status === 'Accepted' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                          r.status === 'Accepted' ? 'bg-blue-500' :
                          r.status === 'Completed' ? 'bg-green-500' :
                          r.status === 'Pending' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500 text-sm">
                      {r.date}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRequests.length === 0 && (
            <div className="p-10 text-center text-slate-500">No requests found.</div>
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {filteredRequests.length} of {requests.length} results</p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRequests;
