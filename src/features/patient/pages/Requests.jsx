import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Clock, MapPin, MessageSquare, XCircle, FileUp, 
  Search, SlidersHorizontal, Check, Calendar,
  ChevronRight, ChevronLeft, X, ChevronDown,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { presessionMapFor, ratedMapFor } from '@/features/patient/utils/localState';
import usePatientRequests from '@/hooks/usePatientRequests';
import { supabase } from '@/lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import ReviewModal from '../components/ReviewModal';
import CancelRescheduleModal from '../components/CancelRescheduleModal';
import PreSessionUploadModal from '../components/PreSessionUploadModal';
import { EmptyState, SkeletonPage } from '@/shared/ui';
import { LiveVisitTrackerModal } from '@/features/tracking/components';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'Accepted':
      return { textColor: 'text-sky-600 dark:text-[#8CBDF0]' };
    case 'On The Way':
    case 'Arrived':
      return { textColor: 'text-emerald-600 dark:text-emerald-400' };
    case 'Completed':
      return { textColor: 'text-slate-600 dark:text-slate-400' };
    case 'Pending':
      return { textColor: 'text-amber-600 dark:text-amber-400' };
    case 'Cancelled':
      return { textColor: 'text-slate-400 dark:text-slate-500' };
    case 'Rejected':
    default:
      return { textColor: 'text-rose-600 dark:text-rose-400' };
  }
};

