import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ChevronLeft, ChevronRight, MapPin, Clock, Navigation, Home, CheckCircle2, Loader2, User, CalendarDays, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import PatientRecordModal from '../../components/PatientRecordModal';
import toast from 'react-hot-toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_FLOW = {
  Accepted: { next: 'On The Way', icon: <Navigation className="w-4 h-4" />, label: 'On The Way', color: 'bg-blue-500 hover:bg-blue-600 shadow-blue-200' },
  'On The Way': { next: 'Arrived', icon: <Home className="w-4 h-4" />, label: 'Mark Arrived', color: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' },
  Arrived: { next: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Complete Visit', color: 'bg-green-500 hover:bg-green-600 shadow-green-200' },
};

const STATUS_BADGE = {
  Accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'On The Way': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Arrived: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];

const ProviderSchedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [updatingId, setUpdatingId] = useState(null);

  // Modal state
  const [modalPatient, setModalPatient] = useState(null);

  useEffect(() => {
    let channel;

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, status, notes, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .in('status', ['Accepted', 'On The Way', 'Arrived', 'Completed']);

        if (error) throw error;

        // Fetch addresses from patients table separately
        const patientIds = (data || []).map(r => r.patient_id);
        const { data: patientProfiles } = await supabase
          .from('patients')
          .select('user_id, address')
          .in('user_id', patientIds);

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
            service: r.service,
            date: r.date,
            time: r.time,
            timeLabel: timeStr,
            status: r.status,
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

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isSameDay = (d1Str, d2) => {
    const d1 = new Date(d1Str + 'T00:00:00');
    return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const getAppointmentsForDay = (day) => {
    const target = new Date(year, month, day);
    return appointments.filter(a => isSameDay(a.date, target));
  };

  const selectedDayLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedAppts = appointments.filter(a => isSameDay(a.date, selectedDate)).sort((a, b) => a.time.localeCompare(b.time));

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
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));

      if (newStatus === 'Completed') {
        const appt = appointments.find(a => a.id === appointmentId);
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
  };

  if (loading) return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Schedule</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your home care visits and appointments</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={goToToday}
            className="self-start sm:self-auto bg-primary/10 text-primary font-bold text-sm px-4 py-2 rounded-xl hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" /> Today
          </motion.button>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          className="grid grid-cols-3 gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="bg-white rounded-2xl border border-slate-100 dark:border-slate-700 p-4 text-center shadow-sm dark:shadow-slate-900/50 dark:bg-slate-800">
            <p className="text-2xl font-bold text-primary">{todayAppts.length}</p>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Today</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 dark:border-slate-700 p-4 text-center shadow-sm dark:shadow-slate-900/50 dark:bg-slate-800">
            <p className="text-2xl font-bold text-amber-500">{activeVisits}</p>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Active</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 dark:border-slate-700 p-4 text-center shadow-sm dark:shadow-slate-900/50 dark:bg-slate-800">
            <p className="text-2xl font-bold text-green-500">{completedToday}</p>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Done</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Calendar */}
          <motion.div
            className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 p-4 sm:p-5 dark:bg-slate-800"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 dark:hover:bg-slate-700">
                <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{MONTHS[month]} {year}</h3>
              <button onClick={nextMonth} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 dark:hover:bg-slate-700">
                <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1.5">{d}</div>
              ))}
            </div>

            {/* Date Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {/* Empty cells for offset */}
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
                const count = dayAppts.length;

                return (
                  <motion.button
                    key={day}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`aspect-square rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xs sm:text-sm font-semibold transition-all relative
                      ${selected 
                        ? 'bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/30' 
                        : today 
                          ? 'bg-blue-50 text-primary ring-2 ring-primary/20 dark:bg-blue-900/30' 
                          : hasAppts 
                            ? 'text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}
                    `}
                  >
                    {day}
                    {hasAppts && (
                      <div className="flex gap-0.5 mt-0.5">
                        {count <= 3 ? (
                          dayAppts.slice(0, 3).map((_, idx) => (
                            <div key={idx} className={`w-1 h-1 rounded-full ${selected ? 'bg-white/80' : 'bg-primary'}`} />
                          ))
                        ) : (
                          <span className={`text-[8px] font-bold leading-none ${selected ? 'text-white/80' : 'text-primary'}`}>{count}</span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Has Visits</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-200 ring-1.5 ring-primary/30" /> Today</span>
            </div>
          </motion.div>

          {/* Appointments for Selected Day */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{selectedDayLabel}</h3>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${selectedAppts.length > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400 dark:text-slate-500'}`}>
                {selectedAppts.length} visit{selectedAppts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {selectedAppts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-slate-900">
                  <Stethoscope className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-bold">No Appointments</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 px-4">You have no scheduled visits for this day.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {selectedAppts.map((appt, idx) => {
                    const statusAction = STATUS_FLOW[appt.status];
                    const isUpdating = updatingId === appt.id;
                    const currentStep = STATUS_STEPS.indexOf(appt.status);

                    return (
                      <motion.div
                        key={appt.id}
                        layout
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden hover:shadow-md transition-shadow dark:bg-slate-800"
                      >
                        {/* Mini Progress Bar */}
                        <div className="h-1 bg-slate-100 flex dark:bg-slate-700">
                          {STATUS_STEPS.map((step, i) => (
                            <div
                              key={step}
                              className={`flex-1 transition-all duration-500 ${
                                i <= currentStep
                                  ? i === currentStep && appt.status === 'Completed'
                                    ? 'bg-green-400'
                                    : i === currentStep && appt.status === 'Arrived'
                                      ? 'bg-purple-400'
                                      : i === currentStep && appt.status === 'On The Way'
                                        ? 'bg-amber-400'
                                        : 'bg-blue-400'
                                  : ''
                              }`}
                            />
                          ))}
                        </div>

                        <div className="p-4 sm:p-5">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 dark:border-blue-900/50">
                                {appt.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">{appt.patient}</h4>
                                <p className="text-xs text-primary font-semibold">{appt.service}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[appt.status] || 'bg-slate-100 text-slate-500 dark:text-slate-400 dark:bg-slate-700'}`}>
                              {appt.status}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="font-medium">{appt.timeLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span className="truncate font-medium">{appt.address}</span>
                            </div>
                          </div>

                          {appt.notes && (
                            <div className="mb-4 p-3 bg-amber-50/60 border border-amber-100 rounded-xl dark:bg-amber-900/30 dark:border-amber-900/50">
                              <p className="text-xs text-amber-800 italic leading-relaxed dark:text-amber-200">"{appt.notes}"</p>
                            </div>
                          )}

                          {/* Status Stepper (Mini) */}
                          <div className="flex items-center gap-1 mb-4">
                            {STATUS_STEPS.map((step, i) => (
                              <React.Fragment key={step}>
                                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold transition-all ${
                                  i < currentStep ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                                  : i === currentStep ? 'bg-primary text-white shadow-md shadow-primary/30' 
: 'bg-slate-100 text-slate-400 dark:text-slate-500 dark:bg-slate-700'
                                }`}>
                                  {i < currentStep ? '✓' : i + 1}
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div className={`flex-1 h-0.5 rounded-full transition-all ${i < currentStep ? 'bg-green-200 dark:bg-green-900/50' : 'bg-slate-100 dark:bg-slate-700'}`} />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                          <div className="flex items-center justify-between mb-4">
                            {STATUS_STEPS.map((step, i) => (
                              <span key={step} className={`text-[8px] sm:text-[9px] font-bold ${i <= currentStep ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
                                {step === 'On The Way' ? 'En Route' : step}
                              </span>
                            ))}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {statusAction ? (
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                disabled={isUpdating}
                                onClick={() => handleStatusUpdate(appt.id, statusAction.next)}
                                className={`flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 text-sm ${statusAction.color}`}
                              >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : statusAction.icon}
                                {statusAction.label}
                              </motion.button>
                            ) : (
                              <motion.button
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setModalPatient({ id: appt.patientId, name: appt.patient })}
                                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all text-sm dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              >
                                <User className="w-4 h-4" /> View Record
                              </motion.button>
                            )}
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
