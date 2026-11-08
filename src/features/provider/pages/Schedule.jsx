import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SkeletonPage } from '@/shared/ui';
import PatientRecordModal from '../components/PatientRecordModal';
import ArrivalOverrideDialog from '@/features/tracking/components/ArrivalOverrideDialog';
import {
  markVisitArrived,
  formatArrivalFailure,
  canOverrideArrival,
  ARRIVAL_OVERRIDE_REASON,
} from '@/features/tracking/services/trackingService';
import toast from 'react-hot-toast';
import { formatSlotLabel, slotMinutes, toLocalDateKey, parseLocalDate } from '@/lib/localDate';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_FLOW = {
  Accepted: { next: 'On The Way', label: 'On The Way', color: 'neu-btn-primary text-white' },
  'On The Way': { next: 'Arrived', label: 'Mark Arrived', color: 'neu-btn bg-amber-500 text-white hover:bg-amber-600' },
  Arrived: { next: 'Completed', label: 'Complete Visit', color: 'neu-btn bg-emerald-600 text-white hover:bg-emerald-700' },
};

const STATUS_BADGE = {
  Accepted: 'neu-flat-sm text-link dark:text-primary-300 border border-blue-500/20',
  'On The Way': 'neu-flat-sm text-warning dark:text-warning-dark border border-amber-500/20',
  Arrived: 'neu-flat-sm text-link dark:text-primary-400 border border-primary-400/20',
  Completed: 'neu-flat-sm text-success dark:text-success-dark border border-emerald-500/20',
};

const STATUS_BORDER = {
  Accepted: 'border-l-4 border-l-blue-500',
  'On The Way': 'border-l-4 border-l-amber-500',
  Arrived: 'border-l-4 border-l-cyan-500',
  Completed: 'border-l-4 border-l-emerald-500',
};

const STATUS_STEPS = [
  { key: 'Accepted', label: 'Accepted' },
  { key: 'On The Way', label: 'On Route' },
  { key: 'Arrived', label: 'Arrived' },
  { key: 'Completed', label: 'Completed' },
];

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18; // 6:00 PM

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  return toLocalDateKey(d1) === toLocalDateKey(d2);
};

const getApptHour = (timeStr) => {
  const m = slotMinutes(timeStr);
  if (m === null) return null;
  return Math.floor(m / 60);
};

