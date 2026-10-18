import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Search, Download, ArrowUpDown, X, Calendar, Clock, 
  User, Stethoscope, Check, Trash2, CheckSquare, 
  MapPin, FileText, ChevronRight, AlertCircle, ShieldAlert, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect, DateRangePicker, Pagination, SkeletonPage, EmptyState } from '@/shared/ui';
import useSort from '@/hooks/useSort';
import { supabase } from '@/lib/supabase';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
          notes,
          created_at,
          patient:patient_id(id, full_name, email, avatar_url),
          provider:provider_id(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map(r => {
        let timeLabel = '';
        try {
          if (r.time) {
            timeLabel = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch {
          timeLabel = r.time || '';
        }

        return {
          id: r.id,
          patientId: r.patient?.id || null,
          patient: r.patient?.full_name || 'Unknown Patient',
          patientEmail: r.patient?.email || '',
          patientAvatar: r.patient?.avatar_url || '',
          providerId: r.provider?.id || null,
          provider: r.provider?.full_name || 'Unassigned Provider',
          providerEmail: r.provider?.email || '',
          providerAvatar: r.provider?.avatar_url || '',
          service: r.service || 'General Healthcare',
          status: r.status || 'Pending',
          notes: r.notes || '',
          date: r.date ? new Date(r.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
          time: timeLabel,
          scheduledTimestamp: r.date ? new Date(`${r.date}T${r.time || '00:00'}`).getTime() : 0,
          timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
          created_at: r.created_at,
        };
      });

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
    if (filteredRequests.length === 0) {
      toast.error('No requests to export.');
      return;
    }
    const fields = [
      { key: 'id', label: 'Request ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'patientEmail', label: 'Patient Email' },
      { key: 'provider', label: 'Provider' },
      { key: 'providerEmail', label: 'Provider Email' },
      { key: 'service', label: 'Service' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Scheduled Date' },
      { key: 'time', label: 'Scheduled Time' },
      { key: 'notes', label: 'Notes' },
      { key: 'created_at', label: 'Created At' },
    ];
    const exportable = formatDataForExport(filteredRequests, fields);
    exportToCSV(exportable, 'platform_requests_export');
    toast.success('Requests exported to CSV.');
  };

  // Status updates
  const handleUpdateStatus = async (requestId, newStatus) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`Request marked as ${newStatus}.`);
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(prev => prev ? ({ ...prev, status: newStatus }) : null);
      }
      await fetchRequests();
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update request status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this request record? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request deleted.');
      setSelectedRequest(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
      await fetchRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      toast.error('Failed to delete request.');
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Actions
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map(r => r.id)));
    }
  };

  const handleBulkUpdateStatus = async (newStatus) => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Mark ${selectedIds.size} request(s) as ${newStatus}?`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .in('id', [...selectedIds]);

      if (error) throw error;
      toast.success(`${selectedIds.size} request(s) updated to ${newStatus}.`);
      if (selectedRequest && selectedIds.has(selectedRequest.id)) {
        setSelectedRequest(prev => prev ? ({ ...prev, status: newStatus }) : null);
      }
      setSelectedIds(new Set());
      await fetchRequests();
    } catch (err) {
      console.error('Error bulk updating requests:', err);
      toast.error('Failed to update requests.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`⚠️ Permanently delete ${selectedIds.size} request(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .in('id', [...selectedIds]);

      if (error) throw error;
      toast.success(`${selectedIds.size} request(s) deleted.`);
      if (selectedRequest && selectedIds.has(selectedRequest.id)) {
        setSelectedRequest(null);
      }
      setSelectedIds(new Set());
      await fetchRequests();
    } catch (err) {
      console.error('Error bulk deleting requests:', err);
      toast.error('Failed to delete requests.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Filtering
  const filteredRequests = sorted.filter(r => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      r.patient.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.patientEmail.toLowerCase().includes(q) ||
      r.providerEmail.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q);

    const matchesFilter = filter === 'All' || r.status.toLowerCase() === filter.toLowerCase();

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
    setSelectedIds(new Set());
  }, [searchTerm, filter, startDate, endDate, sortKey]);

  // Neumorphic Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="neu-flat-sm inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Completed
          </span>
        );
      case 'Accepted':
      case 'On The Way':
      case 'Arrived':
        return (
          <span className="neu-flat-sm inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {status}
          </span>
        );
      case 'Pending':
        return (
          <span className="neu-flat-sm inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Pending
          </span>
        );
      case 'Cancelled':
      case 'Rejected':
        return (
          <span className="neu-flat-sm inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            {status}
          </span>
        );
      default:
        return (
          <span className="neu-flat-sm inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  const SortableHeader = ({ label, sortKey: sk, className = '' }) => (
    <th
      className={`px-6 py-4 font-black cursor-pointer hover:text-primary transition-colors select-none ${className}`}
      onClick={() => { handleSort(sk); setCurrentPage(1); }}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sk ? 'text-primary' : 'opacity-30'}`} />
        {getSortIndicator(sk)}
      </span>
    </th>
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Neumorphic Header & Controls Toolbar */}
        <motion.div
          className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl flex flex-col gap-4 relative z-30"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Header Title & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-white/60 dark:border-white/5 pb-3 sm:pb-0 sm:border-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white">
                Platform Requests
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Audit and monitor all healthcare interactions and appointment bookings across Muntinlupa
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="neu-flat-sm px-3 py-1 rounded-xl text-xs font-black text-primary">
                {filteredRequests.length} {filteredRequests.length === 1 ? 'Request' : 'Requests'}
              </span>
            </div>
          </div>

          {/* Controls Bar - Mobile Optimized Grid & Flex */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2.5 w-full">
            {/* Neumorphic Inset Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none z-10" />
              <input
                type="text"
                placeholder="Search requests by patient, provider, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full neu-inset rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[42px]"
              />
            </div>

            {/* Filter and Date Grid on Mobile, Inline on Desktop */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
              <div className="col-span-1 sm:w-auto">
                <CustomSelect
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'All', label: 'All Status' },
                    { value: 'Pending', label: 'Pending' },
                    { value: 'Accepted', label: 'Accepted' },
                    { value: 'On The Way', label: 'On The Way' },
                    { value: 'Arrived', label: 'Arrived' },
                    { value: 'Completed', label: 'Completed' },
                    { value: 'Cancelled', label: 'Cancelled' },
                    { value: 'Rejected', label: 'Rejected' },
                  ]}
                  className="w-full sm:w-[150px]"
                />
              </div>

              <div className="col-span-1 sm:w-auto">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }}
                  className="w-full sm:w-auto"
                />
              </div>
            </div>

            {/* Export Action Button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              className="neu-btn px-4 py-2 min-h-[42px] rounded-xl text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:text-primary transition-all shrink-0 w-full sm:w-auto shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Neumorphic Table Card */}
        <motion.div
          className="rounded-2xl sm:rounded-3xl md:neu-flat md:overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Mobile Card View - Separated Neumorphic Cards */}
          <div className="block md:hidden space-y-3.5">
            {paginatedRequests.length === 0 ? (
              <div className="neu-flat p-6 rounded-2xl">
                <EmptyState icon="inbox" title="No requests found" message="No requests match your current search or filter." variant="compact" />
              </div>
            ) : (
              paginatedRequests.map((r, idx) => {
                const isSelected = selectedIds.has(r.id);
                return (
                  <motion.div
                    key={r.id}
                    className={`neu-flat p-4 sm:p-5 rounded-2xl space-y-3.5 transition-all ${
                      isSelected ? 'ring-2 ring-primary/60 bg-primary/[0.04] dark:bg-primary/[0.08]' : ''
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Interactive Avatar Selection Ring */}
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => toggleSelect(r.id)}
                          className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all shrink-0 overflow-hidden ${
                            isSelected 
                              ? 'neu-inset ring-2 ring-primary text-white bg-primary shadow-inner' 
                              : 'neu-flat-sm text-primary hover:ring-1 hover:ring-primary/40'
                          }`}
                          title={isSelected ? "Click to deselect" : "Click to select"}
                        >
                          {isSelected ? (
                            <Check className="w-5 h-5 text-primary stroke-[3]" />
                          ) : r.patientAvatar ? (
                            <img src={r.patientAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            r.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </motion.button>

                        <div 
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => setSelectedRequest(r)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="neu-flat-sm px-2 py-0.5 rounded-lg text-primary font-black text-3xs uppercase tracking-wider">
                              {r.service}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate hover:text-primary transition-colors mt-0.5">
                            {r.patient}
                          </p>
                          <p className="text-2xs text-slate-400 dark:text-slate-500 font-mono truncate">
                            ID: {r.id.split('-')[0]}...
                          </p>
                        </div>
                      </div>

                      {getStatusBadge(r.status)}
                    </div>

                    <div className="neu-inset px-3 py-2.5 rounded-xl text-2xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-3xs">Provider:</span>
                        <span className="font-bold truncate max-w-[200px]">{r.provider}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-3xs">Scheduled:</span>
                        <span className="font-mono">{r.date} {r.time ? `• ${r.time}` : ''}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => setSelectedRequest(r)}
                        className="text-primary font-bold hover:underline flex items-center gap-1 text-3xs uppercase tracking-wider"
                      >
                        Request Details →
                      </button>

                      <div className="flex items-center gap-2">
                        {r.status === 'Pending' && (
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleUpdateStatus(r.id, 'Accepted')}
                            className="neu-btn px-2.5 py-1 rounded-xl text-3xs font-extrabold text-blue-600 dark:text-blue-400"
                          >
                            Accept
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={() => handleDeleteRequest(r.id)}
                          className="neu-btn p-1.5 rounded-xl text-rose-600 dark:text-rose-400"
                          title="Delete Request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/80 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500 text-3xs font-black uppercase tracking-wider">
                  <th className="px-6 py-4 w-12 text-center select-none">
                    <span className="text-4xs font-mono opacity-60">SELECT</span>
                  </th>
                  <th className="px-6 py-4 font-black">Request ID</th>
                  <SortableHeader label="Patient" sortKey="patient" />
                  <SortableHeader label="Provider" sortKey="provider" />
                  <SortableHeader label="Service" sortKey="service" />
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Scheduled Date" sortKey="scheduledTimestamp" />
                  <th className="px-6 py-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 dark:divide-white/5">
                {paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan="8"><EmptyState icon="inbox" title="No requests found" message="No requests match your current search or filter." variant="compact" /></td>
                  </tr>
                ) : (
                  paginatedRequests.map((r, idx) => {
                    const isSelected = selectedIds.has(r.id);
                    return (
                      <motion.tr
                        key={r.id}
                        className={`transition-all group cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/[0.08] dark:bg-primary/[0.15]' 
                            : 'hover:bg-primary/5'
                        }`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.02 }}
                        onClick={() => setSelectedRequest(r)}
                      >
                        {/* Interactive Avatar Selection Column */}
                        <td className="px-6 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleSelect(r.id)}
                            className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center text-xs font-black transition-all overflow-hidden ${
                              isSelected
                                ? 'neu-inset ring-2 ring-primary text-primary bg-primary/10'
                                : 'neu-flat-sm text-primary hover:ring-2 hover:ring-primary/40'
                            }`}
                            title={isSelected ? "Selected (Click to deselect)" : "Click avatar to select"}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4 text-primary stroke-[3]" />
                            ) : r.patientAvatar ? (
                              <img src={r.patientAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              r.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            )}
                          </motion.button>
                        </td>

                        <td className="px-6 py-3.5 font-mono text-2xs text-slate-400 dark:text-slate-500">
                          {r.id.split('-')[0]}...
                        </td>

                        <td className="px-6 py-3.5">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors block">
                              {r.patient}
                            </span>
                            <span className="text-3xs text-slate-400 font-medium">
                              {r.patientEmail}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-3.5">
                          <div>
                            <span className="font-bold text-slate-700 dark:text-slate-200 block">
                              {r.provider}
                            </span>
                            <span className="text-3xs text-slate-400 font-medium">
                              {r.providerEmail}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-3.5">
                          <span className="neu-flat-sm px-2.5 py-1 rounded-xl text-primary font-bold text-3xs inline-block">
                            {r.service}
                          </span>
                        </td>

                        <td className="px-6 py-3.5">
                          {getStatusBadge(r.status)}
                        </td>

                        <td className="px-6 py-3.5 font-mono text-2xs text-slate-600 dark:text-slate-300">
                          <div>{r.date}</div>
                          {r.time && <div className="text-3xs text-slate-400">{r.time}</div>}
                        </td>

                        <td className="px-6 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              className="neu-btn px-3 py-1.5 text-xs font-black rounded-xl text-primary hover:text-primary-focus transition-all"
                              onClick={() => setSelectedRequest(r)}
                            >
                              Details
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              className="neu-btn p-1.5 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                              onClick={() => handleDeleteRequest(r.id)}
                              title="Delete Request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-white/60 dark:border-white/5">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </motion.div>

        {/* Floating Dynamic Island Bulk Action Dock Teleported to document.body */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 70, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 70, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="fixed bottom-20 lg:bottom-8 inset-x-0 z-[9999] flex justify-center px-3 sm:px-4 pointer-events-none"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                <div className="neu-flat px-4 sm:px-6 py-2.5 sm:py-3 rounded-full border border-white/90 dark:border-white/10 shadow-2xl bg-[#ebf1f8]/95 dark:bg-[#172236]/95 backdrop-blur-2xl flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 pointer-events-auto max-w-[94vw]">
                  {/* Count Badge & Select All Toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2 pr-2.5 sm:pr-3.5 border-r border-slate-300 dark:border-slate-700 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-primary text-white font-display font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {selectedIds.size}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 hidden sm:inline">
                      Selected
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={toggleSelectAll}
                      className="neu-btn px-2.5 py-1 rounded-full text-3xs font-extrabold text-primary flex items-center gap-1 hover:text-primary-focus transition-all ml-1"
                      title={selectedIds.size === filteredRequests.length ? "Deselect All Requests" : "Select All Filtered Requests"}
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>{selectedIds.size === filteredRequests.length ? 'Deselect All' : 'Select All'}</span>
                    </motion.button>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleBulkUpdateStatus('Accepted')}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Mark Selected as Accepted"
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Accept</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleBulkUpdateStatus('Completed')}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Mark Selected as Completed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Complete</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleBulkUpdateStatus('Cancelled')}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Mark Selected as Cancelled"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Cancel</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkDelete}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Delete Selected Requests"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Delete</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSelectedIds(new Set())}
                      className="neu-btn p-1.5 sm:p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all shrink-0 ml-0.5"
                      title="Clear Selection"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>

      {/* Neumorphic Request Detail Modal Teleported to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedRequest && (
            <motion.div
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedRequest(null)}
            >
              <motion.div
                className="neu-flat rounded-[2rem] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/80 dark:border-white/10 shadow-2xl bg-[#ebf1f8] dark:bg-[#172236] transform-gpu will-change-transform"
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-white/60 dark:border-white/5 flex items-center justify-between sticky top-0 bg-[#ebf1f8] dark:bg-[#172236] z-10">
                  <div>
                    <h2 className="text-lg font-display font-black text-slate-900 dark:text-white">Request Dossier</h2>
                    <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Interaction Audit & Dispatch Overview</p>
                  </div>
                  <div>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                  {/* Service & ID Header */}
                  <div className="neu-inset p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Service Program</p>
                      <p className="text-sm font-black text-primary mt-0.5">{selectedRequest.service}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xs font-black uppercase tracking-wider text-slate-400">Request ID</p>
                      <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">{selectedRequest.id.substring(0, 13)}...</p>
                    </div>
                  </div>

                  {/* Patient & Provider Dual Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Patient Card */}
                    <Link
                      to="/admin/patients"
                      onClick={() => setSelectedRequest(null)}
                      className="neu-flat-sm p-3.5 rounded-2xl space-y-2 block hover:ring-1 hover:ring-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between text-3xs font-black uppercase tracking-wider text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary" />
                          <span>Resident Patient</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-xs font-black text-primary overflow-hidden shrink-0">
                          {selectedRequest.patientAvatar ? (
                            <img src={selectedRequest.patientAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            selectedRequest.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{selectedRequest.patient}</p>
                          <p className="text-3xs text-slate-400 truncate">{selectedRequest.patientEmail || 'No email'}</p>
                        </div>
                      </div>
                    </Link>

                    {/* Provider Card */}
                    <Link
                      to="/admin/providers"
                      onClick={() => setSelectedRequest(null)}
                      className="neu-flat-sm p-3.5 rounded-2xl space-y-2 block hover:ring-1 hover:ring-primary/40 transition-all"
                    >
                      <div className="flex items-center justify-between text-3xs font-black uppercase tracking-wider text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-primary" />
                          <span>Healthcare Provider</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-xs font-black text-primary overflow-hidden shrink-0">
                          {selectedRequest.providerAvatar ? (
                            <img src={selectedRequest.providerAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            selectedRequest.provider.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{selectedRequest.provider}</p>
                          <p className="text-3xs text-slate-400 truncate">{selectedRequest.providerEmail || 'No email'}</p>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Schedule & Timing Info */}
                  <div className="neu-flat-sm p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span>Appointment Date:</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{selectedRequest.date}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span>Time Slot:</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{selectedRequest.time || 'Not specified'}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-white/60 dark:border-white/5">
                      <div className="flex items-center gap-2 text-slate-400">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Requested At:</span>
                      </div>
                      <span className="text-2xs text-slate-400 font-mono">
                        {new Date(selectedRequest.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Patient Request Notes */}
                  {selectedRequest.notes && (
                    <div className="space-y-1.5">
                      <p className="text-3xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider">
                        Patient Symptoms / Instructions
                      </p>
                      <div className="neu-inset p-3.5 rounded-2xl text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedRequest.notes}
                      </div>
                    </div>
                  )}

                  {/* Administrative Action Controls */}
                  <div className="space-y-2 pt-2 border-t border-white/60 dark:border-white/5">
                    <p className="text-3xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider">
                      Administrative Override Actions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'Accepted')}
                        disabled={actionLoading || selectedRequest.status === 'Accepted'}
                        className="neu-btn py-2.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 transition-all disabled:opacity-40"
                      >
                        Set Accepted
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'Completed')}
                        disabled={actionLoading || selectedRequest.status === 'Completed'}
                        className="neu-btn py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 transition-all disabled:opacity-40"
                      >
                        Set Completed
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'Cancelled')}
                        disabled={actionLoading || selectedRequest.status === 'Cancelled'}
                        className="neu-btn py-2.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 transition-all disabled:opacity-40"
                      >
                        Cancel Request
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleDeleteRequest(selectedRequest.id)}
                        disabled={actionLoading}
                        className="neu-btn py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 transition-all disabled:opacity-40"
                      >
                        Delete Record
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer - Expanded full width button */}
                <div className="p-4 sm:p-5 border-t border-white/60 dark:border-white/5 bg-[#ebf1f8]/60 dark:bg-[#172236]/60">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRequest(null)}
                    className="w-full neu-btn py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    Close Dossier
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </DashboardLayout>
  );
};

export default AdminRequests;
