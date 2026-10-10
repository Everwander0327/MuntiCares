import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { 
  MessageSquare, Search, CheckCircle, FileText, User, 
  ChevronLeft, ChevronRight, Sparkles, Filter, CheckCircle2,
  Calendar, Clock, ShieldCheck, MapPin, ExternalLink, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate, Link } from 'react-router-dom';
import PatientRecordModal from '../../components/PatientRecordModal';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const ITEMS_PER_PAGE = 6;

const ProviderPatients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Completed'
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

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

        const formatted = (data || []).map(r => ({
          requestId: r.id,
          patientId: r.patient_id,
          name: r.patient?.full_name || 'Unknown Patient',
          avatarUrl: r.patient?.avatar_url || '',
          service: r.service,
          date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawDate: r.date,
          time: r.time || '',
          notes: r.notes || '',
          status: r.status === 'Completed' ? 'Completed' : 'Active',
          rawStatus: r.status
        }));

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / ITEMS_PER_PAGE));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPatients, currentPage]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleMarkCompleted = async (requestId, patientName) => {
    if (!window.confirm(`Mark service for ${patientName} as completed?`)) return;
    
    setUpdatingId(requestId);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'Completed' })
        .eq('id', requestId);
      
      if (error) throw error;

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

  const handleOpenRecord = (patientId, patientName) => {
    setSelectedPatient({ id: patientId, name: patientName });
    setIsModalOpen(true);
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
      <div className="space-y-4 sm:space-y-6 pb-12">
        
        {/* HEADER & FILTER CARD */}
        <motion.div 
          className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-7 relative overflow-hidden"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-slate-900 dark:text-white">
                My Patients
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                Manage your active consultations, review medical charts, and access patient health records.
              </p>
            </div>

            {/* Quick Stat Counter Pills (Mobile horizontally scrollable without breaking) */}
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0 shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'Active' ? 'All' : 'Active')}
                className={`neu-btn px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-3xs sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                  statusFilter === 'Active' 
                    ? 'neu-pressed text-emerald-600 dark:text-emerald-400' 
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Filter Active consultations"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{stats.active} Active</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
                className={`neu-btn px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-3xs sm:text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 ${
                  statusFilter === 'Completed' 
                    ? 'neu-pressed text-blue-600 dark:text-blue-400' 
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                title="Filter Completed visits"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{stats.completed} Completed</span>
              </button>
              {statusFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('All')}
                  className="neu-btn px-2.5 sm:px-3 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl text-3xs sm:text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Clear filter and show all"
                >
                  <X className="w-3 h-3" />
                  <span>Show All</span>
                </button>
              )}
            </div>
          </div>

          {/* SEARCH BAR & PAGINATION CONTROLS (Side-by-side on Mobile & Desktop) */}
          <div className="mt-4 sm:mt-6 pt-3.5 sm:pt-5 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-2.5 sm:gap-4">
            {/* Search Input (Sunken Well with prominent Lucide Search icon) */}
            <div className="relative flex-1 min-w-0 max-w-md">
              <div className="neu-inset rounded-xl sm:rounded-2xl flex items-center px-2.5 sm:px-3 py-2 sm:py-2.5 gap-2 sm:gap-2.5 border border-slate-200/50 dark:border-white/5">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                <input
                  type="text"
                  placeholder="Search patient, service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none truncate"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 shrink-0"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Pagination Controls in Header (Tucked right beside the search box) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-3xs font-extrabold text-slate-500 px-0.5 sm:px-1 select-none whitespace-nowrap">
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
        </motion.div>

        {/* PATIENTS GRID */}
        {paginatedPatients.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5"
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
                    className="neu-flat rounded-2xl sm:rounded-[2rem] p-3.5 sm:p-6 flex flex-col justify-between space-y-3 sm:space-y-4 select-text transition-all"
                  >
                    {/* Top Bar: Avatar + Name + Service + Status Chip & Chat */}
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        <div className="neu-flat-sm w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center text-primary font-black text-xs sm:text-base shrink-0 p-0.5">
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="w-full h-full object-cover rounded-[10px] sm:rounded-xl" />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-xs sm:text-base truncate">
                            {p.name}
                          </h3>
                          <p className="text-3xs sm:text-xs font-semibold text-primary truncate mt-0.5">
                            {p.service}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Chat Button */}
                        <Link
                          to={`/provider/messages?partner=${p.patientId}&name=${encodeURIComponent(p.name)}`}
                          className="neu-btn p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-primary hover:text-primary-600 transition-all flex items-center justify-center cursor-pointer"
                          title="Chat with Patient"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Link>

                        {/* Status Chip (Neumorphic without dot) */}
                        <span
                          className={`neu-flat-sm text-3xs font-extrabold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl uppercase tracking-wider ${
                            p.status === 'Active'
                              ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>

                    {/* Meta Details: Visit Date & Time */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-3xs sm:text-xs text-slate-600 dark:text-slate-300">
                      <div className="neu-flat-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 font-semibold">
                        <Calendar className="w-3 h-3 text-primary" />
                        <span>{p.date}</span>
                      </div>
                      {p.time && (
                        <div className="neu-flat-sm px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl flex items-center gap-1.5 font-semibold">
                          <Clock className="w-3 h-3 text-primary" />
                          <span>{p.time}</span>
                        </div>
                      )}
                    </div>

                    {/* Doctor's Note (Sunken Inset Well with Fallback) */}
                    <div className="neu-inset p-2.5 sm:p-3 rounded-xl border border-slate-200/40 dark:border-white/5 space-y-1">
                      <p className="text-3xs font-extrabold uppercase tracking-wider text-primary">
                        Doctor's Note
                      </p>
                      {p.notes && p.notes.trim() ? (
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic line-clamp-3">
                          "{p.notes}"
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                          No clinical notes recorded for this patient yet.
                        </p>
                      )}
                    </div>

                    {/* Action Buttons: View Medical Chart, Profile, and Complete Visit */}
                    <div className="pt-2 border-t border-slate-200/40 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1">
                        {/* Medical Chart Modal Trigger */}
                        <button
                          type="button"
                          onClick={() => handleOpenRecord(p.patientId, p.name)}
                          className="neu-btn px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-3xs sm:text-xs font-bold text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                          title="Open Medical Record & Chart"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Medical Chart</span>
                        </button>

                        {/* Patient Profile Link */}
                        <button
                          type="button"
                          onClick={() => navigate(`/provider/patients/${p.patientId}/profile`)}
                          className="neu-btn px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-3xs sm:text-xs font-bold text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                          title="View Full Patient Profile"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </button>
                      </div>

                      {/* Complete Visit Button if Active */}
                      {p.rawStatus === 'Accepted' && (
                        <button
                          type="button"
                          disabled={updatingId === p.requestId}
                          onClick={() => handleMarkCompleted(p.requestId, p.name)}
                          className="neu-btn px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-3xs sm:text-xs font-bold text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                          title="Mark Consultation as Completed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
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
        />
      )}
    </DashboardLayout>
  );
};

export default ProviderPatients;