const formatHourLabel = (h) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, '0')}:00 ${period}`;
};

const ProviderSchedule = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [updatingId, setUpdatingId] = useState(null);
  const [arrivalOverride, setArrivalOverride] = useState(null);

  // Modal state
  const [modalPatient, setModalPatient] = useState(null);

  // Collapsible cards state: Completed visits start collapsed ("para hindi messy"),
  // active visits (Accepted, On The Way, Arrived) start expanded.
  const [expandedAppts, setExpandedAppts] = useState({});

  const isApptExpanded = (id, status) => {
    if (expandedAppts[id] !== undefined) {
      return expandedAppts[id];
    }
    return status !== 'Completed';
  };

  const toggleApptExpand = (id, status) => {
    setExpandedAppts(prev => {
      const current = prev[id] !== undefined ? prev[id] : status !== 'Completed';
      return { ...prev, [id]: !current };
    });
  };

  // Live wall-clock time for the "NOW" indicator
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let channel;

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, duration_minutes, status, notes, patient:patient_id(full_name, avatar_url)')
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
            timeStr = formatSlotLabel(r.time, r.duration_minutes || 30);
          } catch {
            timeStr = r.time;
          }

          return {
            id: r.id,
            patientId: r.patient_id,
            patient: r.patient?.full_name || 'Unknown',
            avatarUrl: r.patient?.avatar_url || '',
            service: r.service,
            date: r.date,
            time: r.time,
            timeLabel: timeStr,
            durationMinutes: r.duration_minutes || 30,
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
            filter: `provider_id=eq.${user.id}`,
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

  // Compute 7 days of the selected week (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const d = selectedDate instanceof Date ? new Date(selectedDate) : parseLocalDate(selectedDate);
    if (!d || isNaN(d.getTime())) return [];
    const dayOfWeek = d.getDay(); // 0 is Sunday
    const start = new Date(d);
    start.setDate(d.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // Appointments for currently selected day
  const selectedAppts = useMemo(() => {
    return appointments
      .filter(a => isSameDay(a.date, selectedDate))
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [appointments, selectedDate]);

  // Compute operating hours range for the visual time stream
  const operatingHours = useMemo(() => {
    let start = DEFAULT_START_HOUR;
    let end = DEFAULT_END_HOUR;

    selectedAppts.forEach(a => {
      const h = getApptHour(a.time);
      if (h !== null) {
        if (h < start) start = Math.max(0, h - 1);
        if (h > end) end = Math.min(23, h + 1);
      }
    });

    const hours = [];
    for (let h = start; h <= end; h++) {
      hours.push(h);
    }
    return hours;
  }, [selectedAppts]);

  const completedCount = useMemo(() => {
    return selectedAppts.filter(a => a.status === 'Completed').length;
  }, [selectedAppts]);

  // Navigation handlers
  const prevWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 7);
      return d;
    });
  };

  const nextWeek = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 7);
      return d;
    });
  };

  const prevDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() - 1);
      return d;
    });
  };

  const nextDay = () => {
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(prev.getDate() + 1);
      return d;
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Status update
  const handleStatusUpdate = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    try {
      const appt = appointments.find(a => a.id === appointmentId);

      if (newStatus === 'Arrived') {
        const res = await markVisitArrived(appointmentId);
        if (!res?.ok) {
          if (canOverrideArrival(res)) {
            setArrivalOverride({ id: appointmentId, failure: res });
          } else {
            toast.error(formatArrivalFailure(res));
          }
          return;
        }
        setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: 'Arrived' } : a));
        toast.success('Status updated to "Arrived"');
        return;
      }

      const payload = { status: newStatus };
      const nowIso = new Date().toISOString();
      if (newStatus === 'On The Way') payload.route_started_at = nowIso;

      const { data: updated, error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', appointmentId)
        .eq('status', appt?.status ?? newStatus)
        .select('id');

      if (error) throw error;
      if (!updated?.length) {
        toast.error('This visit changed status somewhere else. Reopen it to continue.');
        return;
      }

      setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus } : a));

      if (newStatus === 'Completed') {
        if (appt) {
          toast.success('Visit completed! Opening patient record...');
          setTimeout(() => {
            setModalPatient({ id: appt.patientId, name: appt.patient, avatarUrl: appt.avatarUrl });
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

  const confirmArrivalOverride = async () => {
    if (!arrivalOverride) return;
    const { id } = arrivalOverride;
    setUpdatingId(id);
    try {
      const res = await markVisitArrived(id, null, ARRIVAL_OVERRIDE_REASON);
      setArrivalOverride(null);
      if (!res?.ok) {
        toast.error(formatArrivalFailure(res));
        return;
      }
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Arrived' } : a));
      toast.success('Arrived - override recorded.');
    } catch (err) {
      console.error(err);
      setArrivalOverride(null);
      toast.error(err?.message || 'Failed to mark arrived.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const isTodaySelected = isSameDay(currentTime, selectedDate);
  const selectedDayLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const monthName = MONTHS[selectedDate.getMonth()];
  const yearNumber = selectedDate.getFullYear();

  return (
    <DashboardLayout role="provider">
      <div className="w-full max-w-full space-y-4 sm:space-y-6 pb-12 px-0 sm:px-2">
        {/* Top Header Bar */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight truncate">
              Clinical Schedule
            </h1>
            <p className="text-tertiary text-xs sm:text-xs font-semibold mt-0.5 truncate">
              Continuous visual time stream - Patient home visits
            </p>
          </div>

          {/* Quick Date Actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <div className="relative">
              <input
                type="date"
                value={toLocalDateKey(selectedDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(parseLocalDate(e.target.value));
                  }
                }}
                className="neu-btn text-xs font-bold px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer border border-slate-200/50 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Jump to date"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={goToToday}
              className={`neu-btn text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm ${
                isTodaySelected ? 'text-link font-black neu-pressed' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <span>Today</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Week Ribbon and Day Selector */}
        <motion.div
          className="neu-flat rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 space-y-3 sm:space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          {/* Week Bar Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                {monthName} {yearNumber}
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={prevWeek}
                className="neu-btn w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-link transition-all cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextWeek}
                className="neu-btn w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-link transition-all cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-Day Horizontal Strip */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 overflow-x-auto pb-1 sm:pb-0">
            {weekDays.map(day => {
              const dayAppts = appointments.filter(a => isSameDay(a.date, day));
              const hasAppts = dayAppts.length > 0;
              const isSelected = isSameDay(day, selectedDate);
              const isDayToday = isSameDay(day, currentTime);

              return (
                <motion.button
                  key={toLocalDateKey(day)}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSelectedDate(day)}
                  className={`min-w-[46px] p-2 sm:p-3 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-primary text-white shadow-lg ring-2 ring-primary/40 font-black'
                      : isDayToday
                        ? 'neu-btn text-link ring-2 ring-primary/40 font-black'
                        : hasAppts
                          ? 'neu-btn text-slate-800 dark:text-slate-100 font-extrabold hover:border-primary/40'
                          : 'neu-flat-sm text-tertiary hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <span className={`text-3xs font-extrabold uppercase tracking-wider block ${
                    isSelected ? 'text-white/90' : isDayToday ? 'text-link' : 'text-tertiary'
                  }`}>
                    {DAYS[day.getDay()]}
                  </span>
                  <span className={`text-sm sm:text-lg font-black block mt-0.5 ${
                    isSelected ? 'text-white' : isDayToday ? 'text-link' : 'text-slate-800 dark:text-slate-100'
                  }`}>
                    {day.getDate()}
                  </span>

                  {/* Visit Tag */}
                  <div className="mt-1 sm:mt-1.5 min-h-[18px] flex items-center justify-center">
                    {hasAppts ? (
                      <span className={`text-3xs font-extrabold px-1.5 py-0.5 rounded-md inline-block ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-primary/15 text-link'
                      }`}>
                        {dayAppts.length} {dayAppts.length === 1 ? 'visit' : 'visits'}
                      </span>
                    ) : (
                      <span className="text-3xs text-tertiary font-bold opacity-40">-</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Day Overview and Stats Glance */}
        <motion.div
          className="neu-flat rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevDay}
              className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-link cursor-pointer shrink-0"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                  {selectedDayLabel}
                </h2>
              </div>
              <p className="text-xs text-tertiary font-semibold mt-0.5">
                {selectedAppts.length === 0
                  ? 'No patient visits scheduled for this date'
                  : `${selectedAppts.length} ${selectedAppts.length === 1 ? 'visit' : 'visits'} scheduled - ${completedCount} completed`}
              </p>
            </div>
            <button
              type="button"
              onClick={nextDay}
              className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-link cursor-pointer shrink-0"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Daily Visual Time Stream (Hourly Canvas 8:00 AM - 6:00 PM) */}
        <motion.div
          className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm tracking-tight uppercase">
                Daily Visual Time Stream
              </h3>
            </div>
            <span className="text-3xs text-tertiary font-mono">
              Operating Range: {formatHourLabel(operatingHours[0])} - {formatHourLabel(operatingHours[operatingHours.length - 1])}
            </span>
          </div>

          {/* Hourly Timeline Rail */}
          <div className="space-y-4 sm:space-y-5 pt-2">
            {operatingHours.map(hour => {
              const hourAppts = selectedAppts.filter(a => getApptHour(a.time) === hour);
              const hourLabel = formatHourLabel(hour);
              const isCurrentHour = isTodaySelected && currentTime.getHours() === hour;

              // Check if this empty slot sits between earlier and later scheduled appointments (Travel Gap)
              const hasEarlierAppt = selectedAppts.some(a => {
                const ah = getApptHour(a.time);
                return ah !== null && ah < hour;
              });
              const hasLaterAppt = selectedAppts.some(a => {
                const ah = getApptHour(a.time);
                return ah !== null && ah > hour;
              });
              const isTravelGap = hourAppts.length === 0 && hasEarlierAppt && hasLaterAppt;

              return (
                <div key={hour} className="relative group">
                  {/* Real-Time "NOW" Indicator Line */}
                  {isCurrentHour && (
                    <div className="flex items-center gap-2 mb-2 pl-16 sm:pl-24">
                      <span className="px-2 py-0.5 rounded-md bg-danger text-white text-3xs font-black uppercase tracking-wider shrink-0 shadow-sm">
                        NOW - {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <div className="flex-1 h-0.5 bg-danger/70" />
                    </div>
                  )}

                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Left Rail: Hourly Timestamp */}
                    <div className="w-16 sm:w-24 shrink-0 text-right pt-2.5">
                      <span className="font-mono text-xs sm:text-xs font-bold text-tertiary block">
                        {hourLabel}
                      </span>
                    </div>

                    {/* Right Rail: Time Slot Lane */}
                    <div className="flex-1 min-w-0 space-y-3 pb-3 border-b border-slate-200/40 dark:border-white/5">
                      {hourAppts.length > 0 ? (
                        hourAppts.map(appt => {
                          const statusAction = STATUS_FLOW[appt.status];
                          const isUpdating = updatingId === appt.id;
                          const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === appt.status);
                          const isExpanded = isApptExpanded(appt.id, appt.status);

                          return (
                            <motion.div
                              key={appt.id}
                              layout
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.25 }}
                              className={`neu-card rounded-2xl transition-all border border-slate-200/60 dark:border-white/5 shadow-md ${
                                isExpanded ? 'p-4 sm:p-5 space-y-4' : 'p-3 sm:p-4'
                              } ${
                                STATUS_BORDER[appt.status] || 'border-l-4 border-l-primary'
                              }`}
                            >
                              {/* Top Row: Patient Info, Time Slot and Status Badge (Clickable to Toggle) */}
                              <div
                                onClick={() => toggleApptExpand(appt.id, appt.status)}
                                className="flex items-center justify-between gap-3 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <Link
                                    to={`/provider/patients/${appt.patientId}/profile`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl neu-inset overflow-hidden flex items-center justify-center font-black text-link text-xs sm:text-sm shrink-0 p-0.5 border border-slate-200/50 dark:border-white/5 hover:ring-2 hover:ring-primary/40 transition-all"
                                    title="View Profile"
                                  >
                                    {appt.avatarUrl ? (
                                      <img
                                        src={appt.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover rounded-[10px]"
                                      />
                                    ) : (
                                      appt.patient
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')
                                        .substring(0, 2)
                                        .toUpperCase()
                                    )}
                                  </Link>
                                  <div className="min-w-0">
                                    <Link
                                      to={`/provider/patients/${appt.patientId}/profile`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="font-display font-black text-slate-800 dark:text-slate-100 group-hover:text-link transition-colors text-sm sm:text-base truncate block"
                                    >
                                      {appt.patient}
                                    </Link>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-link font-bold truncate">
                                        {appt.service}
                                      </span>
                                      <span className="text-xs text-tertiary font-medium">
                                        - {appt.timeLabel}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Status Badge and Chevron Toggle */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`text-2xs font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                                      STATUS_BADGE[appt.status] || 'neu-btn text-tertiary'
                                    }`}
                                  >
                                    {appt.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleApptExpand(appt.id, appt.status);
                                    }}
                                    className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
                                    title={isExpanded ? 'Collapse card' : 'Expand card'}
                                  >
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform duration-200 ${
                                        isExpanded ? 'rotate-180' : ''
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* Collapsible Content */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    key="collapsible-content"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="overflow-hidden space-y-4 pt-3 border-t border-slate-200/40 dark:border-white/5"
                                  >
                                    {/* Patient Address and Google Maps Navigation */}
                                    <div className="neu-inset p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                      <div className="text-slate-700 dark:text-slate-300 min-w-0 font-medium truncate">
                                        <span>{appt.address}</span>
                                      </div>
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="neu-btn px-2.5 py-1 rounded-lg text-link hover:text-link text-xs font-bold shrink-0 self-end sm:self-auto cursor-pointer"
                                      >
                                        <span>Open in Maps</span>
                                      </a>
                                    </div>

                                    {/* Patient Request Notes */}
                                    {appt.notes && (
                                      <div className="p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 space-y-1">
                                        <span className="text-3xs font-black uppercase tracking-wider text-amber-500 block">
                                          Patient Request Note
                                        </span>
                                        <p className="text-xs text-slate-700 dark:text-slate-200 italic font-medium leading-relaxed">
                                          "{appt.notes}"
                                        </p>
                                      </div>
                                    )}

                                    {/* Segmented Squircle Stepper */}
                                    <div className="space-y-1.5 pt-1">
                                      <span className="text-3xs font-extrabold text-tertiary uppercase tracking-wider">
                                        Visit Lifecycle Progress
                                      </span>
                                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                                        {STATUS_STEPS.map((step, idx) => {
                                          const isPast = idx < currentStepIdx;
                                          const isCurrent = idx === currentStepIdx;

                                          if (isPast) {
                                            return (
                                              <div
                                                key={step.key}
                                                className="p-2 rounded-xl neu-inset bg-emerald-500/15 border border-emerald-500/30 text-center"
                                              >
                                                <span className="text-2xs font-black text-emerald-500 block truncate">
                                                  {step.label}
                                                </span>
                                              </div>
                                            );
                                          }

                                          if (isCurrent) {
                                            return (
                                              <div
                                                key={step.key}
                                                className={`p-2 rounded-xl text-center shadow-md font-black ${
                                                  appt.status === 'Completed'
                                                    ? 'bg-emerald-600 text-white'
                                                    : appt.status === 'On The Way'
                                                      ? 'bg-amber-500 text-white'
                                                      : 'bg-primary text-white'
                                                }`}
                                              >
                                                <span className="text-2xs block truncate">
                                                  {step.label}
                                                </span>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              key={step.key}
                                              className="p-2 rounded-xl neu-btn text-center opacity-50"
                                            >
                                              <span className="text-2xs font-bold text-tertiary block truncate">
                                                {step.label}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Action Buttons Row */}
                                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                                      <motion.button
                                        whileTap={{ scale: 0.96 }}
                                        onClick={() =>
                                          setModalPatient({
                                            id: appt.patientId,
                                            name: appt.patient,
                                            avatarUrl: appt.avatarUrl,
                                          })
                                        }
                                        className="neu-btn px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                                      >
                                        <span>View Patient Record</span>
                                      </motion.button>

                                      {statusAction && (
                                        <motion.button
                                          whileTap={{ scale: 0.96 }}
                                          disabled={isUpdating}
                                          onClick={() => handleStatusUpdate(appt.id, statusAction.next)}
                                          className={`px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-white ${statusAction.color}`}
                                        >
                                          {isUpdating && (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          )}
                                          <span>{statusAction.label}</span>
                                        </motion.button>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          );
                        })
                      ) : isTravelGap ? (
                        /* Travel and Rest Window */
                        <div className="neu-flat-sm rounded-xl p-3 border border-dashed border-amber-500/30 dark:border-amber-500/20 bg-amber-500/5 flex items-center justify-between text-2xs text-amber-500/90">
                          <span className="font-semibold">
                            Travel and Rest Window - Open buffer between home visits
                          </span>
                          <span className="text-3xs uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15">
                            Buffer
                          </span>
                        </div>
                      ) : (
                        /* Open Clinical Slot */
                        <div className="neu-flat-sm rounded-xl p-2.5 sm:p-3 border border-dashed border-slate-200/50 dark:border-white/5 flex items-center justify-between text-2xs text-tertiary">
                          <span className="font-medium">
                            Available Clinical Slot - No visits scheduled
                          </span>
                          <span className="text-3xs uppercase tracking-wider font-extrabold opacity-50">
                            Available
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Patient Record Modal */}
      {modalPatient && (
        <PatientRecordModal
          isOpen={!!modalPatient}
          onClose={() => setModalPatient(null)}
          patientId={modalPatient.id}
          patientName={modalPatient.name}
          patientAvatar={modalPatient.avatarUrl}
        />
      )}

      {/* Arrival Override Geolocation Dialog */}
      <ArrivalOverrideDialog
        open={Boolean(arrivalOverride)}
        failure={arrivalOverride?.failure}
        busy={updatingId === arrivalOverride?.id}
        onCancel={() => setArrivalOverride(null)}
        onConfirm={confirmArrivalOverride}
      />
    </DashboardLayout>
  );
};

export default ProviderSchedule;
