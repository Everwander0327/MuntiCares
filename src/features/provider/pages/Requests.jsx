import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Check, X, MapPin, Calendar, Clock, CheckCircle2, Loader2, 
  Search, SlidersHorizontal, Navigation, Home, MessageSquare, 
  ChevronLeft, ChevronRight, User, Stethoscope, AlertCircle, Sparkles, Filter
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
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 shadow-xs">
          Completed
        </span>
      );
    case 'Pending':
      return (
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 shadow-xs">
          Pending
        </span>
      );
    case 'Accepted':
    case 'On The Way':
    case 'Arrived':
      return (
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 shadow-xs">
          {status}
        </span>
      );
    case 'Rejected':
      return (
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 shadow-xs">
          Rejected
        </span>
      );
    case 'Cancelled':
      return (
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-white/10 shadow-xs">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500 bg-slate-200/50">
          {status}
        </span>
      );
  }
};

const ProviderRequests = () => {
  const [filter, setFilter] = useState('All'); // 'All' | 'Pending' | 'Active' | 'Completed' | 'History'
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  const [updatingVisitId, setUpdatingVisitId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const { user } = useAuth();

  const fetchAll = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('id, patient_id, service, date, time, notes, status, created_at, patient:patient_id(full_name, avatar_url)')
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
            timeLabel = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch { timeLabel = r.time || ''; }

        return {
          id: r.id,
          patientId: r.patient_id,
          patient: r.patient?.full_name || 'Unknown Patient',
          avatarUrl: r.patient?.avatar_url || '',
          service: r.service,
          date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
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
  const handleAdvanceVisit = async (visitId, nextStatus) => {
    setUpdatingVisitId(visitId);
    try {
      const payload = { status: nextStatus };
      const nowIso = new Date().toISOString();
      if (nextStatus === 'On The Way') payload.route_started_at = nowIso;
      if (nextStatus === 'Arrived') payload.arrived_at = nowIso;

      const { error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', visitId);

      if (error) throw error;
      toast.success(`Visit updated to "${nextStatus === 'On The Way' ? 'On Route' : nextStatus}"!`);
      fetchAll();
    } catch (err) {
      console.error('Error advancing visit:', err);
      toast.error('Failed to update visit status.');
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
  }, [requests, filter, searchTerm]);

  // Reset page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

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
      <div className="flex-1 flex flex-col justify-between space-y-4 sm:space-y-6 relative w-full max-w-full pb-10">

        {/* HEADER SECTION: Unified Neumorphic Card with Stats & Sunken Search */}
        <section className="neu-flat p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.25rem] space-y-3.5 sm:space-y-5 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="font-display font-extrabold tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
                Incoming & Active Requests
              </h1>
              <p className="text-3xs sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 max-w-xl">
                Review bookings, update home visits, and coordinate patient consultations across Muntinlupa.
              </p>
            </div>

            {/* Quick Filter Pills with scroll on small screens */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
              <button
                type="button"
                onClick={() => setFilter(filter === 'Pending' ? 'All' : 'Pending')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === 'Pending'
                    ? 'neu-pressed text-amber-600 dark:text-amber-400 border border-amber-500/40 bg-amber-500/15'
                    : 'neu-btn text-amber-600 dark:text-amber-400 hover:text-amber-700'
                }`}
                title="Filter Pending requests"
              >
                <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{stats.pending} Pending</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'Active' ? 'All' : 'Active')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === 'Active'
                    ? 'neu-pressed text-blue-600 dark:text-blue-400 border border-blue-500/40 bg-blue-500/15'
                    : 'neu-btn text-blue-600 dark:text-blue-400 hover:text-blue-700'
                }`}
                title="Filter Active / In-progress visits"
              >
                <Navigation className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{stats.active} Active</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'Completed' ? 'All' : 'Completed')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === 'Completed'
                    ? 'neu-pressed text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 bg-emerald-500/15'
                    : 'neu-btn text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                }`}
                title="Filter Completed visits"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>{stats.completed} Completed</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'History' ? 'All' : 'History')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === 'History'
                    ? 'neu-pressed text-slate-600 dark:text-slate-300 border border-slate-500/40 bg-slate-500/15'
                    : 'neu-btn text-slate-600 dark:text-slate-300 hover:text-slate-800'
                }`}
                title="Filter History (Rejected, Cancelled, Completed)"
              >
                <Filter className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{stats.history} History</span>
              </button>

              {filter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setFilter('All')}
                  className="neu-btn px-2.5 sm:px-3 py-1.5 rounded-full text-3xs font-extrabold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Clear filter and show all"
                >
                  <X className="w-3 h-3" />
                  <span>Show All</span>
                </button>
              )}
            </div>
          </div>

          {/* Sunken Search Box */}
          <div className="flex items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
            <div className="relative flex-1 min-w-0">
              <div className="neu-inset p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 h-[42px] sm:h-[50px] border border-slate-200/50 dark:border-white/5">
                <Search className="w-4 h-4 text-primary ml-1.5 sm:ml-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search patient, service, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400 placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer mr-1"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION HEADER & FAR-RIGHT PAGINATION */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white truncate">
              {filter === 'All' ? 'All Service Bookings' : `${filter} Requests`}
            </h2>
            <p className="text-3xs sm:text-xs text-slate-500 mt-0.5">
              Showing {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'}
              {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
            </p>
          </div>

          {/* Minimalist Far-Right Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-3xs font-extrabold text-slate-500 px-1 select-none">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* REQUEST CARDS GRID */}
        {paginatedRequests.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5"
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
                  className="neu-flat rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-6 flex flex-col justify-between space-y-3 sm:space-y-3.5 select-text transition-all"
                >
                  {/* Top Bar: Patient Avatar + Name + Chat Button & Status Badge */}
                  <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                    <Link
                      to={`/provider/patients/${req.patientId}/profile`}
                      className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 group"
                    >
                      <div className="neu-flat-sm w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center text-primary font-black text-xs sm:text-base shrink-0 p-0.5">
                        {req.avatarUrl ? (
                          <img src={req.avatarUrl} alt="" className="w-full h-full object-cover rounded-[10px] sm:rounded-xl" />
                        ) : (
                          req.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display font-extrabold text-slate-900 dark:text-white group-hover:text-primary transition-colors text-xs sm:text-base truncate">
                          {req.patient}
                        </h3>
                        <p className="text-3xs sm:text-xs font-semibold text-primary truncate mt-0.5">
                          {req.service}
                        </p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Chat with Patient Button beside the status chip */}
                      <Link
                        to={`/provider/messages?partner=${req.patientId}&name=${encodeURIComponent(req.patient)}`}
                        className="neu-btn p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-3xs font-bold text-primary flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                        title="Chat with Patient"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Chat</span>
                      </Link>

                      {getStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Middle Meta Details: Date, Time, Location */}
                  <div className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-slate-600 dark:text-slate-300 font-medium text-3xs sm:text-xs w-full">
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{req.date}</span>
                      </span>
                      {req.time && (
                        <span className="flex items-center gap-1.5 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{req.time}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[170px] sm:max-w-none">{req.location}</span>
                      </span>
                    </div>
                  </div>

                  {/* Patient Notes (Sunken Inset Well) */}
                  <div className="neu-inset p-2.5 sm:p-3 rounded-xl border border-slate-200/40 dark:border-white/5 space-y-1">
                    <p className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">
                      Patient Notes
                    </p>
                    {req.notes && req.notes.trim() ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                        "{req.notes}"
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        No additional notes provided by patient.
                      </p>
                    )}
                  </div>

                  {/* Action Buttons for Pending or Active visits */}
                  {(req.status === 'Pending' || STATUS_FLOW[req.status]) && (
                    <div className="pt-2 border-t border-slate-200/40 dark:border-white/5 flex flex-wrap items-center justify-end gap-2">
                      {/* Pending Request: Accept / Decline */}
                      {req.status === 'Pending' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            disabled={!!actionStates[req.id]}
                            onClick={() => handleAction(req.id, 'accepted', req.patient)}
                            className="neu-btn px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                          <button
                            type="button"
                            disabled={!!actionStates[req.id]}
                            onClick={() => handleAction(req.id, 'rejected', req.patient)}
                            className="neu-btn px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      )}

                      {/* Active In-Progress Visits: Progression Stepper Button */}
                      {STATUS_FLOW[req.status] && (
                        <button
                          type="button"
                          disabled={updatingVisitId === req.id}
                          onClick={() => handleAdvanceVisit(req.id, STATUS_FLOW[req.status].next)}
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
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
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
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
    </DashboardLayout>
  );
};

export default ProviderRequests;
