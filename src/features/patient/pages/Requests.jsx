import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Clock, MapPin, MessageSquare, XCircle, FileUp, 
  Search, SlidersHorizontal, Check, Calendar, Activity, 
  ChevronRight, ChevronLeft, ArrowUpDown, Filter, Sparkles, X, ChevronDown,
  AlertCircle, CheckCircle2, ShieldAlert, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
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
    case 'On The Way':
    case 'Arrived':
      return {
        badge: 'neu-flat-sm text-[#2C7A55] dark:text-[#7DD3A3] border border-[#2C7A55]/30 dark:border-[#7DD3A3]/30 bg-[#E1F3EA] dark:bg-[#14301F] font-black',
        icon: Sparkles,
        dot: 'bg-[#2C7A55] dark:bg-[#7DD3A3]',
        ping: true,
      };
    case 'Completed':
      return {
        badge: 'neu-flat-sm text-[#2F6FB5] dark:text-[#8CBDF0] border border-[#2F6FB5]/30 dark:border-[#8CBDF0]/30 bg-[#DDEBF8] dark:bg-[#183049] font-black',
        icon: CheckCircle2,
        dot: 'bg-[#2F6FB5] dark:bg-[#8CBDF0]',
        ping: false,
      };
    case 'Pending':
      return {
        badge: 'neu-flat-sm text-[#9C5A06] dark:text-[#F1BD6B] border border-[#9C5A06]/30 dark:border-[#F1BD6B]/30 bg-[#FFF1D6] dark:bg-[#34260E] font-black',
        icon: Clock,
        dot: 'bg-[#9C5A06] dark:bg-[#F1BD6B]',
        ping: false,
      };
    case 'Cancelled':
      return {
        badge: 'neu-flat-sm text-[#52657A] dark:text-[#A5B6C8] border border-[#D2E0EE] dark:border-[#2D3F54] bg-[#E9F1F9] dark:bg-[#1F2D3E] font-bold',
        icon: XCircle,
        dot: 'bg-[#52657A] dark:bg-[#A5B6C8]',
        ping: false,
      };
    case 'Rejected':
    default:
      return {
        badge: 'neu-flat-sm text-[#BC3030] dark:text-[#F4918B] border border-[#BC3030]/30 dark:border-[#F4918B]/30 bg-[#FCE8E6] dark:bg-[#3C1B1A] font-black',
        icon: AlertCircle,
        dot: 'bg-[#BC3030] dark:bg-[#F4918B]',
        ping: false,
      };
  }
};

