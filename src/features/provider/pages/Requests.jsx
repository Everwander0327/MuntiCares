import {
  markVisitArrived,
  formatArrivalFailure,
  canOverrideArrival,
  ARRIVAL_OVERRIDE_REASON,
} from '../../tracking/services/trackingService';
import ArrivalOverrideDialog from '@/features/tracking/components/ArrivalOverrideDialog';
import { parseLocalDate, slotsOverlap, formatSlotLabel } from '@/lib/localDate';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Check, X, MapPin, Calendar, Clock, CheckCircle2, Loader2, 
  Search, Navigation, Home, MessageSquare, 
  ChevronLeft, ChevronRight, ChevronDown, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const STATUS_FLOW = {
  Accepted: { next: 'On The Way', icon: <Navigation className="w-3.5 h-3.5" />, label: 'Start Travel (On The Way)', color: 'neu-btn-primary text-white' },
  'On The Way': { next: 'Arrived', icon: <Home className="w-3.5 h-3.5" />, label: 'Mark Arrived on Site', color: 'neu-btn bg-amber-500 text-white hover:bg-amber-600' },
  Arrived: { next: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Complete Visit', color: 'neu-btn bg-emerald-600 text-white hover:bg-emerald-700' },
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30">
          Completed
        </span>
      );
    case 'Pending':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-warning dark:text-warning-dark bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30">
          Pending
        </span>
      );
    case 'Accepted':
    case 'On The Way':
    case 'Arrived':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-link dark:text-primary-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30">
          {status}
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-danger dark:text-danger-dark bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30">
          Rejected
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-tertiary dark:text-tertiary bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-white/10">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-tertiary bg-slate-200/50">
          {status}
        </span>
      );
  }
};

