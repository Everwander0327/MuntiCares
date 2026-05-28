import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Platform Requests</h1>
            <p className="text-slate-500 dark:text-slate-400">Monitor all service interactions across Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
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
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
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
                    <p className="font-bold text-slate-900 dark:text-slate-100">{r.service}</p>
                    <p className="text-2xs text-slate-400 dark:text-slate-500 font-mono">{r.id}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-widest ${
                    r.status === 'Accepted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    r.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
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
                <div className="text-sm text-slate-600 space-y-1 dark:text-slate-300">
                  <p><span className="text-slate-400 dark:text-slate-500">Patient:</span> {r.patient}</p>
                  <p><span className="text-slate-400 dark:text-slate-500">Provider:</span> {r.provider}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50 dark:border-slate-700">
                  <span className="text-2xs text-slate-400 uppercase font-bold dark:text-slate-500">{r.date}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-semibold">Request ID</th>
                  <th className="px-6 py-4 font-semibold">Patient</th>
                  <th className="px-6 py-4 font-semibold">Provider</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Date</th>
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
                    <td className="px-6 py-4 text-sm font-mono text-slate-400 dark:text-slate-500">{r.id.split('-')[0]}...</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{r.patient}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-medium dark:text-slate-300">{r.provider}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-50 rounded-lg text-xs text-slate-500 font-semibold dark:bg-slate-800 dark:text-slate-400">{r.service}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest ${
                        r.status === 'Accepted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        r.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        r.status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
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
                    <td className="px-6 py-4 text-right text-slate-500 text-sm dark:text-slate-400">
                      {r.date}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRequests.length === 0 && (
            <EmptyState icon="inbox" title="No requests found" message="No requests match your current search or filter." variant="compact" />
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Showing {filteredRequests.length} of {requests.length} results</p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRequests;