const RequestCard = ({ 
  id, providerId, patientId, provider, providerAvatarUrl, service, date, time, 
  status, price, location, originalNotes, onRateProvider, isRated, 
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
        {/* Top Header: Provider Avatar & Info + Status Badge & Mobile Price */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            {providerId ? (
              <Link
                to={`/patient/providers/${providerId}/profile`}
                title="View Provider Profile"
                className="relative shrink-0 group"
              >
                <div className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-primary font-black text-sm sm:text-base overflow-hidden aspect-square ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                  {providerAvatarUrl ? (
                    <img src={providerAvatarUrl} alt={provider} className="w-full h-full object-cover" />
                  ) : (
                    (provider || 'Unknown').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
              </Link>
            ) : (
              <div className="relative shrink-0">
                <div className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-primary font-black text-sm sm:text-base overflow-hidden aspect-square">
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
                  className="font-display font-extrabold text-slate-900 dark:text-white hover:text-primary dark:hover:text-[#8CBDF0] transition-colors text-sm sm:text-base truncate block"
                >
                  {provider}
                </Link>
              ) : (
                <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {provider}
                </h3>
              )}
              <p className="text-xs font-semibold text-primary truncate mt-0.5">
                {service}
              </p>
            </div>
          </div>

          {/* Status Badge & Mobile Price */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-3 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-3xs shadow-xs ${statusTheme.badge}`}>
              {statusTheme.ping ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              ) : (
                <statusTheme.icon className="w-3 h-3 shrink-0" />
              )}
              <span>{status}</span>
            </span>
            <span className="font-display text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums sm:hidden">
              ₱{Number(price || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Middle Meta Details (Clean Flat Style) */}
        <div className="py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs bg-[#E9F1F9] dark:bg-[#1F2D3E] border border-[#D2E0EE] dark:border-[#2D3F54]">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[#52657A] dark:text-[#A5B6C8] font-medium text-2xs sm:text-xs">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{date}</span>
            </span>
            {time && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  {new Date(`2000-01-01T${time.slice(0, 5)}:00`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-none">{location || 'Muntinlupa City'}</span>
            </span>
          </div>

          <div className="hidden sm:block font-display text-sm font-black text-[#2C7A55] dark:text-[#7DD3A3] tabular-nums">
            ₱{Number(price || 0).toLocaleString()}
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
              className="col-span-1 sm:col-span-1 neu-btn justify-center px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-primary dark:text-[#8CBDF0] border-emerald-500/30 dark:border-emerald-400/30 flex items-center gap-1.5 cursor-pointer active:scale-[0.98] transition-transform order-1"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Track Live</span>
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
                  : 'neu-btn text-primary dark:text-[#8CBDF0]'
              }`}
            >
              <FileUp className={`w-3.5 h-3.5 shrink-0 ${presessionSubmitted ? 'text-[#2C7A55] dark:text-[#7DD3A3]' : 'text-primary dark:text-[#8CBDF0]'}`} />
              <span className="truncate">{presessionSubmitted ? 'Submitted' : 'Pre-Session Info'}</span>
            </button>
          )}

          {/* Manage Request (Cancel/Reschedule) */}
          {['Pending', 'Accepted'].includes(status) && (
            <button
              type="button"
              onClick={() => onManageRequest({ id, providerId, patientId, providerName: provider, date, time, originalNotes })}
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
                  ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400 cursor-default opacity-90' 
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
    const localRated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
    const presession = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
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

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Active' ? isReqActive(r) : r.status === filter);
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        r.provider?.toLowerCase().includes(term) ||
        r.service?.toLowerCase().includes(term) ||
        r.location?.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [requests, filter, searchTerm, isReqActive]);

  // Reset to first page when filtering or searching
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

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
    const pending = requests.filter(r => r.status === 'Pending').length;
    const active = requests.filter(isReqActive).length;
    const completed = requests.filter(r => r.status === 'Completed').length;
    return { pending, active, completed, total: requests.length };
  }, [requests, isReqActive]);

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="patient">
      <div className="flex-1 flex flex-col justify-between space-y-4 sm:space-y-6 relative w-full max-w-full">
        
        {/* Unified Neumorphic Header Card with Integrated Search & Filter Dropdown */}
        <section className="neu-flat p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.25rem] space-y-4 sm:space-y-5 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="font-display font-extrabold tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
                My Service Requests
              </h1>
              <p className="text-2xs sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 max-w-xl">
                Track, reschedule, and manage all your healthcare appointments in one place.
              </p>
            </div>

            {/* Quick Summary Clickable Filter Pills */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setFilter(filter === 'Pending' ? 'All' : 'Pending')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
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
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'Active'
                    ? 'neu-pressed text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 bg-emerald-500/15'
                    : 'neu-btn text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                }`}
                title="Filter Active / On Route requests"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>{stats.active} Active</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter(filter === 'Completed' ? 'All' : 'Completed')}
                className={`px-3 py-1.5 rounded-full text-3xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === 'Completed'
                    ? 'neu-pressed text-blue-600 dark:text-blue-400 border border-blue-500/40 bg-blue-500/15'
                    : 'neu-btn text-blue-600 dark:text-blue-400 hover:text-blue-700'
                }`}
                title="Filter Completed requests"
              >
                <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                <span>{stats.completed} Completed</span>
              </button>

              {filter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setFilter('All')}
                  className="neu-btn px-2.5 sm:px-3 py-1.5 rounded-full text-3xs font-extrabold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1"
                  title="Clear filter and show all"
                >
                  <X className="w-3 h-3" />
                  <span>Show All</span>
                </button>
              )}
            </div>
          </div>

          {/* Integrated Search Bar + Side Dropdown Button */}
          <div className="flex items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
            {/* Sunken Search Box */}
            <div className="relative flex-1 min-w-0">
              <div className="neu-inset p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 h-[44px] sm:h-[52px] border border-slate-200/50 dark:border-white/5">
                <Search className="w-4 h-4 text-primary ml-1.5 sm:ml-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search provider, service..."
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

            {/* Dropdown Filter Button beside searchbox */}
            <div className="relative shrink-0 z-50" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu(prev => !prev)}
                className={`neu-btn h-[44px] sm:h-[52px] px-3 sm:px-4 rounded-xl sm:rounded-2xl flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer relative outline-none select-none ${
                  showFilterMenu ? 'text-primary' : 'text-slate-600 dark:text-slate-300 hover:text-primary'
                }`}
                title={`Filter by: ${filter === 'All' ? 'All Requests' : filter}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">
                  {filter === 'All' ? 'All Requests' : filter}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
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
                      <span className="text-3xs font-extrabold uppercase tracking-wider text-slate-400">Filter Status</span>
                      <span className="text-3xs text-primary font-bold">{filter}</span>
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
                                ? 'neu-flat-sm text-primary font-bold shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <span>{f === 'All' ? 'All Requests' : f}</span>
                            {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                price={req.price}
                location={req.location}
                originalNotes={req.originalNotes}
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
            <span className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
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
                      <span key={`ellipsis-${idx}`} className="w-5 sm:w-6 text-center text-xs text-slate-400 select-none">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'neu-btn-primary shadow-sm text-white'
                          : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-primary'
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
          const presession = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
          setPresessionSubmitted(presession);
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
