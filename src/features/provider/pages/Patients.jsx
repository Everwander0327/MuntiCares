import { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { parseLocalDate } from '@/lib/localDate';
import { 
  MessageSquare, Search, FileText, 
  ChevronLeft, ChevronRight, ChevronDown, Filter,
  Calendar, Clock, X, Check, CheckCircle2, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import { Link } from 'react-router-dom';
import PatientRecordModal from '../components/PatientRecordModal';
import toast from 'react-hot-toast';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const ITEMS_PER_PAGE = 6;

// Clean rectangular clinical status badges (STRICT: NO pills, NO color dots, NO emojis)
const getStatusBadge = (status, rawStatus) => {
  const displayStatus = rawStatus || status;
  if (status === 'Completed' || displayStatus === 'Completed') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30">
        Completed
      </span>
    );
  }
  if (['Arrived', 'On The Way', 'Accepted', 'Active'].includes(displayStatus) || status === 'Active') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-link dark:text-primary-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30">
        {displayStatus}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-tertiary bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-white/10">
      {displayStatus}
    </span>
  );
};

const ProviderPatients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Completed'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    const fetchPatients = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, status, notes, patient:patient_id(full_name, avatar_url)')
          .eq('provider_id', user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed'])
          .order('date', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(r => {
          let timeLabel = '';
          try {
            if (r.time) {
              timeLabel = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            }
          } catch { timeLabel = r.time || ''; }

          return {
            requestId: r.id,
            patientId: r.patient_id,
            name: r.patient?.full_name || 'Unknown Patient',
            avatarUrl: r.patient?.avatar_url || '',
            service: r.service,
            date: parseLocalDate(r.date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Unscheduled',
            rawDate: r.date,
            time: timeLabel,
            notes: r.notes || '',
            status: (['On The Way', 'Arrived'].includes(r.status) || (r.status === 'Accepted' && (!r.date || r.date >= new Date().toLocaleDateString('en-CA')))) ? 'Active' : 'Completed',
            rawStatus: r.status
          };
        });

        setPatients(formatted);
      } catch (err) {
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [user]);

  // Statistics
  const stats = useMemo(() => {
    const active = patients.filter(p => p.status === 'Active').length;
    const completed = patients.filter(p => p.status === 'Completed').length;
    return { active, completed, total: patients.length };
  }, [patients]);

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

  // Filtering
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.service.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = 
        statusFilter === 'All' ? true : p.status === statusFilter;

      return matchesSearch && matchesFilter;
    });
  }, [patients, searchTerm, statusFilter]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / ITEMS_PER_PAGE));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPatients, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMarkCompleted = async (requestId, patientName) => {
    if (!window.confirm(`Mark service for ${patientName} as completed?`)) return;
    
    setUpdatingId(requestId);
    try {
      const { data: updated, error } = await supabase
        .from('requests')
        .update({ status: 'Completed' })
        .eq('id', requestId)
        .in('status', ['On The Way', 'Arrived'])
        .select('id');

      if (error) throw error;
      if (!updated?.length) {
        toast.error('This visit is not on the way or arrived, so it cannot be completed here.');
        return;
      }

      setPatients(prev => prev.map(p => 
        p.requestId === requestId ? { ...p, status: 'Completed', rawStatus: 'Completed' } : p
      ));
      toast.success(`Service for ${patientName} marked as completed!`);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to mark as completed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const recordTriggerRef = useRef(null);

  const handleOpenRecord = (patientId, patientName, avatarUrl = '', triggerEl = null) => {
    recordTriggerRef.current = triggerEl;
    setSelectedPatient({ id: patientId, name: patientName, avatarUrl });
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const currentFilterCount = 
    statusFilter === 'All' ? stats.total : statusFilter === 'Active' ? stats.active : stats.completed;

  return (
    <DashboardLayout role="provider">
      <div className="flex-1 flex flex-col space-y-4 sm:space-y-5 relative w-full max-w-full pb-10">
        
        {/* HEADER & INTEGRATED TOOLBAR (Option 1: Healthie EHR Patient Registry) */}
        <section className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-[2.25rem] space-y-3.5 sm:space-y-4">
          <div>
            <h1 className="font-display font-extrabold tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
              My Patients
            </h1>
            <p className="text-xs sm:text-sm text-tertiary mt-0.5 sm:mt-1 max-w-xl">
              Manage your active consultations, review medical charts, and access patient health records.
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
                  aria-label="Search patients"
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
                  title="Filter patients by status"
                >
                  <Filter className="w-3.5 h-3.5 text-link shrink-0" />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {statusFilter === 'All' ? 'All' : statusFilter} ({currentFilterCount})
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
                      className="neu-flat absolute right-0 top-full mt-2 w-48 rounded-2xl p-1.5 z-50 shadow-2xl border border-white/80 dark:border-white/10 bg-surface-shell"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-200/60 dark:border-white/5 mb-1 flex items-center justify-between">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                          Patient Status
                        </span>
                        <span className="text-xs text-link font-extrabold">
                          {statusFilter}
                        </span>
                      </div>

                      <div className="space-y-1" role="listbox">
                        {[
                          { value: 'All', label: 'All Patients', count: stats.total },
                          { value: 'Active', label: 'Active Consults', count: stats.active },
                          { value: 'Completed', label: 'Completed Visits', count: stats.completed },
                        ].map((opt) => {
                          const isSelected = statusFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setStatusFilter(opt.value);
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
                  onClick={() => setStatusFilter('All')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    statusFilter === 'All'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>All Patients</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    statusFilter === 'All' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    statusFilter === 'Active'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Active</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    statusFilter === 'Active' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.active}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('Completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    statusFilter === 'Completed'
                      ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                      : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Completed</span>
                  <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                    statusFilter === 'Completed' ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                  }`}>
                    {stats.completed}
                  </span>
                </button>
              </div>

              {/* Compact Integrated Search Box for Desktop */}
              <div className="relative w-72 shrink-0">
                <div className="neu-inset px-2.5 py-1.5 rounded-xl flex items-center gap-2 h-10 border border-slate-200/50 dark:border-white/5">
                  <Search className="w-3.5 h-3.5 text-link shrink-0" />
                  <input
                    type="text"
                    aria-label="Search patients"
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
              </div>
            </div>

          </div>
        </section>

        {/* PATIENTS GRID */}
        {paginatedPatients.length > 0 ? (
          <>
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <AnimatePresence mode="popLayout">
                {paginatedPatients.map((p) => {
                  const initials = p.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'P';

                  return (
                    <motion.div
                      key={p.requestId}
                      variants={staggerItem}
                      layout
                      className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3 select-text transition-all"
                    >
                      {/* Top Bar: Patient Avatar + Name + Clean Rectangular Status Tag (NO Pills, NO Dots) */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to={`/provider/patients/${p.patientId}/profile`}
                            className="flex items-center gap-2.5 sm:gap-3 min-w-0 group"
                          >
                            <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center text-link font-black text-xs sm:text-sm shrink-0 p-0.5">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-full h-full object-cover rounded-[10px] sm:rounded-xl" />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display font-extrabold text-slate-900 dark:text-white group-hover:text-link transition-colors text-xs sm:text-sm truncate">
                                {p.name}
                              </h3>
                              <p className="text-2xs sm:text-xs font-semibold text-link truncate mt-0.5">
                                {p.service}
                              </p>
                            </div>
                          </Link>

                          {/* Rectangular Status Badge */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getStatusBadge(p.status, p.rawStatus)}
                          </div>
                        </div>

                        {/* Middle Meta Details: Combined Clinical Schedule Strip */}
                        <div className="mt-3 py-2 px-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600 dark:text-slate-300 font-medium text-xs">
                            <span className="flex items-center gap-1.5 shrink-0">
                              <Calendar className="w-3.5 h-3.5 text-link shrink-0" />
                              <span>{p.date}</span>
                            </span>
                            {p.time && (
                              <>
                                <span className="text-tertiary">&bull;</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-link shrink-0" />
                                  <span>{p.time}</span>
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">
                            Home Visit
                          </span>
                        </div>

                        {/* Patient Booking Note: Clean Left Accent Line (No Sunken Well) */}
                        <div className="mt-2.5 pl-3 border-l-2 border-slate-300 dark:border-slate-700 py-0.5 space-y-0.5">
                          <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                            Patient Booking Note
                          </p>
                          {p.notes && p.notes.trim() ? (
                            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed italic line-clamp-3">
                              &ldquo;{p.notes}&rdquo;
                            </p>
                          ) : (
                            <p className="text-xs text-tertiary italic">
                              No additional booking notes provided by patient.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Action Bar */}
                      <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                        {/* Medical Chart Trigger */}
                        <button
                          type="button"
                          onClick={(event) => handleOpenRecord(p.patientId, p.name, p.avatarUrl, event.currentTarget)}
                          className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-link hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="Open Medical Record & Chart"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Medical Chart</span>
                        </button>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          {/* Chat Patient Button */}
                          <Link
                            to={`/provider/messages?partner=${p.patientId}&name=${encodeURIComponent(p.name)}`}
                            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1.5 shrink-0"
                            title="Chat with Patient"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-link" />
                            <span>Chat</span>
                          </Link>

                          {/* Complete Visit Button if Active */}
                          {p.status === 'Active' && (
                            <button
                              type="button"
                              disabled={updatingId === p.requestId}
                              onClick={() => handleMarkCompleted(p.requestId, p.name)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                              title="Mark Consultation as Completed"
                            >
                              {updatingId === p.requestId ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Completing...</>
                              ) : (
                                <><CheckCircle2 className="w-3.5 h-3.5" /> <span>Complete</span></>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* BOTTOM PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="neu-flat p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3">
                <p className="text-2xs sm:text-xs font-semibold text-tertiary truncate">
                  Showing {paginatedPatients.length} of {filteredPatients.length} patients
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
              icon="users"
              title={searchTerm ? 'No matching patients found' : 'No patients in this list yet'}
              message={
                searchTerm
                  ? 'Try refining your search keyword or clearing filters.'
                  : 'Patients from accepted and completed service requests will appear here.'
              }
              action={
                searchTerm
                  ? { label: 'Clear Search', onClick: () => setSearchTerm('') }
                  : statusFilter !== 'All'
                  ? { label: 'Show All Patients', onClick: () => setStatusFilter('All') }
                  : null
              }
            />
          </div>
        )}
      </div>

      {/* Patient Medical Record & Chart Modal */}
      {selectedPatient && (
        <PatientRecordModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          patientAvatar={selectedPatient.avatarUrl}
          triggerRef={recordTriggerRef}
        />
      )}
    </DashboardLayout>
  );
};

export default ProviderPatients;
