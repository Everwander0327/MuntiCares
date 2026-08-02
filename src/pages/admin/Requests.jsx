import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Download, ArrowUpDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import DateRangePicker from '../../components/DateRangePicker';
import Pagination from '../../components/Pagination';
import useSort from '../../hooks/useSort';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { exportToCSV, formatDataForExport } from '../../lib/exportUtils';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const AdminRequests = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);

  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(requests);

  const fetchRequests = useCallback(async () => {
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
          patient:patient_id(full_name, email),
          provider:provider_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(r => ({
        id: r.id,
        patient: r.patient?.full_name || 'Unknown',
        patientEmail: r.patient?.email || '',
        provider: r.provider?.full_name || 'Unknown',
        providerEmail: r.provider?.email || '',
        service: r.service,
        status: r.status,
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: r.time || '',
        timestamp: new Date(r.created_at).getTime(),
        created_at: r.created_at,
      }));

      setRequests(formatted);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleExport = () => {
    const fields = [
      { key: 'id', label: 'Request ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'provider', label: 'Provider' },
      { key: 'service', label: 'Service' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
    ];
    const exportable = formatDataForExport(filteredRequests, fields);
    exportToCSV(exportable, 'requests_export');
    toast.success('Requests exported to CSV.');
  };

  // Filters
  const filteredRequests = sorted.filter(r => {
    const matchesSearch = r.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || r.status === filter;
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(r.timestamp) >= new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(r.timestamp) <= end;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, startDate, endDate, sortKey]);

  const statusColors = {
    Accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    Pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  const statusDots = {
    Accepted: 'bg-blue-500',
    Completed: 'bg-green-500',
    Pending: 'bg-yellow-500',
    Cancelled: 'bg-red-500',
    Rejected: 'bg-red-500',
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  const SortableHeader = ({ label, sortKey: sk, className = '' }) => (
    <th
      className={`px-6 py-4 font-semibold cursor-pointer hover:text-primary transition-colors select-none ${className}`}
      onClick={() => { handleSort(sk); setCurrentPage(1); }}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sk ? 'text-primary' : 'opacity-30'}`} />
        {getSortIndicator(sk)}
      </span>
    </th>
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
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
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
              />
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }}
            />
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
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl bg-white border border-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>
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
            {paginatedRequests.length === 0 ? (
              <EmptyState icon="inbox" title="No requests found" message="No requests match your current search or filter." variant="compact" />
            ) : (
              paginatedRequests.map((r, idx) => (
                <motion.div
                  key={r.id}
                  className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-700/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedRequest(r)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{r.service}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{r.id}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-widest ${statusColors[r.status] || 'bg-slate-100 text-slate-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDots[r.status] || 'bg-slate-400'}`} />
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
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-semibold">Request ID</th>
                  <SortableHeader label="Patient" sortKey="patient" />
                  <SortableHeader label="Provider" sortKey="provider" />
                  <SortableHeader label="Service" sortKey="service" />
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Date" sortKey="date" />
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan="6"><EmptyState icon="inbox" title="No requests found" message="No requests match your current search or filter." variant="compact" /></td>
                  </tr>
                ) : (
                  paginatedRequests.map((r, idx) => (
                    <motion.tr
                      key={r.id}
                      className="transition-colors cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/20 group"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.03 }}
                      onClick={() => setSelectedRequest(r)}
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest ${statusColors[r.status] || 'bg-slate-100 text-slate-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDots[r.status] || 'bg-slate-400'}`} />
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 text-sm dark:text-slate-400">
                        {r.date}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </motion.div>
      </div>

      {/* Request Detail Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedRequest(null)}
          >
            <motion.div
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full dark:bg-slate-800"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Request Details</h2>
                <button onClick={() => setSelectedRequest(null)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors dark:hover:bg-slate-700">
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Request ID</p>
                    <p className="text-sm font-mono text-slate-700 dark:text-slate-200 mt-0.5">{selectedRequest.id}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest ${statusColors[selectedRequest.status] || 'bg-slate-100 text-slate-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDots[selectedRequest.status] || 'bg-slate-400'}`} />
                    {selectedRequest.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                    <p className="text-2xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Patient</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedRequest.patient}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{selectedRequest.patientEmail}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                    <p className="text-2xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Provider</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{selectedRequest.provider}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{selectedRequest.providerEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Service</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{selectedRequest.service}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Schedule</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{selectedRequest.date}{selectedRequest.time ? ` at ${selectedRequest.time}` : ''}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Created</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                    {new Date(selectedRequest.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminRequests;
