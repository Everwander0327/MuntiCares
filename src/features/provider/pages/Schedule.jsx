import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { ChevronLeft, ChevronRight, MapPin, Clock, Navigation, Home, CheckCircle2, Loader2, User, CalendarDays, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SkeletonPage } from '@/shared/ui';
import PatientRecordModal from '../components/PatientRecordModal';
import toast from 'react-hot-toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_FLOW = {
  Accepted: { next: 'On The Way', icon: <Navigation className="w-4 h-4" />, label: 'On The Way', color: 'neu-btn-primary text-white' },
  'On The Way': { next: 'Arrived', icon: <Home className="w-4 h-4" />, label: 'Mark Arrived', color: 'neu-btn bg-amber-500 text-white hover:bg-amber-600' },
  Arrived: { next: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Complete Visit', color: 'neu-btn bg-emerald-600 text-white hover:bg-emerald-700' },
};

const STATUS_BADGE = {
  Accepted: 'neu-flat-sm text-blue-600 dark:text-blue-400 border border-blue-500/20',
  'On The Way': 'neu-flat-sm text-amber-600 dark:text-amber-400 border border-amber-500/20',
  Arrived: 'neu-flat-sm text-purple-600 dark:text-purple-400 border border-purple-500/20',
  Completed: 'neu-flat-sm text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
};

const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];

const ProviderSchedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [updatingId, setUpdatingId] = useState(null);

  // Pagination for selected day appointments (Eliminates scroll traps)
  const [apptsPage, setApptsPage] = useState(1);
  const APPTS_PER_PAGE = 2;

  // Modal state
  const [modalPatient, setModalPatient] = useState(null);

  useEffect(() => {
    let channel;

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, status, price, notes, patient:patient_id(full_name, avatar_url)')
          .eq('provider_id', user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed']);

        if (error) throw error;

        // Fetch addresses from patients table separately
        const patientIds = (data || []).map(r => r.patient_id).filter(Boolean);
        let patientProfiles = [];
        if (patientIds.length > 0) {
          const { data: profiles } = await supabase
            .from('patients')
            .select('user_id, address')
            .in('user_id', patientIds);
          patientProfiles = profiles || [];
        }

        const formatted = (data || []).map(r => {
          const profile = patientProfiles?.find(p => p.user_id === r.patient_id);
          let timeStr = '';
          try {
            timeStr = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          } catch { timeStr = r.time; }

          return {
            id: r.id,
            patientId: r.patient_id,
            patient: r.patient?.full_name || 'Unknown',
            avatarUrl: r.patient?.avatar_url || '',
            service: r.service,
            date: r.date,
            time: r.time,
            timeLabel: timeStr,
            status: r.status,
            price: r.price,
            notes: r.notes || '',
            address: profile?.address || 'Address not provided',
          };
        });

        setAppointments(formatted);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load schedule.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchAppointments();

      channel = supabase
        .channel('provider-schedule-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
            filter: `provider_id=eq.${user.id}`
          },
          () => {
            fetchAppointments();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    setApptsPage(1);
  };
  const nextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    setApptsPage(1);
  };

  const isSameDay = (d1Str, d2) => {
    if (!d1Str || !d2) return false;
    const cleanStr = String(d1Str).split('T')[0];
    const d1 = new Date(cleanStr + 'T00:00:00');
    return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const getAppointmentsForDay = (day) => {
    const target = new Date(year, month, day);
    return appointments.filter(a => isSameDay(a.date, target));
  };

  const selectedDayLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedAppts = appointments.filter(a => isSameDay(a.date, selectedDate)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const maxPage = Math.max(1, Math.ceil(selectedAppts.length / APPTS_PER_PAGE));

  useEffect(() => {
    if (apptsPage > maxPage) {
      setApptsPage(maxPage);
    }
  }, [apptsPage, maxPage]);

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (day) => {
    return day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  // Stats
  const todayAppts = appointments.filter(a => {
    const today = new Date();
    return isSameDay(a.date, today);
  });
  const activeVisits = appointments.filter(a => a.status === 'On The Way' || a.status === 'Arrived').length;
  const completedToday = todayAppts.filter(a => a.status === 'Completed').length;

  // Status update
  const handleStatusUpdate = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    try {
      const appt = appointments.find(a => a.id === appointmentId);

      const payload = { status: newStatus };
      const nowIso = new Date().toISOString();
      if (newStatus === 'On The Way') payload.route_started_at = nowIso;
      if (newStatus === 'Arrived') payload.arrived_at = nowIso;

      const { error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));

      if (newStatus === 'Completed') {
        if (appt) {
          toast.success('Visit completed! Opening patient record...');
          setTimeout(() => {
            setModalPatient({ id: appt.patientId, name: appt.patient });
          }, 600);
        }
      } else {
        toast.success(`Status updated to "${newStatus}"`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setApptsPage(1);
  };

  if (loading) return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;

  return (
    <DashboardLayout role="provider">
      <div className="w-full max-w-full lg:max-w-6xl mx-auto space-y-3.5 sm:space-y-6 pb-12 px-0 sm:px-2">
        {/* Page Header */}
        <motion.div 
          className="flex flex-row items-center justify-between gap-2"
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">Clinical Schedule</h1>
            <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs font-semibold mt-0.5 truncate">Appointments & patient home visits</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={goToToday}
            className="neu-btn shrink-0 text-primary font-bold text-xs px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm"
          >
            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs">Today</span>
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3.5 sm:gap-6 items-start">
          {/* Calendar Panel (Compact, Non-Stretching, Sticky) */}
          <motion.div
            className="lg:col-span-2 neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 lg:sticky lg:top-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Calendar Month & Nav */}
            <div className="flex items-center justify-between mb-3.5 sm:mb-5">
              <button 
                onClick={prevMonth} 
                className="neu-btn p-2 rounded-xl transition-all cursor-pointer active:scale-95 text-slate-600 dark:text-slate-300"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                {MONTHS[month]} {year}
              </h3>
              <button 
                onClick={nextMonth} 
                className="neu-btn p-2 rounded-xl transition-all cursor-pointer active:scale-95 text-slate-600 dark:text-slate-300"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day Names Row */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-3xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Date Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Empty cells for initial day offset */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayAppts = getAppointmentsForDay(day);
                const hasAppts = dayAppts.length > 0;
                const today = isToday(day);
                const selected = isSelected(day);

                return (
                  <motion.button
                    key={day}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      setSelectedDate(new Date(year, month, day));
                      setApptsPage(1);
                    }}
                    className={`aspect-square rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer
                      ${selected 
                        ? 'neu-pressed text-primary font-black shadow-inner ring-1 ring-primary/40' 
                        : today 
                          ? 'neu-btn text-primary ring-2 ring-primary/40 font-black' 
                          : hasAppts 
                            ? 'neu-btn text-slate-800 dark:text-slate-100 font-extrabold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}
                    `}
                  >
                    <span>{day}</span>
                    {/* Clean Single Event Dot (No clutter even with 10+ visits) */}
                    {hasAppts && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 transition-transform ${selected ? 'bg-primary scale-110' : 'bg-primary'}`} />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3.5 border-t border-slate-200/50 dark:border-white/5 flex flex-wrap gap-4 text-3xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Has Visits</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full ring-2 ring-primary/40 bg-white" /> Today</span>
            </div>
          </motion.div>

          {/* Appointments Panel for Selected Day */}
          <motion.div
            className="lg:col-span-3 neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 flex flex-col min-h-[380px]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between gap-3 pb-3.5 sm:pb-4 mb-3.5 sm:mb-4 border-b border-slate-200/60 dark:border-white/5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight truncate">
                    {selectedDayLabel}
                  </h3>
                  <span className={`text-3xs font-extrabold px-2.5 py-0.5 rounded-lg neu-btn uppercase tracking-wider shrink-0 ${selectedAppts.length > 0 ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                    {selectedAppts.length}
                  </span>
                </div>
                <p className="text-3xs sm:text-xs text-slate-400 mt-0.5 truncate">
                  {selectedAppts.length > 0 
                    ? `Showing ${((apptsPage - 1) * APPTS_PER_PAGE) + 1}–${Math.min(apptsPage * APPTS_PER_PAGE, selectedAppts.length)} of ${selectedAppts.length} visits`
                    : 'No visits scheduled for this date'}
                </p>
              </div>

              {/* In-Card Pagination Controls (Only when visits exceed APPTS_PER_PAGE) */}
              {selectedAppts.length > APPTS_PER_PAGE && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setApptsPage(p => Math.max(1, p - 1))}
                    disabled={apptsPage === 1}
                    className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                    title="Previous visits"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-3xs font-extrabold text-slate-500 px-1 select-none">
                    {apptsPage} / {Math.ceil(selectedAppts.length / APPTS_PER_PAGE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApptsPage(p => Math.min(Math.ceil(selectedAppts.length / APPTS_PER_PAGE), p + 1))}
                    disabled={apptsPage >= Math.ceil(selectedAppts.length / APPTS_PER_PAGE)}
                    className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                    title="Next visits"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {selectedAppts.length === 0 ? (
              <div className="text-center py-12 sm:py-16 my-auto">
                <div className="w-14 h-14 neu-btn rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-400">
                  <Stethoscope className="w-6 h-6 text-primary" />
                </div>
                <p className="text-slate-800 dark:text-slate-200 font-extrabold text-sm sm:text-base">No Scheduled Visits</p>
                <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  You have no scheduled patient home visits recorded for this day.
                </p>
              </div>
            ) : (
              /* Paginated List (Zero scroll traps, natural mobile flow) */
              <div className="space-y-3 sm:space-y-4">
                <AnimatePresence mode="popLayout">
                  {selectedAppts
                    .slice((apptsPage - 1) * APPTS_PER_PAGE, apptsPage * APPTS_PER_PAGE)
                    .map((appt, idx) => {
                    const statusAction = STATUS_FLOW[appt.status];
                    const isUpdating = updatingId === appt.id;
                    const currentStep = STATUS_STEPS.indexOf(appt.status);

                    return (
                      <motion.div
                        key={appt.id}
                        layout
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.25 }}
                        className="neu-flat-sm rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200/40 dark:border-white/5"
                      >
                        {/* Progress Stepper Bar */}
                        <div className="h-1.5 neu-inset flex overflow-hidden">
                          {STATUS_STEPS.map((step, i) => (
                            <div
                              key={step}
                              className={`flex-1 transition-all duration-500 ${
                                i <= currentStep
                                  ? i === currentStep && appt.status === 'Completed'
                                    ? 'bg-emerald-500'
                                    : i === currentStep && appt.status === 'Arrived'
                                      ? 'bg-purple-500'
                                      : i === currentStep && appt.status === 'On The Way'
                                        ? 'bg-amber-500'
                                        : 'bg-primary'
                                  : 'opacity-0'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="p-3.5 sm:p-5">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2.5 mb-3">
                            <Link
                              to={`/provider/patients/${appt.patientId}/profile`}
                              className="flex items-center gap-2.5 sm:gap-3 min-w-0 group"
                            >
                              <div className="neu-flat-sm w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center text-primary font-black text-xs sm:text-sm shrink-0 p-0.5">
                                {appt.avatarUrl ? (
                                  <img src={appt.avatarUrl} alt="" className="w-full h-full object-cover rounded-[10px] sm:rounded-xl" />
                                ) : (
                                  appt.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-display font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors text-xs sm:text-sm md:text-base truncate">{appt.patient}</h4>
                                <p className="text-3xs sm:text-xs text-primary font-bold">{appt.service}</p>
                              </div>
                            </Link>
                            <span className={`text-3xs font-extrabold px-2.5 py-1 rounded-lg sm:rounded-xl uppercase tracking-wider shrink-0 ${STATUS_BADGE[appt.status] || 'neu-btn text-slate-500'}`}>
                              {appt.status}
                            </span>
                          </div>

                          {/* Time & Location Details */}
                          <div className="flex flex-wrap gap-x-3.5 gap-y-1 mb-3 text-3xs sm:text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>{appt.timeLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{appt.address}</span>
                            </div>
                          </div>

                          {/* Patient Request Notes */}
                          {appt.notes && (
                            <div className="mb-3 p-2.5 sm:p-3 neu-inset rounded-xl">
                              <p className="text-3xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Patient Note</p>
                              <p className="text-3xs sm:text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">{'\u201C'}{appt.notes}{'\u201D'}</p>
                            </div>
                          )}

                          {/* Status Stepper Indicator (Mobile-optimized) */}
                          <div className="neu-inset p-2.5 sm:p-3 rounded-xl sm:rounded-2xl mb-3">
                            <div className="flex items-center gap-1 mb-1">
                              {STATUS_STEPS.map((step, i) => (
                                <React.Fragment key={step}>
                                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-3xs font-bold transition-all ${
                                    i < currentStep 
                                      ? 'bg-emerald-500 text-white shadow-sm' 
                                      : i === currentStep 
                                        ? 'bg-primary text-white shadow-sm' 
                                        : 'neu-btn text-slate-400'
                                  }`}>
                                    {i < currentStep ? '✓' : i + 1}
                                  </div>
                                  {i < STATUS_STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 rounded-full transition-all ${i < currentStep ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                            <div className="flex items-center justify-between px-0.5">
                              {STATUS_STEPS.map((step, i) => (
                                <span key={step} className={`text-3xs font-extrabold uppercase tracking-wider ${i <= currentStep ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                  {step === 'On The Way' ? 'On Route' : step}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {statusAction && (
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                disabled={isUpdating}
                                onClick={() => handleStatusUpdate(appt.id, statusAction.next)}
                                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 text-white font-bold py-2 sm:py-2.5 rounded-xl transition-all disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-md ${statusAction.color}`}
                              >
                                {isUpdating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : statusAction.icon}
                                <span>{statusAction.label}</span>
                              </motion.button>
                            )}
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              onClick={() => setModalPatient({ id: appt.patientId, name: appt.patient })}
                              className="neu-btn flex-1 flex items-center justify-center gap-1.5 sm:gap-2 font-bold py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                              <span>{statusAction ? 'Patient Record' : 'View Patient Record'}</span>
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Patient Record Modal */}
      {modalPatient && (
        <PatientRecordModal
          isOpen={!!modalPatient}
          onClose={() => setModalPatient(null)}
          patientId={modalPatient.id}
          patientName={modalPatient.name}
        />
      )}
    </DashboardLayout>
  );
};

export default ProviderSchedule;
