import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Search, Ban, X, Check, Edit3, Download, ArrowUpDown, Calendar, CheckSquare, ShieldBan, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect, DateRangePicker, Pagination, SkeletonPage, EmptyState } from '@/shared/ui';
import useSort from '@/hooks/useSort';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';

const PAGE_SIZE = 10;

const AdminPatients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const modalTriggerRef = useRef(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditingInModal, setIsEditingInModal] = useState(false);
  const [modalEditName, setModalEditName] = useState('');
  const [modalEditEmail, setModalEditEmail] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(patients);

  const fetchPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, is_banned, created_at')
        .eq('role', 'patient')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map(p => ({
        id: p.id,
        name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url || '',
        joinDate: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        joinTimestamp: new Date(p.created_at).getTime(),
        is_banned: p.is_banned || false,
        status: p.is_banned ? 'Banned' : 'Active'
      }));

      setPatients(shaped);
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleBan = async (patient) => {
    const action = patient.is_banned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${patient.name}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !patient.is_banned })
        .eq('id', patient.id);
      if (error) throw error;
      await fetchPatients();
      toast.success(`${patient.name} has been ${action}ned.`);
    } catch (err) {
      toast.error(`Failed to ${action} patient.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (patient) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${patient.name} and all their data? This cannot be undone!`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', patient.id);
      if (error) throw error;
      await fetchPatients();
      toast.success(`${patient.name} has been removed.`);
    } catch (err) {
      toast.error('Failed to remove patient.');
    } finally {
      setActionLoading(false);
    }
  };

  const openPatientModal = (patient, triggerEl = null) => {
    modalTriggerRef.current = triggerEl;
    setSelectedPatient(patient);
    setIsEditingInModal(false);
    setModalEditName(patient.name);
    setModalEditEmail(patient.email);
    fetchPatientHistory(patient.id);
  };

  const handleModalSave = async () => {
    if (!selectedPatient) return;
    if (!modalEditName.trim() || !modalEditEmail.trim()) {
      toast.error('Name and email cannot be empty.');
      return;
    }
    setModalSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: modalEditName.trim(),
          email: modalEditEmail.trim()
        })
        .eq('id', selectedPatient.id);
      if (error) throw error;
      toast.success('Patient details updated successfully.');
      setSelectedPatient(prev => ({
        ...prev,
        name: modalEditName.trim(),
        email: modalEditEmail.trim()
      }));
      setIsEditingInModal(false);
      await fetchPatients();
    } catch (err) {
      toast.error(err.message || 'Failed to update patient.');
    } finally {
      setModalSaving(false);
    }
  };

  // Bulk actions
  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleBulkBan = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Are you sure you want to ban ${selectedIds.size} patient(s)?`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: true })
        .in('id', [...selectedIds]);
      if (error) throw error;
      toast.success(`${selectedIds.size} patient(s) banned.`);
      setSelectedIds(new Set());
      await fetchPatients();
    } catch (err) {
      toast.error('Failed to ban patients.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Are you sure you want to unban ${selectedIds.size} patient(s)?`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: false })
        .in('id', [...selectedIds]);
      if (error) throw error;
      toast.success(`${selectedIds.size} patient(s) unbanned.`);
      setSelectedIds(new Set());
      await fetchPatients();
    } catch (err) {
      toast.error('Failed to unban patients.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${selectedIds.size} patient(s)? This cannot be undone!`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', [...selectedIds]);
      if (error) throw error;
      toast.success(`${selectedIds.size} patient(s) deleted.`);
      setSelectedIds(new Set());
      await fetchPatients();
    } catch (err) {
      toast.error('Failed to delete patients.');
    } finally {
      setBulkLoading(false);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('id, service, status, date, time, created_at, provider:provider_id(full_name)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPatientHistory(data || []);
    } catch (err) {
      console.error('Error fetching patient history:', err);
      setPatientHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExport = () => {
    if (!filteredPatients.length) {
      toast.error('No patients to export.');
      return;
    }
    const fields = [
      { key: 'name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'joinDate', label: 'Joined' },
    ];
    const exportable = formatDataForExport(filteredPatients, fields);
    exportToCSV(exportable, 'patients_export');
    toast.success('Patients exported to CSV.');
  };

  // Filters
  const filteredPatients = sorted.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(p.joinTimestamp) >= new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(p.joinTimestamp) <= end;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, startDate, endDate, sortKey]);

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  const SortableHeader = ({ label, sortKey: sk, className = '' }) => (
    <th
      className={`px-6 py-4 font-semibold cursor-pointer hover:text-link transition-colors select-none ${className}`}
      onClick={() => { handleSort(sk); setCurrentPage(1); }}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sk ? 'text-link' : 'opacity-30'}`} />
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
                Manage Patients
              </h1>
              <p className="text-sm text-tertiary dark:text-tertiary mt-0.5">
                Overview and account administration of all registered residents in Muntinlupa
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="neu-flat-sm px-3 py-1 rounded-xl text-xs font-black text-link">
                {filteredPatients.length} {filteredPatients.length === 1 ? 'Resident' : 'Residents'}
              </span>
            </div>
          </div>

          {/* Controls Bar - Mobile Optimized Grid & Flex */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2.5 w-full">
            {/* Neumorphic Inset Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-link pointer-events-none z-10" />
              <input
                type="text"
                aria-label="Search patients by name or email"
                placeholder="Search patients by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full neu-inset rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-tertiary outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[42px]"
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
                    { value: 'Active', label: 'Active' },
                    { value: 'Banned', label: 'Banned' },
                  ]}
                  className="w-full sm:w-[140px]"
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
              className="neu-btn px-4 py-2 min-h-[42px] rounded-xl text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:text-link transition-all shrink-0 w-full sm:w-auto shadow-sm"
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
            {paginatedPatients.length === 0 ? (
              <div className="neu-flat p-6 rounded-2xl">
                <EmptyState icon="users" title="No patients found" message="No patients match your current search or filter." variant="compact" />
              </div>
            ) : (
              paginatedPatients.map((p, idx) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <motion.div
                    key={p.id}
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
                          onClick={() => toggleSelect(p.id)}
                          className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black transition-all shrink-0 overflow-hidden ${
                            isSelected 
                              ? 'neu-inset ring-2 ring-primary text-white bg-primary shadow-inner' 
                              : 'neu-flat-sm text-link hover:ring-1 hover:ring-primary/40'
                          }`}
                          title={isSelected ? "Click to deselect" : "Click to select"}
                        >
                          {isSelected ? (
                            <Check className="w-5 h-5 text-link stroke-[3]" />
                          ) : p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </motion.button>

                        <div 
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={(event) => openPatientModal(p, event.currentTarget)}
                        >
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate hover:text-link transition-colors">{p.name}</p>
                          <p className="text-xs text-tertiary dark:text-tertiary font-medium truncate mt-0.5">{p.email}</p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-2xs font-extrabold uppercase tracking-wider shrink-0 ${
                        p.status === 'Active' ? 'neu-flat-sm text-success dark:text-success-dark' : 'neu-flat-sm text-danger dark:text-danger-dark'
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="neu-inset px-3 py-2 rounded-xl text-xs text-tertiary font-semibold flex items-center justify-between">
                      <span>Joined: <strong className="text-slate-700 dark:text-slate-300 font-bold">{p.joinDate}</strong></span>
                      <button
                        onClick={(event) => openPatientModal(p, event.currentTarget)}
                        className="text-link font-bold hover:underline flex items-center gap-1 text-2xs uppercase tracking-wider"
                      >
                        Record Details →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className={`text-xs font-bold py-2.5 rounded-xl neu-btn transition-all text-center ${
                          p.is_banned ? 'text-success dark:text-success-dark' : 'text-warning dark:text-warning-dark'
                        }`}
                        onClick={() => handleBan(p)}
                        disabled={actionLoading}
                      >
                        {p.is_banned ? 'Unban Resident' : 'Ban Resident'}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="text-xs font-bold text-danger dark:text-danger-dark neu-btn py-2.5 rounded-xl transition-all text-center"
                        onClick={() => handleRemove(p)}
                        disabled={actionLoading}
                      >
                        Remove
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/80 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30 text-tertiary dark:text-tertiary text-2xs font-black uppercase tracking-wider">
                  <th className="px-6 py-4 w-12 text-center select-none">
                    <span className="text-xs font-mono opacity-60">SELECT</span>
                  </th>
                  <SortableHeader label="Resident Patient" sortKey="name" />
                  <SortableHeader label="Email Address" sortKey="email" />
                  <SortableHeader label="Joined Date" sortKey="joinTimestamp" />
                  <SortableHeader label="Status" sortKey="status" />
                  <th className="px-6 py-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 dark:divide-white/5">
                {paginatedPatients.length === 0 ? (
                  <tr>
                    <td colSpan="6"><EmptyState icon="users" title="No patients found" message="No patients match your current search or filter." variant="compact" /></td>
                  </tr>
                ) : (
                  paginatedPatients.map((p, idx) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <motion.tr
                        key={p.id}
                        tabIndex={0}
                        className={`transition-all group cursor-pointer focus-visible:bg-primary/5 ${
                          isSelected 
                            ? 'bg-primary/[0.08] dark:bg-primary/[0.15]' 
                            : 'hover:bg-primary/5'
                        }`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.02 }}
                        onClick={(event) => {
                          event.currentTarget.focus();
                          openPatientModal(p, event.currentTarget);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openPatientModal(p, event.currentTarget);
                          }
                        }}
                      >
                        {/* Interactive Avatar Selection Column */}
                        <td className="px-6 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleSelect(p.id)}
                            className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center text-xs font-black transition-all overflow-hidden ${
                              isSelected
                                ? 'neu-inset ring-2 ring-primary text-link bg-primary/10'
                                : 'neu-flat-sm text-link hover:ring-2 hover:ring-primary/40'
                            }`}
                            title={isSelected ? "Selected (Click to deselect)" : "Click avatar to select"}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4 text-link stroke-[3]" />
                            ) : p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            )}
                          </motion.button>
                        </td>

                        <td className="px-6 py-3.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-link transition-colors">
                            {p.name}
                          </span>
                        </td>

                        <td className="px-6 py-3.5">
                          <span className="text-tertiary dark:text-tertiary font-medium">{p.email}</span>
                        </td>

                        <td className="px-6 py-3.5 text-tertiary font-mono text-xs">{p.joinDate}</td>

                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider ${
                            p.status === 'Active' ? 'neu-flat-sm text-success dark:text-success-dark' : 'neu-flat-sm text-danger dark:text-danger-dark'
                          }`}>
                            {p.status}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              className={`h-11 w-11 flex items-center justify-center rounded-xl neu-btn transition-all ${
                                p.is_banned
                                  ? 'text-success dark:text-success-dark'
                                  : 'text-warning dark:text-warning-dark'
                              }`}
                              onClick={() => handleBan(p)}
                              disabled={actionLoading}
                              title={p.is_banned ? 'Unban' : 'Ban'}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              className="h-11 w-11 flex items-center justify-center text-danger dark:text-danger-dark rounded-xl neu-btn transition-all"
                              onClick={() => handleRemove(p)}
                              disabled={actionLoading}
                              title="Remove Permanently"
                            >
                              <X className="w-3.5 h-3.5" />
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
                className="fixed bottom-20 lg:bottom-8 inset-x-0 z-[60] flex justify-center px-3 sm:px-4 pointer-events-none"
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
                      className="neu-btn px-2.5 py-1 rounded-full text-xs font-extrabold text-link flex items-center gap-1 hover:text-primary-focus transition-all ml-1"
                      title={selectedIds.size === filteredPatients.length ? "Deselect All Patients" : "Select All Filtered Patients"}
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>{selectedIds.size === filteredPatients.length ? 'Deselect All' : 'Select All'}</span>
                    </motion.button>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkBan}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-warning dark:text-warning-dark flex items-center gap-1.5 transition-all shrink-0"
                      title="Ban All Selected"
                    >
                      <ShieldBan className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Ban</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkUnban}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-success dark:text-success-dark flex items-center gap-1.5 transition-all shrink-0"
                      title="Unban All Selected"
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Unban</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkDelete}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-danger dark:text-danger-dark flex items-center gap-1.5 transition-all shrink-0"
                      title="Delete All Selected"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Delete</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSelectedIds(new Set())}
                      className="neu-btn h-11 w-11 flex items-center justify-center rounded-full text-tertiary hover:text-slate-600 dark:hover:text-slate-200 transition-all shrink-0 ml-0.5"
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

      {/* Neumorphic Patient Detail Modal Teleported to document.body */}
      <DialogPrimitive.Root
        open={!!selectedPatient}
        onOpenChange={(open) => { if (!open) setSelectedPatient(null); }}
      >
        {selectedPatient && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            asChild
            aria-modal="true"
            onCloseAutoFocus={(event) => {
              if (!modalTriggerRef.current) return;
              event.preventDefault();
              modalTriggerRef.current.focus();
            }}
          >
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedPatient(null)}
            >
              <motion.div
                className="neu-flat rounded-[2rem] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/80 dark:border-white/10 shadow-2xl bg-[#ebf1f8] dark:bg-[#172236] transform-gpu will-change-transform"
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-white/60 dark:border-white/5 flex items-center justify-between sticky top-0 bg-[#ebf1f8] dark:bg-[#172236] z-10">
                  <div>
                    <DialogPrimitive.Title asChild>
                      <h2 className="text-lg font-display font-black text-slate-900 dark:text-white">Patient Record</h2>
                    </DialogPrimitive.Title>
                    <p className="text-2xs text-tertiary font-bold uppercase tracking-wider mt-0.5">Profile & Booking Activity</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                  {!isEditingInModal && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setIsEditingInModal(true)}
                      className="neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-link flex items-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Info</span>
                    </motion.button>
                  )}
                    <DialogPrimitive.Close
                      aria-label="Close"
                      className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-tertiary hover:text-slate-800 dark:hover:text-white shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </DialogPrimitive.Close>
                  </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Patient Profile Card & In-Modal Editor */}
                  {isEditingInModal ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="neu-inset p-4 sm:p-5 rounded-2xl space-y-3.5 border border-white/60 dark:border-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-black uppercase tracking-wider text-link">Edit Resident Profile</span>
                        <span className="text-xs text-tertiary font-medium">Changes update immediately</span>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="admin-patient-name" className="text-2xs font-bold uppercase tracking-wider text-tertiary dark:text-tertiary">Full Name</label>
                        <input
                          id="admin-patient-name"
                          type="text"
                          value={modalEditName}
                          onChange={(e) => setModalEditName(e.target.value)}
                          placeholder="Resident full name"
                          className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="admin-patient-email" className="text-2xs font-bold uppercase tracking-wider text-tertiary dark:text-tertiary">Email Address</label>
                        <input
                          id="admin-patient-email"
                          type="email"
                          value={modalEditEmail}
                          onChange={(e) => setModalEditEmail(e.target.value)}
                          placeholder="Resident email"
                          className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={handleModalSave}
                          disabled={modalSaving}
                          className="flex-1 neu-btn py-2.5 rounded-xl text-xs font-black text-success dark:text-success-dark flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{modalSaving ? 'Saving...' : 'Save Changes'}</span>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            setIsEditingInModal(false);
                            setModalEditName(selectedPatient.name);
                            setModalEditEmail(selectedPatient.email);
                          }}
                          className="px-4 py-2.5 neu-btn rounded-xl text-xs font-bold text-tertiary hover:text-slate-700 dark:hover:text-slate-200 transition-all"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl neu-inset flex items-center justify-center text-xl font-black text-link overflow-hidden shrink-0">
                        {selectedPatient.avatar_url ? (
                          <img src={selectedPatient.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          selectedPatient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-display font-black text-slate-900 dark:text-white truncate">{selectedPatient.name}</h3>
                        <p className="text-tertiary dark:text-tertiary text-xs font-medium truncate">{selectedPatient.email}</p>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider mt-1.5 ${
                          selectedPatient.status === 'Active' ? 'neu-flat-sm text-success dark:text-success-dark' : 'neu-flat-sm text-danger dark:text-danger-dark'
                        }`}>
                          {selectedPatient.status}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="neu-flat-sm p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-link shrink-0" />
                    <span>Member since: <strong className="text-slate-900 dark:text-white">{selectedPatient.joinDate}</strong></span>
                  </div>

                  {/* Service History */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-2xs text-tertiary dark:text-tertiary font-black uppercase tracking-wider">
                        Service History
                      </p>
                      <span className="neu-flat-sm px-2 py-0.5 rounded-md text-xs font-extrabold text-link">
                        {patientHistory.length} Total
                      </span>
                    </div>

                    {historyLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-16 neu-inset rounded-2xl animate-pulse" />
                        ))}
                      </div>
                    ) : patientHistory.length === 0 ? (
                      <div className="neu-inset rounded-2xl p-6 text-center">
                        <p className="text-xs text-tertiary">No service requests recorded yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {patientHistory.map((req) => (
                          <div key={req.id} className="flex items-center justify-between p-3.5 neu-flat-sm rounded-2xl">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">{req.service}</p>
                              <p className="text-xs text-tertiary dark:text-tertiary font-medium mt-0.5">
                                {req.provider?.full_name || 'Provider'} • {(() => {
                                  const d = new Date(req.date || req.created_at);
                                  return !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
                                })()}
                              </p>
                            </div>
                            <span className={`ml-3 inline-flex items-center px-2 py-0.5 rounded-lg text-2xs font-black uppercase tracking-wider shrink-0 ${
                              req.status === 'Completed' ? 'text-success dark:text-success-dark' :
                              req.status === 'Accepted' ? 'text-link dark:text-primary-300' :
                              req.status === 'Pending' ? 'text-warning dark:text-warning-dark' :
                              'text-danger dark:text-danger-dark'
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer - Expanded full width button */}
                <div className="p-4 sm:p-5 border-t border-white/60 dark:border-white/5 bg-[#ebf1f8]/60 dark:bg-[#172236]/60">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedPatient(null);
                      setIsEditingInModal(false);
                    }}
                    className="w-full neu-btn py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    Close Record
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
        )}
      </DialogPrimitive.Root>
    </DashboardLayout>
  );
};

export default AdminPatients;
