import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Search, ShieldCheck, ShieldAlert, Star, X, MapPin, Phone, Mail, BookOpen, Check, Ban, Clock, ExternalLink, FileText, Download, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect, DateRangePicker, Pagination, SkeletonPage, EmptyState } from '@/shared/ui';
import useSort from '@/hooks/useSort';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';

const PAGE_SIZE = 10;

const getProfessionalIdUrl = (filePath) => {
  if (!filePath) return null;
  const { data } = supabase.storage.from('provider-docs').getPublicUrl(filePath);
  return data?.publicUrl || null;
};

const AdminProviders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [professionalIdPreviews, setProfessionalIdPreviews] = useState([]);
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(providers);

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*, user:user_id(id, full_name, email, avatar_url, is_banned, created_at)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map(p => {
        let status = 'Incomplete';
        if (p.user?.is_banned) {
          status = 'Banned';
        } else if (p.is_approved) {
          status = 'Approved';
        } else if (p.is_profile_complete) {
          status = 'Pending Approval';
        }

        return {
          id: p.id,
          userId: p.user_id,
          name: p.user?.full_name || 'Unknown',
          email: p.user?.email || '',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          price_per_service: p.price_per_service || 0,
          phone: p.phone || '',
          bio: p.bio || '',
          is_profile_complete: p.is_profile_complete,
          is_approved: p.is_approved,
          is_banned: p.user?.is_banned || false,
          professional_id_path: p.professional_id_path || null,
          professional_id_paths: p.professional_id_paths || [],
          professional_id_status: p.professional_id_status || 'none',
          trust_score: p.trust_score || 0,
          avatar_url: p.user?.avatar_url || '',
          joinDate: p.user?.created_at ? new Date(p.user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
          joinTimestamp: p.user?.created_at ? new Date(p.user.created_at).getTime() : 0,
          status
        };
      });

      setProviders(shaped);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const paths = (selectedProvider?.professional_id_paths && selectedProvider.professional_id_paths.length > 0)
      ? selectedProvider.professional_id_paths
      : (selectedProvider?.professional_id_path ? [selectedProvider.professional_id_path] : []);
    setProfessionalIdPreviews(paths.map(p => getProfessionalIdUrl(p)).filter(Boolean));
  }, [selectedProvider]);

  const handleApprove = async (provider) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: true })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(`${provider.name} approved.`);
    } catch (err) {
      toast.error('Failed to approve provider.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (provider) => {
    if (!window.confirm(`Revoke approval for ${provider.name}? They will no longer be visible to patients.`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: false })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(`Approval revoked for ${provider.name}.`);
    } catch (err) {
      toast.error('Failed to revoke approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async (provider) => {
    const action = provider.is_banned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${provider.name}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !provider.is_banned })
        .eq('id', provider.userId);
      if (error) throw error;

      if (!provider.is_banned) {
        await supabase.from('providers').update({ is_approved: false }).eq('user_id', provider.userId);
      }

      setSelectedProvider(null);
      await fetchProviders();
      toast.success(`${provider.name} has been ${action}ned.`);
    } catch (err) {
      toast.error(`Failed to ${action} provider.`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProfessionalIdFiles = async (provider) => {
    const paths = provider.professional_id_paths?.length > 0
      ? provider.professional_id_paths
      : (provider.professional_id_path ? [provider.professional_id_path] : []);
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from('provider-docs').remove(paths);
    if (error) console.error('Error deleting ID files:', error);
  };

  const handleVerifyDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      await deleteProfessionalIdFiles(provider);

      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({ professional_id_status: 'verified', professional_id_paths: [], professional_id_path: null, trust_score: newScore })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success('Document verified. ID files have been removed from storage.');
    } catch (err) {
      toast.error('Failed to verify document.');
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRejectDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      await deleteProfessionalIdFiles(provider);

      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({ professional_id_status: 'rejected', professional_id_paths: [], professional_id_path: null, trust_score: newScore })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success('Document rejected. ID files have been removed from storage.');
    } catch (err) {
      toast.error('Failed to reject document.');
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRemove = async (provider) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${provider.name} and all their data? This cannot be undone!`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(`${provider.name} has been removed.`);
    } catch (err) {
      toast.error('Failed to remove provider.');
    } finally {
      setActionLoading(false);
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
    if (selectedIds.size === filteredProviders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProviders.map(p => p.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.size) return;
    const selected = providers.filter(p => selectedIds.has(p.id) && !p.is_banned);
    if (!selected.length) {
      toast.error('Cannot approve banned providers. Unban them first.');
      return;
    }
    if (!window.confirm(`Approve ${selected.length} provider(s)?`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: true })
        .in('user_id', selected.map(p => p.userId));
      if (error) throw error;
      toast.success(`${selected.length} provider(s) approved.`);
      setSelectedIds(new Set());
      await fetchProviders();
    } catch (err) {
      toast.error('Failed to approve providers.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (!selectedIds.size) return;
    const selected = providers.filter(p => selectedIds.has(p.id) && p.is_banned);
    if (!selected.length) {
      toast.error('No banned providers selected.');
      return;
    }
    if (!window.confirm(`Unban ${selected.length} provider(s)?`)) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: false })
        .in('id', selected.map(p => p.userId));
      if (error) throw error;
      toast.success(`${selected.length} provider(s) unbanned.`);
      setSelectedIds(new Set());
      await fetchProviders();
    } catch (err) {
      toast.error('Failed to unban providers.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkBan = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Ban ${selectedIds.size} provider(s)?`)) return;
    setBulkLoading(true);
    try {
      const selected = providers.filter(p => selectedIds.has(p.id));
      const { error } = await supabase
        .from('users')
        .update({ is_banned: true })
        .in('id', selected.map(p => p.userId));
      if (error) throw error;
      await supabase
        .from('providers')
        .update({ is_approved: false })
        .in('user_id', selected.map(p => p.userId));
      toast.success(`${selectedIds.size} provider(s) banned.`);
      setSelectedIds(new Set());
      await fetchProviders();
    } catch (err) {
      toast.error('Failed to ban providers.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${selectedIds.size} provider(s)? This cannot be undone!`)) return;
    setBulkLoading(true);
    try {
      const selected = providers.filter(p => selectedIds.has(p.id));
      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', selected.map(p => p.userId));
      if (error) throw error;
      toast.success(`${selectedIds.size} provider(s) deleted.`);
      setSelectedIds(new Set());
      await fetchProviders();
    } catch (err) {
      toast.error('Failed to delete providers.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExport = () => {
    if (!filteredProviders.length) {
      toast.error('No providers to export.');
      return;
    }
    const fields = [
      { key: 'name', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'services', label: 'Services', transform: (v) => Array.isArray(v) ? v.join('; ') : v },
      { key: 'rating', label: 'Rating' },
      { key: 'trust_score', label: 'Trust Score' },
      { key: 'joinDate', label: 'Joined' },
    ];
    const exportable = formatDataForExport(filteredProviders, fields);
    exportToCSV(exportable, 'providers_export');
    toast.success('Providers exported to CSV.');
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Approved': return { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' };
      case 'Pending Approval': return { bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500' };
      case 'Banned': return { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' };
      default: return { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' };
    }
  };

  // Filters
  const filteredProviders = sorted.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.services.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
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

  const totalPages = Math.ceil(filteredProviders.length / PAGE_SIZE);
  const paginatedProviders = filteredProviders.slice(
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
                Manage Providers
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Review, verify credentials, and administer registered healthcare professionals in Muntinlupa
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="neu-flat-sm px-3 py-1 rounded-xl text-xs font-black text-primary">
                {filteredProviders.length} {filteredProviders.length === 1 ? 'Provider' : 'Providers'}
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
                placeholder="Search providers by name, email, or specialization..."
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
                    { value: 'Approved', label: 'Approved' },
                    { value: 'Pending Approval', label: 'Pending Approval' },
                    { value: 'Incomplete', label: 'Incomplete' },
                    { value: 'Banned', label: 'Banned' },
                  ]}
                  className="w-full sm:w-[155px]"
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
            {paginatedProviders.length === 0 ? (
              <div className="neu-flat p-6 rounded-2xl">
                <EmptyState icon="users" title="No providers found" message="No providers match your current search or filter." variant="compact" />
              </div>
            ) : (
              paginatedProviders.map((p, idx) => {
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
                              : 'neu-flat-sm text-primary hover:ring-1 hover:ring-primary/40'
                          }`}
                          title={isSelected ? "Click to deselect" : "Click to select"}
                        >
                          {isSelected ? (
                            <Check className="w-5 h-5 text-primary stroke-[3]" />
                          ) : p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </motion.button>

                        <div 
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => setSelectedProvider(p)}
                        >
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate hover:text-primary transition-colors">{p.name}</p>
                          <p className="text-2xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{p.email}</p>
                        </div>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider shrink-0 ${
                        p.status === 'Approved' ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400' :
                        p.status === 'Pending Approval' ? 'neu-flat-sm text-amber-600 dark:text-amber-400' :
                        p.status === 'Banned' ? 'neu-flat-sm text-rose-600 dark:text-rose-400' :
                        'neu-flat-sm text-slate-500'
                      }`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="neu-flat-sm px-2.5 py-1 rounded-xl text-primary font-bold text-3xs truncate max-w-[200px]">
                        {p.services.length > 0 ? p.services[0] : 'General Healthcare'}
                      </span>
                      <div className="neu-flat-sm px-2.5 py-1 rounded-xl flex items-center gap-1 text-amber-500 font-black text-2xs shrink-0">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{Number(p.rating).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="neu-inset px-3 py-2 rounded-xl text-2xs text-slate-400 font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {p.professional_id_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-3xs uppercase">
                            <ShieldCheck className="w-3.5 h-3.5" /> ID Verified
                          </span>
                        ) : p.professional_id_status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-black text-3xs uppercase">
                            <Clock className="w-3.5 h-3.5" /> Pending ID
                          </span>
                        ) : p.professional_id_status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-black text-3xs uppercase">
                            <X className="w-3.5 h-3.5" /> Rejected ID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-black text-3xs uppercase">
                            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> Unverified
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedProvider(p)}
                        className="text-primary font-bold hover:underline flex items-center gap-1 text-3xs uppercase tracking-wider"
                      >
                        Verification Record →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {p.status === 'Pending Approval' ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className="text-xs font-bold py-2.5 rounded-xl neu-btn text-emerald-600 dark:text-emerald-400 transition-all text-center"
                          onClick={() => handleApprove(p)}
                          disabled={actionLoading}
                        >
                          Approve Provider
                        </motion.button>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className={`text-xs font-bold py-2.5 rounded-xl neu-btn transition-all text-center ${
                            p.is_banned ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                          onClick={() => handleBan(p)}
                          disabled={actionLoading}
                        >
                          {p.is_banned ? 'Unban Provider' : 'Ban Provider'}
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="text-xs font-bold text-slate-700 dark:text-slate-200 neu-btn py-2.5 rounded-xl transition-all text-center hover:text-primary"
                        onClick={() => setSelectedProvider(p)}
                      >
                        Full Details
                      </motion.button>
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
                  <SortableHeader label="Healthcare Professional" sortKey="name" />
                  <SortableHeader label="Specialization" sortKey="services" />
                  <SortableHeader label="Rating" sortKey="rating" />
                  <th className="px-6 py-4 font-black">Credentials</th>
                  <SortableHeader label="Joined Date" sortKey="joinTimestamp" />
                  <SortableHeader label="Status" sortKey="status" />
                  <th className="px-6 py-4 font-black text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 dark:divide-white/5">
                {paginatedProviders.length === 0 ? (
                  <tr>
                    <td colSpan="8"><EmptyState icon="users" title="No providers found" message="No providers match your current search or filter." variant="compact" /></td>
                  </tr>
                ) : (
                  paginatedProviders.map((p, idx) => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                      <motion.tr
                        key={p.id}
                        className={`transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/[0.08] dark:bg-primary/[0.15]' 
                            : 'hover:bg-primary/5'
                        }`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.02 }}
                        onClick={() => setSelectedProvider(p)}
                      >
                        {/* Interactive Avatar Selection Column */}
                        <td className="px-6 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleSelect(p.id)}
                            className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center text-xs font-black transition-all overflow-hidden ${
                              isSelected
                                ? 'neu-inset ring-2 ring-primary text-primary bg-primary/10 shadow-inner'
                                : 'neu-flat-sm text-primary hover:ring-2 hover:ring-primary/40'
                            }`}
                            title={isSelected ? "Selected (Click to deselect)" : "Click avatar to select"}
                          >
                            {isSelected ? (
                              <Check className="w-4 h-4 text-primary stroke-[3]" />
                            ) : p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            )}
                          </motion.button>
                        </td>

                        <td className="px-6 py-3.5">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-100 block group-hover:text-primary transition-colors">{p.name}</span>
                            <span className="text-3xs text-slate-400 font-medium">{p.email}</span>
                          </div>
                        </td>

                        <td className="px-6 py-3.5">
                          <span className="neu-flat-sm px-2.5 py-1 rounded-xl text-primary font-bold text-3xs inline-block max-w-[180px] truncate">
                            {p.services.length > 0 ? p.services.join(', ') : '—'}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-slate-700 dark:text-slate-200">
                          <div className="neu-flat-sm px-2.5 py-1 rounded-xl inline-flex items-center gap-1 text-amber-500 font-black text-2xs">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span>{Number(p.rating).toFixed(1)}</span>
                          </div>
                        </td>

                        <td className="px-6 py-3.5">
                          {p.professional_id_status === 'verified' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider neu-flat-sm text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="w-3 h-3" /> Verified
                            </span>
                          ) : p.professional_id_status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider neu-flat-sm text-amber-600 dark:text-amber-400">
                              <Clock className="w-3 h-3" /> Pending ID
                            </span>
                          ) : p.professional_id_status === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider neu-flat-sm text-rose-600 dark:text-rose-400">
                              <X className="w-3 h-3" /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider neu-flat-sm text-slate-500 dark:text-slate-400">
                              <ShieldAlert className="w-3 h-3 text-slate-400" /> Unverified
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-3.5 text-slate-400 font-mono text-2xs">{p.joinDate}</td>

                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider ${
                            p.status === 'Approved' ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400' :
                            p.status === 'Pending Approval' ? 'neu-flat-sm text-amber-600 dark:text-amber-400' :
                            p.status === 'Banned' ? 'neu-flat-sm text-rose-600 dark:text-rose-400' :
                            'neu-flat-sm text-slate-500'
                          }`}>
                            {p.status}
                          </span>
                        </td>

                        <td className="px-6 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            className="neu-btn px-3.5 py-1.5 text-xs font-black rounded-xl text-primary hover:text-primary-focus transition-all"
                            onClick={() => setSelectedProvider(p)}
                          >
                            Review
                          </motion.button>
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
                      title={selectedIds.size === filteredProviders.length ? "Deselect All Providers" : "Select All Filtered Providers"}
                    >
                      <Check className="w-3 h-3" />
                      <span>{selectedIds.size === filteredProviders.length ? 'Deselect All' : 'Select All'}</span>
                    </motion.button>
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkApprove}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Approve All Selected"
                    >
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Approve</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkUnban}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Unban All Selected"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Unban</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkBan}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Ban All Selected"
                    >
                      <Ban className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden xs:inline">Ban</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleBulkDelete}
                      disabled={bulkLoading}
                      className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 transition-all shrink-0"
                      title="Delete All Selected"
                    >
                      <X className="w-3.5 h-3.5 shrink-0" />
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

      {/* Neumorphic Provider Detail Modal Teleported to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedProvider && (
            <motion.div
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedProvider(null)}
            >
              <motion.div
                className="neu-flat rounded-[2rem] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/80 dark:border-white/10 shadow-2xl bg-[#ebf1f8] dark:bg-[#172236] transform-gpu will-change-transform"
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-white/60 dark:border-white/5 flex items-center justify-between sticky top-0 bg-[#ebf1f8] dark:bg-[#172236] z-10">
                  <div>
                    <h2 className="text-lg font-display font-black text-slate-900 dark:text-white">Provider Verification</h2>
                    <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Credentials & Status</p>
                  </div>
                  <span className="neu-flat-sm px-3 py-1 rounded-xl text-3xs font-extrabold text-primary uppercase tracking-wider">
                    {selectedProvider.status}
                  </span>
                </div>

                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl neu-inset flex items-center justify-center text-xl font-black text-sky-500 overflow-hidden shrink-0 shadow-inner">
                      {selectedProvider.avatar_url ? (
                        <img src={selectedProvider.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedProvider.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-display font-black text-slate-900 dark:text-white">{selectedProvider.name}</h3>
                      <p className="text-primary text-xs font-semibold">{selectedProvider.bio || 'General Healthcare Provider'}</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider mt-1.5 ${
                        selectedProvider.status === 'Approved' ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400' :
                        selectedProvider.status === 'Pending Approval' ? 'neu-flat-sm text-amber-600 dark:text-amber-400' :
                        selectedProvider.status === 'Banned' ? 'neu-flat-sm text-rose-600 dark:text-rose-400' :
                        'neu-flat-sm text-slate-500'
                      }`}>
                        {selectedProvider.status}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="neu-flat-sm p-4 rounded-2xl space-y-2.5 text-xs">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                      <Mail className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{selectedProvider.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                      <Phone className="w-4 h-4 text-primary shrink-0" />
                      <span>{selectedProvider.phone || 'Not provided'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span>{selectedProvider.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                      <BookOpen className="w-4 h-4 text-primary shrink-0" />
                      <span>₱{selectedProvider.price_per_service} per service</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-medium">
                      <Star className="w-4 h-4 text-amber-500 fill-current shrink-0" />
                      <span>{Number(selectedProvider.rating).toFixed(1)} rating ({selectedProvider.trust_score}% Trust Score)</span>
                    </div>
                  </div>

                  {/* Specializations */}
                  <div>
                    <p className="text-3xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mb-2">Specializations</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedProvider.services.length > 0 ? (
                        selectedProvider.services.map((s, i) => (
                          <span key={i} className="px-3 py-1 neu-flat-sm text-primary rounded-xl text-xs font-bold">{s}</span>
                        ))
                      ) : (
                        <p className="text-slate-400 text-xs">No specializations listed.</p>
                      )}
                    </div>
                  </div>

                  {/* Professional ID Verification */}
                  {(selectedProvider.professional_id_paths?.length > 0 || selectedProvider.professional_id_path || selectedProvider.professional_id_status === 'verified' || selectedProvider.professional_id_status === 'rejected') ? (
                    <div>
                      <p className="text-3xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mb-2">Professional ID Documents</p>
                      {professionalIdPreviews.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {professionalIdPreviews.map((url, i) => (
                            <div key={i} className="rounded-2xl overflow-hidden neu-inset p-1.5">
                              {url.endsWith('.pdf') ? (
                                <div className="flex items-center gap-2 p-2">
                                  <FileText className="w-5 h-5 text-primary shrink-0" />
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">Document {i + 1}</span>
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 neu-btn p-1 rounded-lg">
                                    <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                  </a>
                                </div>
                              ) : (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                  <img src={url} alt={`Professional ID ${i + 1}`} className="w-full h-28 object-contain rounded-xl" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (selectedProvider.professional_id_paths?.length > 0 || selectedProvider.professional_id_path) ? (
                        <p className="text-xs text-slate-400 p-2 mb-3">Loading preview...</p>
                      ) : null}
                      {selectedProvider.professional_id_status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleVerifyDocument(selectedProvider)}
                            disabled={docActionLoading}
                            className="neu-btn flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-emerald-600 dark:text-emerald-400 transition-all disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {docActionLoading ? '...' : 'Verify ID'}
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleRejectDocument(selectedProvider)}
                            disabled={docActionLoading}
                            className="neu-btn flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-rose-600 dark:text-rose-400 transition-all disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            {docActionLoading ? '...' : 'Reject ID'}
                          </motion.button>
                        </div>
                      )}
                      {selectedProvider.professional_id_status === 'verified' && (
                        <div className="flex items-center gap-2 px-3.5 py-2 neu-flat-sm text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold mb-3">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          Professional ID has been verified.
                        </div>
                      )}
                      {selectedProvider.professional_id_status === 'rejected' && (
                        <div className="flex items-center gap-2 px-3.5 py-2 neu-flat-sm text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold mb-3">
                          <X className="w-4 h-4 shrink-0" />
                          Professional ID was rejected.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xs text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider mb-2">Professional ID Documents</p>
                      <div className="flex items-center gap-2.5 p-3.5 neu-inset rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>No professional credentials uploaded yet (<strong className="text-slate-700 dark:text-slate-200">Unverified</strong>).</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2.5 pt-2 border-t border-white/60 dark:border-white/5">
                    {selectedProvider.status === 'Pending Approval' && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleApprove(selectedProvider)}
                        disabled={actionLoading}
                        className="w-full neu-btn flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs text-emerald-600 dark:text-emerald-400 transition-all disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        {actionLoading ? 'Processing...' : 'Approve Provider'}
                      </motion.button>
                    )}
                    {selectedProvider.status === 'Approved' && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleReject(selectedProvider)}
                        disabled={actionLoading}
                        className="w-full neu-btn flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs text-amber-600 dark:text-amber-400 transition-all disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {actionLoading ? 'Processing...' : 'Revoke Approval'}
                      </motion.button>
                    )}

                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleBan(selectedProvider)}
                      disabled={actionLoading}
                      className={`w-full neu-btn flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs transition-all disabled:opacity-50 ${
                        selectedProvider.is_banned ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <Ban className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : selectedProvider.is_banned ? 'Unban Provider' : 'Ban Provider'}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleRemove(selectedProvider)}
                      disabled={actionLoading}
                      className="w-full neu-btn flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-xs text-rose-600 dark:text-rose-400 transition-all disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : 'Permanently Remove'}
                    </motion.button>
                  </div>
                </div>

                {/* Modal Footer - Full Width Close Button */}
                <div className="p-4 sm:p-5 border-t border-white/60 dark:border-white/5 bg-[#ebf1f8]/60 dark:bg-[#172236]/60">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProvider(null)}
                    className="w-full neu-btn py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    Close Verification
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

export default AdminProviders;
