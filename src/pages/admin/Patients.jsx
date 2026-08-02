import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Ban, X, Check, Edit3, Download, ArrowUpDown, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import DateRangePicker from '../../components/DateRangePicker';
import Pagination from '../../components/Pagination';
import useSort from '../../hooks/useSort';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import { exportToCSV, formatDataForExport } from '../../lib/exportUtils';

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
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const handleInlineSave = async (patientId) => {
    const vals = editValues[patientId];
    if (!vals) return;
    try {
      const updates = {};
      if (vals.name !== undefined) updates.full_name = vals.name;
      if (vals.email !== undefined) updates.email = vals.email;
      const { error } = await supabase.from('users').update(updates).eq('id', patientId);
      if (error) throw error;
      toast.success('Patient updated.');
      setEditingId(null);
      setEditValues({});
      await fetchPatients();
    } catch (err) {
      toast.error('Failed to update patient.');
    }
  };

  const startEditing = (patient) => {
    setEditingId(patient.id);
    setEditValues(prev => ({ ...prev, [patient.id]: { name: patient.name, email: patient.email } }));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manage Patients</h1>
            <p className="text-slate-500 dark:text-slate-400">Overview of all registered patients in Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search patients..."
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
                { value: 'Active', label: 'Active' },
                { value: 'Banned', label: 'Banned' },
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
          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-b border-primary/10 dark:bg-primary/10 dark:border-primary/20">
              <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={handleBulkBan}
                  disabled={bulkLoading}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? '...' : 'Ban All'}
                </button>
                <button
                  onClick={handleBulkUnban}
                  disabled={bulkLoading}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? '...' : 'Unban All'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {bulkLoading ? '...' : 'Delete All'}
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginatedPatients.length === 0 ? (
              <EmptyState icon="users" title="No patients found" message="No patients match your current search or filter." variant="compact" />
            ) : (
              paginatedPatients.map((p, idx) => (
                <motion.div
                  key={p.id}
                  className="p-4 space-y-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="appearance-none w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/30 checked:bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3e%3cpath fill=%27white%27 d=%27M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z%27/%3e%3c/svg%3e')] bg-center bg-no-repeat bg-[length:12px]"
                      />
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 overflow-hidden shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{p.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-widest ${
                      p.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full status-dot ${p.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
                      {p.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 dark:text-slate-500">Joined: {p.joinDate}</div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-50 dark:border-slate-700">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      className={`text-xs font-bold px-4 py-2.5 rounded-lg transition-all min-h-[44px] ${
                        p.is_banned ? 'text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300' : 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                      onClick={() => handleBan(p)}
                      disabled={actionLoading}
                    >
                      {p.is_banned ? 'Unban' : 'Ban'}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-lg transition-all min-h-[44px] dark:bg-red-900/30 dark:text-red-300"
                      onClick={() => handleRemove(p)}
                      disabled={actionLoading}
                    >
                      Remove
                    </motion.button>
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
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={filteredPatients.length > 0 && selectedIds.size === filteredPatients.length}
                      onChange={toggleSelectAll}
                      className="appearance-none w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/30 checked:bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3e%3cpath fill=%27white%27 d=%27M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z%27/%3e%3c/svg%3e')] bg-center bg-no-repeat bg-[length:12px]"
                    />
                  </th>
                  <SortableHeader label="Full Name" sortKey="name" />
                  <SortableHeader label="Email" sortKey="email" />
                  <SortableHeader label="Joined" sortKey="joinTimestamp" />
                  <SortableHeader label="Status" sortKey="status" />
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPatients.length === 0 ? (
                  <tr>
                    <td colSpan="6"><EmptyState icon="users" title="No patients found" message="No patients match your current search or filter." variant="compact" /></td>
                  </tr>
                ) : (
                  paginatedPatients.map((p, idx) => (
                    <motion.tr
                      key={p.id}
                      className="transition-colors group cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/20"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.03 }}
                      onClick={() => { setSelectedPatient(p); fetchPatientHistory(p.id); }}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                        className="appearance-none w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/30 checked:bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3e%3cpath fill=%27white%27 d=%27M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z%27/%3e%3c/svg%3e')] bg-center bg-no-repeat bg-[length:12px]"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {editingId === p.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValues[p.id]?.name || ''}
                              onChange={(e) => setEditValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], name: e.target.value } }))}
                              className="px-2 py-1 border border-primary rounded-lg text-sm w-40 dark:bg-slate-700 dark:border-slate-600"
                              autoFocus
                            />
                            <button onClick={() => handleInlineSave(p.id)} className="p-2 text-green-500 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEditing} className="p-2 text-red-400 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400 overflow-hidden shrink-0">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                            <button
                              onClick={() => startEditing(p)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-primary transition-all"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === p.id ? (
                          <input
                            type="text"
                            value={editValues[p.id]?.email || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, [p.id]: { ...prev[p.id], email: e.target.value } }))}
                            className="px-2 py-1 border border-primary rounded-lg text-sm w-44 dark:bg-slate-700 dark:border-slate-600"
                          />
                        ) : (
                          <span className="text-slate-600 text-sm dark:text-slate-300">{p.email}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{p.joinDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-widest ${
                          p.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full status-dot ${p.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            className={`p-2.5 rounded-xl transition-all ${
                              p.is_banned
                                ? 'text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300'
                                : 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}
                            onClick={() => handleBan(p)}
                            disabled={actionLoading}
                            title={p.is_banned ? 'Unban' : 'Ban'}
                          >
                            <Ban className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all dark:bg-red-900/30 dark:text-red-300"
                            onClick={() => handleRemove(p)}
                            disabled={actionLoading}
                            title="Remove Permanently"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </div>
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

      {/* Patient Detail Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPatient(null)}
          >
            <motion.div
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto dark:bg-slate-800"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-[2rem] z-10 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Patient Details</h2>
                <button onClick={() => setSelectedPatient(null)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors dark:hover:bg-slate-700">
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300 overflow-hidden shrink-0">
                    {selectedPatient.avatar_url ? (
                      <img src={selectedPatient.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedPatient.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedPatient.name}</h3>
                    <p className="text-slate-500 text-sm dark:text-slate-400">{selectedPatient.email}</p>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-widest mt-1 ${
                      selectedPatient.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {selectedPatient.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  Joined: {selectedPatient.joinDate}
                </div>

                {/* Service History */}
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-3 dark:text-slate-500">
                    Service History ({patientHistory.length})
                  </p>
                  {historyLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-slate-50 dark:bg-slate-900 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : patientHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">No service requests yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {patientHistory.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-700 text-sm dark:text-slate-200">{req.service}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              Provider: {req.provider?.full_name || 'Unknown'} — {new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <span className={`ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-2xs font-bold ${
                            req.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            req.status === 'Accepted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminPatients;