const ProviderRequests = () => {
  const [filter, setFilter] = useState('All'); // 'All' | 'Pending' | 'Active' | 'Completed' | 'History'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  const [updatingVisitId, setUpdatingVisitId] = useState(null);
  const [extendingVisitId, setExtendingVisitId] = useState(null);
  const [arrivalOverride, setArrivalOverride] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const { user } = useAuth();

  const fetchAll = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('id, patient_id, service, date, time, duration_minutes, notes, status, created_at, patient:patient_id(full_name, avatar_url)')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const patientIds = [...new Set((data || []).map(r => r.patient_id).filter(Boolean))];
      let addressMap = {};
      if (patientIds.length > 0) {
        const { data: patientProfiles } = await supabase
          .from('patients')
          .select('user_id, address')
          .in('user_id', patientIds);

        (patientProfiles || []).forEach(p => {
          if (p.user_id && p.address) addressMap[p.user_id] = p.address;
        });
      }

      const formatted = (data || []).map(r => {
        let timeLabel = '';
        try {
          if (r.time) {
            timeLabel = formatSlotLabel(r.time, r.duration_minutes || 30);
          }
        } catch { timeLabel = r.time || ''; }

        return {
          id: r.id,
          patientId: r.patient_id,
          patient: r.patient?.full_name || 'Unknown Patient',
          avatarUrl: r.patient?.avatar_url || '',
          service: r.service,
          durationMinutes: r.duration_minutes || 30,
          date: parseLocalDate(r.date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Unscheduled',
          time: timeLabel,
          notes: r.notes || '',
          status: r.status,
          rawDate: r.date,
          location: addressMap[r.patient_id] || 'Muntinlupa City',
        };
      });

      setRequests(formatted);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();

    const channel = supabase
      .channel('provider-requests-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `provider_id=eq.${user.id}`,
        },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Quick Action: Accept or Reject incoming request
  const handleAction = async (id, action, patientName) => {
    setActionStates(prev => ({ ...prev, [id]: action }));
    const newStatus = action === 'accepted' ? 'Accepted' : 'Rejected';

    try {
      if (action === 'accepted') {
        const { data: target } = await supabase
          .from('requests')
          .select('date, time, status, duration_minutes')
          .eq('id', id)
          .maybeSingle();

        if (!target || target.status !== 'Pending') {
          toast.error('This request was handled already.');
          fetchAll();
          return;
        }

        // The slot may have been taken while the request waited.
        const { data: held } = await supabase
          .from('requests')
          .select('id, time, duration_minutes')
          .eq('provider_id', user.id)
          .eq('date', target.date)
          .in('status', ['Accepted', 'On The Way', 'Arrived'])
          .neq('id', id);
        if ((held || []).some(h => slotsOverlap(target.date, target.time, target.date, h.time, target.duration_minutes || 30, h.duration_minutes || 30))) {
          toast.error('You already have a visit accepted for that time.');
          fetchAll();
          return;
        }
      }

      // Guarded on Pending so two providers — or two taps — cannot both accept.
      const { data: updated, error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('status', 'Pending')
        .select('id');

      if (error) {
        if (error.code === '23P01' || error.code === '23505') {
          toast.error('This time slot conflicts with an existing accepted visit.');
          fetchAll();
          return;
        }
        throw error;
      }
      if (!updated?.length) {
        toast.error('This request was handled already.');
        fetchAll();
        return;
      }
      toast.success(action === 'accepted' ? `Accepted visit for ${patientName}!` : `Declined request.`);
      fetchAll();
    } catch (err) {
      console.error('Error updating request:', err);
      toast.error('Failed to update request.');
    } finally {
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Progression: Accepted -> On The Way -> Arrived -> Completed
  const handleAdvanceVisit = async (visitId, nextStatus, fromStatus) => {
    setUpdatingVisitId(visitId);
    try {
      if (nextStatus === 'Arrived') {
        const res = await markVisitArrived(visitId);
        if (!res?.ok) {
          if (canOverrideArrival(res)) {
            setArrivalOverride({ id: visitId, failure: res });
          } else {
            toast.error(formatArrivalFailure(res));
          }
          return;
        }
        toast.success('Visit updated to "Arrived"!');
        fetchAll();
        return;
      }

      const payload = { status: nextStatus };
      const nowIso = new Date().toISOString();
      if (nextStatus === 'On The Way') payload.route_started_at = nowIso;

      const { data: updated, error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', visitId)
        .eq('status', fromStatus)
        .select('id');

      if (error) {
        if (error.code === '23P01' || error.code === '23505') {
          toast.error('This time slot conflicts with an existing accepted visit.');
          fetchAll();
          return;
        }
        throw error;
      }
      if (!updated?.length) {
        toast.error(`This visit is no longer "${fromStatus}".`);
        fetchAll();
        return;
      }
      toast.success(`Visit updated to "${nextStatus === 'On The Way' ? 'On Route' : nextStatus}"!`);
      fetchAll();
    } catch (err) {
      console.error('Error advancing visit:', err);
      toast.error('Failed to update visit status.');
    } finally {
      setUpdatingVisitId(null);
    }
  };

  // Provider can extend the duration of an active visit by 30 minutes via RPC
  const handleExtendDuration = async (id, patientName) => {
    setExtendingVisitId(id);
    try {
      const { data, error } = await supabase.rpc('provider_extend_request_duration', {
        p_request_id: id,
        p_additional_minutes: 30
      });

      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.message || 'Could not extend duration.');
        return;
      }

      toast.success(`Visit extended to ${data.new_duration_minutes} min (ends at ${data.end_time})!`);
      fetchAll();
    } catch (err) {
      console.error('Error extending visit duration:', err);
      toast.error(err.message || 'Failed to extend visit.');
    } finally {
      setExtendingVisitId(null);
    }
  };

  const confirmArrivalOverride = async () => {
    if (!arrivalOverride) return;
    const { id } = arrivalOverride;
    setUpdatingVisitId(id);
    try {
      const res = await markVisitArrived(id, null, ARRIVAL_OVERRIDE_REASON);
      setArrivalOverride(null);
      if (!res?.ok) {
        toast.error(formatArrivalFailure(res));
        return;
      }
      toast.success('Arrived — override recorded.');
      fetchAll();
    } catch (err) {
      console.error('Error recording arrival override:', err);
      setArrivalOverride(null);
      toast.error(err?.message || 'Failed to mark arrived.');
    } finally {
      setUpdatingVisitId(null);
    }
  };

  // Stats calculation
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isReqActive = useCallback((r) => (
    ['On The Way', 'Arrived'].includes(r.status) ||
    (r.status === 'Accepted' && (!r.rawDate || r.rawDate >= todayStr))
  ), [todayStr]);

  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'Pending').length;
    const active = requests.filter(isReqActive).length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    const history = requests.filter(r => ['Rejected', 'Cancelled'].includes(r.status)).length;
    return { pending, active, completed, history, total: requests.length };
  }, [requests, isReqActive]);

  // Filter & Search Logic
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      let matchesFilter = true;
      if (filter === 'Pending') matchesFilter = r.status === 'Pending';
      else if (filter === 'Active') matchesFilter = isReqActive(r);
      else if (filter === 'Completed') matchesFilter = r.status === 'Completed';
      else if (filter === 'History') matchesFilter = ['Rejected', 'Cancelled', 'Completed'].includes(r.status);

      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term ||
        r.patient.toLowerCase().includes(term) ||
        r.service.toLowerCase().includes(term) ||
        r.location.toLowerCase().includes(term) ||
        r.notes.toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [requests, filter, searchTerm, isReqActive]);

  // Reset page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  // Close mobile filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="provider">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-5 relative w-full max-w-full pb-10">

        {/* HEADER SECTION: Option 1 (Healthie Clinical Queue) with Integrated Toolbar */}
        <section className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-[2.25rem] space-y-3.5 sm:space-y-4">
          <div>
            <h1 className="font-display font-extrabold tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
              Incoming & Active Requests
            </h1>
            <p className="text-xs sm:text-sm text-tertiary mt-0.5 sm:mt-1 max-w-xl">
              Review bookings, update home visits, and coordinate patient consultations across Muntinlupa.
            </p>
          </div>

          {/* Integrated Toolbar: Desktop Tabs (hidden md:flex) + Mobile Side-by-Side Toolbar (md:hidden) */}
          <div className="pt-3 border-t border-slate-200/50 dark:border-white/5">
            
            {/* MOBILE (< md): Searchbox + Neumorphic Filter Dropdown side-by-side in 1 Row */}
            <div className="md:hidden flex items-center gap-2 w-full">
              {/* Searchbox taking flexible space */}
              <div className="neu-inset px-2.5 py-1.5 rounded-xl flex items-center gap-2 h-10 flex-1 min-w-0 border border-slate-200/50 dark:border-white/5">
                <Search className="w-3.5 h-3.5 text-link shrink-0" />
                <input
                  type="text"
                  aria-label="Search requests"
                  placeholder="Search patient, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="p-0.5 text-tertiary hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Custom Neumorphic Filter Dropdown beside Searchbox (No native select) */}
              <div className="relative shrink-0" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown((prev) => !prev)}
                  className={`neu-btn rounded-xl flex items-center h-10 px-2.5 sm:px-3 gap-1.5 cursor-pointer border transition-all active:scale-95 select-none ${
                    showFilterDropdown
                      ? 'border-link text-link neu-pressed'
                      : 'border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:border-link'
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={showFilterDropdown}
                  title="Filter requests by status"
                >
                  <Filter className="w-3.5 h-3.5 text-link shrink-0" />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {filter} ({filter === 'All' ? stats.total : filter === 'Pending' ? stats.pending : filter === 'Active' ? stats.active : filter === 'Completed' ? stats.completed : stats.history})
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-tertiary shrink-0 transition-transform duration-200 ${
                      showFilterDropdown ? 'rotate-180 text-link' : ''
                    }`}
                  />
                </button>

                {/* Neumorphic Floating Dropdown Menu */}
                <AnimatePresence>
                  {showFilterDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="neu-flat absolute right-0 top-full mt-2 w-48 sm:w-52 rounded-2xl p-1.5 z-50 shadow-2xl border border-white/80 dark:border-white/10 bg-surface-shell"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-200/60 dark:border-white/5 mb-1 flex items-center justify-between">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                          Filter Status
                        </span>
                        <span className="text-xs text-link font-extrabold">
                          {filter}
                        </span>
                      </div>

                      <div className="space-y-1" role="listbox">
                        {[
                          { value: 'All', label: 'All', count: stats.total },
                          { value: 'Pending', label: 'Pending', count: stats.pending },
                          { value: 'Active', label: 'Active', count: stats.active },
                          { value: 'Completed', label: 'Completed', count: stats.completed },
                          { value: 'History', label: 'History', count: stats.history },
                        ].map((opt) => {
                          const isSelected = filter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setFilter(opt.value);
                                setShowFilterDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'neu-inset text-link font-black bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20'
                                  : 'text-slate-700 dark:text-slate-200 hover:text-link hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{opt.label}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                                    isSelected
                                      ? 'bg-blue-500/20 text-link'
                                      : 'bg-slate-200/70 dark:bg-slate-800 text-tertiary'
                                  }`}
                                >
                                  {opt.count}
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-link stroke-[3] shrink-0 ml-1.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* DESKTOP / TABLET (hidden md:flex): Segmented Tabs on Left, Searchbox on Right */}
            <div className="hidden md:flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/70 dark:bg-[#0E1724] border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filter === 'All'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>All</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    filter === 'All' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('Pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filter === 'Pending'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Pending</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    filter === 'Pending' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.pending}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('Active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filter === 'Active'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Active</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    filter === 'Active' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.active}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('Completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filter === 'Completed'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Completed</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    filter === 'Completed' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.completed}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter('History')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    filter === 'History'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>History</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    filter === 'History' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.history}
                  </span>
                </button>
              </div>

              {/* Compact Integrated Search Box for Desktop */}
              <div className="relative w-72 shrink-0">
                <div className="neu-inset px-2.5 py-1.5 rounded-xl flex items-center gap-2 h-10 border border-slate-200/50 dark:border-white/5">
                  <Search className="w-3.5 h-3.5 text-link shrink-0" />
                  <input
                    type="text"
                    aria-label="Search requests"
                    placeholder="Search patient, service, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent border-0 px-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="p-0.5 text-tertiary hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* REQUEST CARDS GRID */}
        {paginatedRequests.length > 0 ? (
          <>
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
            <AnimatePresence mode="popLayout">
              {paginatedRequests.map((req) => (
                <motion.div
                  key={req.id}
                  variants={staggerItem}
                  layout
                  className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3 select-text transition-all"
                >
                  {/* Top Bar: Patient Avatar + Name + Clean Rectangular Status Tag (No Dots, No Pills) */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        to={`/provider/patients/${req.patientId}/profile`}
                        className="flex items-center gap-2.5 sm:gap-3 min-w-0 group"
                      >
                        <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center text-link font-black text-xs sm:text-sm shrink-0 p-0.5">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} alt="" className="w-full h-full object-cover rounded-[10px] sm:rounded-xl" />
                          ) : (
                            req.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-extrabold text-slate-900 dark:text-white group-hover:text-link transition-colors text-xs sm:text-sm truncate">
                            {req.patient}
                          </h3>
                          <p className="text-2xs sm:text-xs font-semibold text-link truncate mt-0.5">
                            {req.service}
                          </p>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    {/* Middle Meta Details: Date, Time, Location */}
                    <div className="mt-3 py-2 px-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600 dark:text-slate-300 font-medium text-xs w-full">
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-link shrink-0" />
                          <span>{req.date}</span>
                        </span>
                        {req.time && (
                          <>
                            <span className="text-tertiary">&bull;</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <Clock className="w-3.5 h-3.5 text-link shrink-0" />
                              <span>{req.time}</span>
                            </span>
                          </>
                        )}
                        <span className="flex items-center gap-1.5 min-w-0 ml-auto">
                          <MapPin className="w-3.5 h-3.5 text-link shrink-0" />
                          <span className="truncate max-w-[150px] sm:max-w-[210px]" title={req.location}>
                            {req.location}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Patient Notes: Clean Left Accent Line (No Sunken Inset Well) */}
                    <div className="mt-2.5 pl-3 border-l-2 border-slate-300 dark:border-slate-700 py-0.5 space-y-0.5">
                      <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                        Patient Note
                      </p>
                      {req.notes && req.notes.trim() ? (
                        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed italic">
                          &ldquo;{req.notes}&rdquo;
                        </p>
                      ) : (
                        <p className="text-xs text-tertiary italic">
                          No additional notes provided by patient.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Action Bar */}
                  <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/provider/messages?partner=${req.patientId}&name=${encodeURIComponent(req.patient)}`}
                        className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1.5 shrink-0"
                        title="Chat with Patient"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-link" />
                        <span>Chat</span>
                      </Link>
                      <Link
                        to={`/provider/patients/${req.patientId}/profile`}
                        className="text-xs font-bold text-tertiary hover:text-link transition-colors px-1"
                      >
                        Profile &rarr;
                      </Link>
                    </div>

                    {/* Action Buttons for Pending or Active visits */}
                    {(req.status === 'Pending' || STATUS_FLOW[req.status]) && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {/* Pending Request: Accept / Decline */}
                        {req.status === 'Pending' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!!actionStates[req.id]}
                              onClick={() => handleAction(req.id, 'accepted', req.patient)}
                              className="neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-success hover:bg-emerald-500 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              disabled={!!actionStates[req.id]}
                              onClick={() => handleAction(req.id, 'rejected', req.patient)}
                              className="neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-danger hover:bg-rose-500 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>
                          </div>
                        )}

                        {/* Active In-Progress Visits: Duration Extension Button */}
                        {['Accepted', 'On The Way', 'Arrived'].includes(req.status) && (
                          <button
                            type="button"
                            disabled={extendingVisitId === req.id || updatingVisitId === req.id}
                            onClick={() => handleExtendDuration(req.id, req.patient)}
                            className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-link hover:text-primary transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Extend visit duration by 30 minutes via RPC"
                          >
                            {extendingVisitId === req.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extending...</>
                            ) : (
                              <><Clock className="w-3.5 h-3.5" /> +30m</>
                            )}
                          </button>
                        )}

                        {/* Active In-Progress Visits: Progression Stepper Button */}
                        {STATUS_FLOW[req.status] && (
                          <button
                            type="button"
                            disabled={updatingVisitId === req.id}
                            onClick={() => handleAdvanceVisit(req.id, STATUS_FLOW[req.status].next, req.status)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                              STATUS_FLOW[req.status].color
                            }`}
                          >
                            {updatingVisitId === req.id ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</>
                            ) : (
                              <>
                                {STATUS_FLOW[req.status].icon}
                                <span>{STATUS_FLOW[req.status].label}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {/* BOTTOM PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="neu-flat p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3">
              <p className="text-2xs sm:text-xs font-semibold text-tertiary truncate">
                Showing {paginatedRequests.length} of {filteredRequests.length} requests
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="neu-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all flex items-center gap-1 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <span className="neu-inset px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-extrabold text-slate-800 dark:text-slate-200 select-none">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="neu-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all flex items-center gap-1 cursor-pointer"
                  title="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
          <div className="neu-flat p-8 sm:p-12 rounded-2xl sm:rounded-[2.25rem] text-center">
            <EmptyState
              icon={searchTerm ? 'search' : 'inbox'}
              title={
                searchTerm
                  ? 'No matching requests found'
                  : filter === 'Pending'
                  ? 'All caught up! No pending requests'
                  : `No ${filter.toLowerCase()} requests`
              }
              message={
                searchTerm
                  ? `No bookings matched "${searchTerm}". Try adjusting your keywords.`
                  : filter === 'Pending'
                  ? 'You have responded to all incoming visit requests. Active and upcoming visits can be managed in their respective tabs.'
                  : `New patient appointments and service requests under "${filter}" will appear here.`
              }
              action={
                searchTerm
                  ? { label: 'Clear Search', onClick: () => setSearchTerm('') }
                  : filter === 'Pending' && stats.active > 0
                  ? { label: `View ${stats.active} Active Visits`, onClick: () => setFilter('Active') }
                  : filter !== 'All'
                  ? { label: 'View All Bookings', onClick: () => setFilter('All') }
                  : null
              }
            />
          </div>
        )}

      </div>

      <ArrivalOverrideDialog
        open={Boolean(arrivalOverride)}
        failure={arrivalOverride?.failure}
        busy={updatingVisitId === arrivalOverride?.id}
        onCancel={() => setArrivalOverride(null)}
        onConfirm={confirmArrivalOverride}
      />
    </DashboardLayout>
  );
};

export default ProviderRequests;