const RequestCard = ({ 
  id, providerId, patientId, provider, providerAvatarUrl, service, date, time, 
  status, location, originalNotes, durationMinutes, onRateProvider, isRated, 
  onManageRequest, onPreSession, presessionSubmitted, onTrack
}) => {
  const statusTheme = getStatusStyle(status);

  return (
    <motion.div
      variants={staggerItem}
      className="neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden flex flex-col justify-between select-text transform-gpu will-change-transform"
    >
      {/* Upper Content Area */}
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-3.5">
        {/* Top Header: Provider Avatar & Info + Status Badge */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            {providerId ? (
              <Link
                to={`/patient/providers/${providerId}/profile`}
                title="View Provider Profile"
                className="relative shrink-0 group"
              >
                <div className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-link font-black text-sm sm:text-base overflow-hidden aspect-square ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                  {providerAvatarUrl ? (
                    <img src={providerAvatarUrl} alt={provider} className="w-full h-full object-cover" />
                  ) : (
                    (provider || 'Unknown').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
              </Link>
            ) : (
              <div className="relative shrink-0">
                <div className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-link font-black text-sm sm:text-base overflow-hidden aspect-square">
                  {providerAvatarUrl ? (
                    <img src={providerAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (provider || 'Unknown').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
              </div>
            )}
            <div className="min-w-0">
              {providerId ? (
                <Link
                  to={`/patient/providers/${providerId}/profile`}
                  className="font-display font-extrabold text-slate-900 dark:text-white hover:text-link dark:hover:text-[#8CBDF0] transition-colors text-sm sm:text-base truncate block"
                >
                  {provider}
                </Link>
              ) : (
                <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {provider}
                </h3>
              )}
              <p className="text-xs font-semibold text-link truncate mt-0.5">
                {service}
              </p>
            </div>
          </div>

          {/* Clean Text-Only Status (No Pill Background, No Green Dot) */}
          <div className="shrink-0 text-right">
            <span className={`text-xs font-extrabold tracking-tight ${statusTheme.textColor}`}>
              {status}
            </span>
          </div>
        </div>

        {/* Middle Meta Details (Clean Flat Style) */}
        <div className="py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs bg-surface-subtle border border-surface-border">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-txt-secondary dark:text-txt-darkSecondary font-medium text-xs sm:text-xs">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-link shrink-0" />
              <span>{date}</span>
            </span>
            {time && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-link shrink-0" />
                <span>
                  {new Date(`2000-01-01T${time.slice(0, 5)}:00`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-link shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-none">{location || 'Muntinlupa City'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Flush at Bottom */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-0">
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2">
          {/* Chat Shortcut */}
          {['Accepted', 'On The Way', 'Arrived'].includes(status) && (
            <Link 
              to={`/patient/messages?provider=${providerId}`}
              className={`${['On The Way', 'Arrived'].includes(status) ? 'col-span-1' : 'col-span-2'} sm:col-span-1 neu-btn-primary justify-center px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] transition-transform order-1`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Chat Provider</span>
            </Link>
          )}

          {/* Live GPS Tracker */}
          {['On The Way', 'Arrived'].includes(status) && (
            <button
              type="button"
              onClick={() => onTrack({ id, providerId, patientId, provider, providerAvatarUrl, service })}
              className="col-span-1 sm:col-span-1 min-h-[44px] justify-center px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-bold text-link dark:text-[#8CBDF0] bg-white/70 dark:bg-white/[0.04] border border-primary/25 dark:border-[#8CBDF0]/25 flex items-center gap-1.5 cursor-pointer hover:bg-primary/5 dark:hover:bg-[#8CBDF0]/10 active:scale-[0.98] transition-colors order-1"
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span className="truncate">Track live</span>
            </button>
          )}

          {/* Pre-Session Info */}
          {['Accepted', 'Pending'].includes(status) && (
            <button
              type="button"
              onClick={() => !presessionSubmitted && onPreSession({ id, providerId, patientId, providerName: provider })}
              disabled={presessionSubmitted}
              className={`col-span-1 justify-center px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] order-2 ${
                presessionSubmitted
                  ? 'neu-flat-sm text-[#2C7A55] dark:text-[#7DD3A3] cursor-default opacity-90'
                  : 'neu-btn text-link dark:text-[#8CBDF0]'
              }`}
            >
              <FileUp className={`w-3.5 h-3.5 shrink-0 ${presessionSubmitted ? 'text-[#2C7A55] dark:text-[#7DD3A3]' : 'text-link dark:text-[#8CBDF0]'}`} />
              <span className="truncate">{presessionSubmitted ? 'Submitted' : 'Pre-Session Info'}</span>
            </button>
          )}

          {/* Manage Request (Cancel/Reschedule) */}
          {['Pending', 'Accepted'].includes(status) && (
            <button
              type="button"
              onClick={() => onManageRequest({ id, providerId, patientId, providerName: provider, service, date, time, originalNotes, durationMinutes })}
              className="col-span-1 neu-btn justify-center px-3 sm:px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-[#BC3030] dark:text-[#F4918B] flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform order-3"
            >
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Manage</span>
            </button>
          )}

          {/* Rate & Review */}
          {status === 'Completed' && (
            <button 
              type="button"
              onClick={() => !isRated && onRateProvider({ id, providerId, patientId, providerName: provider })}
              disabled={isRated}
              className={`col-span-2 sm:col-span-1 w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold flex items-center transition-all cursor-pointer ${
                isRated 
                  ? 'neu-flat-sm text-success dark:text-success-dark cursor-default opacity-90' 
                  : 'neu-btn-primary shadow-sm'
              }`}
            >
              <span>{isRated ? 'Reviewed' : 'Rate & Review'}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const PatientRequests = () => {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past' | 'all'
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewReq, setSelectedReviewReq] = useState(null);
  const [selectedManageReq, setSelectedManageReq] = useState(null);
  const [selectedPreSessionReq, setSelectedPreSessionReq] = useState(null);
  const [trackingReq, setTrackingReq] = useState(null);
  const [ratedRequests, setRatedRequests] = useState({});
  const [presessionSubmitted, setPresessionSubmitted] = useState({});
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const filterMenuRef = React.useRef(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const localRated = ratedMapFor(user?.id);
    const presession = presessionMapFor(user?.id);
    setPresessionSubmitted(presession);

    if (user) {
      supabase
        .from('provider_reviews')
        .select('request_id')
        .eq('patient_id', user.id)
        .then(({ data }) => {
          const dbRated = {};
          (data || []).forEach(r => { dbRated[r.request_id] = true; });
          setRatedRequests({ ...dbRated, ...localRated });
        })
        .catch(() => setRatedRequests(localRated));
    } else {
      setRatedRequests(localRated);
    }
  }, [user]);

  // Use the shared hook for fetching and realtime
  const { requests: fetchedRequests, loading: requestsLoading, refetch } = usePatientRequests(user?.id || null);

  useEffect(() => {
    if (!requestsLoading) {
      setRequests(fetchedRequests || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [fetchedRequests, requestsLoading]);

  const filters = ['All', 'Active', 'Accepted', 'Pending', 'Completed', 'Cancelled', 'Rejected'];

  const todayStr = new Date().toLocaleDateString('en-CA');
  const isReqActive = useCallback((r) => (
    ['On The Way', 'Arrived'].includes(r.status) ||
    (r.status === 'Accepted' && (!r.date || r.date >= todayStr))
  ), [todayStr]);

  const activeLiveReq = useMemo(() => {
    return requests.find(r => ['On The Way', 'Arrived'].includes(r.status));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // 1. Tab filter
      if (activeTab === 'upcoming' && !['Pending', 'Accepted', 'On The Way', 'Arrived'].includes(r.status)) {
        return false;
      }
      if (activeTab === 'past' && !['Completed', 'Cancelled', 'Rejected'].includes(r.status)) {
        return false;
      }

      // 2. Status dropdown filter
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Active' ? isReqActive(r) : r.status === filter);
      if (!matchesFilter) return false;

      // 3. Search filter
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        r.provider?.toLowerCase().includes(term) ||
        r.service?.toLowerCase().includes(term) ||
        r.location?.toLowerCase().includes(term);
      return matchesSearch;
    });
  }, [requests, activeTab, filter, searchTerm, isReqActive]);

  // Reset to first page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filter, searchTerm]);

  // Smoothly scroll back to top of main container when changing pagination pages
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  // Compute a compact set of visible page numbers (e.g. 1 ... 4 5 6 ... 12)
  const visiblePages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  // Quick Counter Stats
  const stats = useMemo(() => {
    const upcoming = requests.filter(r => ['Pending', 'Accepted', 'On The Way', 'Arrived'].includes(r.status)).length;
    const past = requests.filter(r => ['Completed', 'Cancelled', 'Rejected'].includes(r.status)).length;
    const pending = requests.filter(r => r.status === 'Pending').length;
    const active = requests.filter(isReqActive).length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    return { upcoming, past, pending, active, completed, total: requests.length };
  }, [requests, isReqActive]);

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="patient">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-6 relative w-full max-w-full">
        
        {/* Slim Live Visit Notification (Polite & Calm, Zero Green Dots) */}
        {activeLiveReq && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-50/60 dark:bg-sky-950/30 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0">
              <div className="text-xs text-slate-900 dark:text-white truncate">
                <strong className="font-bold">{activeLiveReq.provider}</strong> is on the way &bull;{' '}
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {activeLiveReq.service} ({activeLiveReq.status})
                </span>
              </div>
              <div className="text-2xs text-tertiary mt-0.5">
                Scheduled for {activeLiveReq.date} &bull; Muntinlupa City
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Link
                to={`/patient/messages?provider=${activeLiveReq.providerId}`}
                className="neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Chat
              </Link>
              <button
                type="button"
                onClick={() => setTrackingReq(activeLiveReq)}
                className="neu-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Track Live GPS</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Header Card with Segmented Tabs */}
        <section className="neu-flat p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="font-display font-extrabold tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
                My Service Requests
              </h1>
              <p className="text-xs sm:text-sm text-tertiary mt-0.5">
                Track, reschedule, and manage all your healthcare appointments.
              </p>
            </div>
          </div>

            {/* Clean Segmented Tab Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/70 dark:border-slate-800 text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => { setActiveTab('upcoming'); setFilter('All'); }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'upcoming'
                    ? 'bg-white dark:bg-slate-800 text-link font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Upcoming ({stats.upcoming})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('past'); setFilter('All'); }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'past'
                    ? 'bg-white dark:bg-slate-800 text-link font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Past Visits ({stats.past})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('all'); setFilter('All'); }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-800 text-link font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({stats.total})
              </button>
            </div>

            {/* Integrated Search Bar + Side Dropdown Button */}
          <div className="flex items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
            {/* Sunken Search Box */}
            <div className="relative flex-1 min-w-0">
              <div className="neu-inset p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 h-[44px] sm:h-[52px] border border-slate-200/50 dark:border-white/5">
                <Search className="w-4 h-4 text-link ml-1.5 sm:ml-2 shrink-0" />
                <input
                  type="text"
                  aria-label="Search requests by provider or service"
                  placeholder="Search provider, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="p-1 text-tertiary hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer mr-1"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Filter Button beside searchbox */}
            <div className="relative shrink-0 z-50" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu(prev => !prev)}
                className={`neu-btn h-[44px] sm:h-[52px] px-3 sm:px-4 rounded-xl sm:rounded-2xl flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer relative outline-none select-none ${
                  showFilterMenu ? 'text-link' : 'text-slate-600 dark:text-slate-300 hover:text-link'
                }`}
                title={`Filter by: ${filter === 'All' ? 'All Requests' : filter}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">
                  {filter === 'All' ? 'All Requests' : filter}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-tertiary" />
                {filter !== 'All' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>

              {/* Floating Filter Popup Menu */}
              <AnimatePresence>
                {showFilterMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 sm:w-56 neu-flat rounded-2xl p-2 z-50 shadow-2xl border border-white/60 dark:border-white/10"
                  >
                    <div className="px-3 py-2 border-b border-slate-200/60 dark:border-white/5 mb-1 flex items-center justify-between">
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Filter Status</span>
                      <span className="text-xs text-link font-bold">{filter}</span>
                    </div>
                    <div className="space-y-1">
                      {filters.map((f) => {
                        const active = filter === f;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => {
                              setFilter(f);
                              setShowFilterMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              active
                                ? 'neu-flat-sm text-link font-bold shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <span>{f === 'All' ? 'All Requests' : f}</span>
                            {active && <Check className="w-3.5 h-3.5 text-link shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

        {/* Request Cards Feed */}
        <motion.div
          className="space-y-3 sm:space-y-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {paginatedRequests.length > 0 ? (
            paginatedRequests.map((req) => (
              <RequestCard 
                key={req.id} 
                id={req.id}
                providerId={req.providerId}
                patientId={user?.id}
                provider={req.provider}
                providerAvatarUrl={req.providerAvatarUrl}
                service={req.service}
                date={req.date}
                time={req.time}
                status={req.status}
                location={req.location}
                originalNotes={req.originalNotes}
                durationMinutes={req.durationMinutes}
                isRated={!!ratedRequests[req.id]}
                presessionSubmitted={!!presessionSubmitted[req.id]}
                onRateProvider={setSelectedReviewReq}
                onManageRequest={setSelectedManageReq}
                onPreSession={setSelectedPreSessionReq}
                onTrack={setTrackingReq}
              />
            ))
          ) : (
            <div className="neu-flat p-8 sm:p-12 rounded-2xl sm:rounded-[2.25rem] text-center">
              <EmptyState
                icon="inbox"
                title={requests.length === 0 ? 'No requests yet' : 'No matching requests'}
                message={requests.length === 0 ? 'Book a consultation with a certified healthcare provider to get started!' : 'Try selecting another status filter or clear your search query.'}
                action={requests.length === 0 ? { label: 'Find Providers', onClick: () => navigate('/patient/providers') } : undefined}
              />
            </div>
          )}
        </motion.div>

        {/* Neumorphic Pagination Controls */}
        {filteredRequests.length > itemsPerPage && (
          <div className="neu-flat p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto pt-4">
            <span className="text-sm text-tertiary dark:text-tertiary font-medium text-center sm:text-left">
              Showing <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</strong> requests
            </span>

            <div className="flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="neu-btn px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Prev</span>
              </button>

              <div className="flex items-center gap-1 px-0.5 sm:px-1">
                {visiblePages.map((pageNum, idx) => {
                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="w-5 sm:w-6 text-center text-xs text-tertiary select-none">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-11 h-11 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'neu-btn-primary shadow-sm text-white'
                          : 'neu-btn text-slate-600 dark:text-tertiary hover:text-link'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="neu-btn px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal 
        isOpen={!!selectedReviewReq} 
        onClose={() => setSelectedReviewReq(null)}
        request={selectedReviewReq}
        onReviewSubmitted={(requestId) => {
          setRatedRequests(prev => ({ ...prev, [requestId]: true }));
        }}
      />

      {/* Cancel / Reschedule Modal */}
      <CancelRescheduleModal
        isOpen={!!selectedManageReq}
        onClose={() => setSelectedManageReq(null)}
        request={selectedManageReq}
        onActionComplete={refetch}
      />

      {/* Pre-Session Upload Modal */}
      <PreSessionUploadModal
        isOpen={!!selectedPreSessionReq}
        onClose={() => {
          setPresessionSubmitted(presessionMapFor(user?.id));
          setSelectedPreSessionReq(null);
        }}
        request={selectedPreSessionReq}
      />

      {/* Live GPS Tracker */}
      <LiveVisitTrackerModal
        isOpen={!!trackingReq}
        onClose={() => setTrackingReq(null)}
        request={trackingReq}
      />
    </DashboardLayout>
  );
};

export default PatientRequests;
