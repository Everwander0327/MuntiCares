import { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, AlertTriangle, ArrowRight, ShieldCheck, CalendarClock, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { WORKING_HOURS, getServiceDurationMinutes } from '@/config/constants';
import { slotsOverlap, toLocalDateKey, formatSlotLabel, parseLocalDate } from '@/lib/localDate';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';

const WORKING_HOURS_START = WORKING_HOURS.START;
const WORKING_HOURS_END = WORKING_HOURS.END;

const CANCEL_REASONS = [
  'Schedule conflict',
  'Found another provider',
  'Emergency / health issue',
  'Transportation issue',
  'Not feeling ready',
  'Changed my mind',
  'Other',
];

const normalizeHHMM = (timeStr) => {
  const trimmed = String(timeStr || '').trim();
  if (!trimmed) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return trimmed.slice(0, 5);
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
};

const getProviderInitials = (name) => {
  const parts = String(name || 'MuntiCares').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const formatSlotParts = (timeStr, durationMinutes = 30) => {
  const hhmm = normalizeHHMM(timeStr) || '09:00';
  const [hStr, mStr] = hhmm.split(':');
  const m = Number(hStr) * 60 + Number(mStr);
  const startH = Math.floor(m / 60);
  const startMin = m % 60;
  const startPeriod = startH >= 12 ? 'PM' : 'AM';
  const displayStartH = startH % 12 === 0 ? 12 : startH % 12;
  const startLabel = `${displayStartH}:${String(startMin).padStart(2, '0')} ${startPeriod}`;

  const endM = m + durationMinutes;
  const endH = Math.floor(endM / 60);
  const endMin = endM % 60;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
  const endLabel = `to ${displayEndH}:${String(endMin).padStart(2, '0')} ${endPeriod}`;

  return { startLabel, endLabel };
};

const getReadableDateInfo = (dateStr) => {
  const parsed = parseLocalDate(dateStr);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return {
      monthShort: '--',
      dayNum: '--',
      weekdayShort: '',
      fullLabel: String(dateStr || 'Scheduled Date'),
    };
  }
  return {
    monthShort: parsed.toLocaleDateString('en-US', { month: 'short' }),
    dayNum: parsed.getDate(),
    weekdayShort: parsed.toLocaleDateString('en-US', { weekday: 'short' }),
    fullLabel: parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
  };
};

const CancelRescheduleModal = ({ isOpen, onClose, request, onActionComplete }) => {
  const [mode, setMode] = useState('choose'); // 'choose' | 'cancel' | 'reschedule'
  const [navDir, setNavDir] = useState('right');
  const [slotPeriod, setSlotPeriod] = useState('am');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const dateOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    const currentHour = now.getHours();

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const key = toLocalDateKey(d);
      const isToday = i === 0;
      const isTomorrow = i === 1;

      if (isToday && currentHour >= WORKING_HOURS_END) {
        continue;
      }

      const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = d.getDate();
      const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const label = isToday
        ? `Today (${monthShort} ${dayNum})`
        : isTomorrow
          ? `Tomorrow (${fullDate})`
          : fullDate;

      list.push({
        key,
        label,
        isToday,
        isTomorrow,
        dayShort: isToday ? 'Today' : isTomorrow ? 'Tmrw' : weekdayShort,
        weekdayShort,
        monthShort,
        dayNum,
        fullDate,
      });
    }
    return list;
  }, []);

  const currentHHMM = useMemo(() => normalizeHHMM(request?.time), [request?.time]);

  const morningSlots = useMemo(
    () => availableSlots.filter((s) => Number(String(s.time || '').split(':')[0]) < 12),
    [availableSlots]
  );

  const afternoonSlots = useMemo(
    () => availableSlots.filter((s) => Number(String(s.time || '').split(':')[0]) >= 12),
    [availableSlots]
  );

  useEffect(() => {
    if (availableSlots.length === 0) return;
    const isSwitchable = (s) =>
      s.available && !(newDate === request?.date && s.time === currentHHMM);
    const amOpen = morningSlots.some(isSwitchable);
    const pmOpen = afternoonSlots.some(isSwitchable);
    if (!amOpen && pmOpen) {
      setSlotPeriod('pm');
    } else {
      setSlotPeriod('am');
    }
  }, [availableSlots, morningSlots, afternoonSlots, newDate, request?.date, currentHHMM]);

  useEffect(() => {
    if (!isOpen) {
      setNavDir('right');
      setSlotPeriod('am');
      setShowCustomDatePicker(false);
    }
  }, [isOpen]);

  // Compute request duration in minutes (from request or fallback from service name)
  const reqDuration = useMemo(() => {
    return request?.durationMinutes ?? request?.duration_minutes ?? getServiceDurationMinutes(request?.service);
  }, [request?.durationMinutes, request?.duration_minutes, request?.service]);

  useEffect(() => {
    if (mode !== 'reschedule' || !newDate || !request?.providerId) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;

    const fetchAvailableSlots = async () => {
      setLoadingSlots(true);
      try {
        const { data: existingBookings } = await supabase
          .from('requests')
          .select('id, time, duration_minutes')
          .neq('id', request.id)
          .eq('provider_id', request.providerId)
          .eq('date', newDate)
          .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

        if (cancelled) return;

        const todayStr = toLocalDateKey();
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const slots = [];
        const intervalMinutes = 30;
        const startMinutes = WORKING_HOURS_START * 60;
        const endMinutes = WORKING_HOURS_END * 60;

        for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
          // A candidate start time must allow all contiguous slots before clinic close
          if (m + reqDuration > endMinutes) continue;

          const h = Math.floor(m / 60);
          const min = m % 60;
          const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

          const isPast = newDate < todayStr || (newDate === todayStr && m <= currentTotalMinutes);

          // Check if contiguous window [time, time + reqDuration) overlaps any active booking
          const isBooked = (existingBookings || []).some(b =>
            slotsOverlap(newDate, time, newDate, b.time, reqDuration, b.duration_minutes || 30)
          );

          const label = formatSlotLabel(time, reqDuration);

          slots.push({
            time,
            label,
            available: !isBooked && !isPast,
            isPast,
            isBooked
          });
        }

        if (cancelled) return;
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error fetching slots for reschedule:', err);
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
    return () => { cancelled = true; };
  }, [mode, newDate, request?.id, request?.providerId, reqDuration]);

  const resetAndClose = () => {
    setMode('choose');
    setNavDir('right');
    setSlotPeriod('am');
    setShowCustomDatePicker(false);
    setCancelReason('');
    setSelectedReason('');
    setNewDate('');
    setNewTime('');
    setAvailableSlots([]);
    onClose();
  };

  const { drawerMotionProps, dragHandleProps } = useBottomDrawerDrag({
    onClose: resetAndClose,
    disabled: submitting,
  });

  const enterRescheduleMode = () => {
    setNavDir('right');
    setShowCustomDatePicker(false);
    const todayKey = toLocalDateKey();
    const initialDate =
      newDate ||
      (request?.date &&
      (dateOptions.some((d) => d.key === request.date) || request.date > todayKey)
        ? request.date
        : dateOptions[0]?.key || todayKey);
    setNewDate(initialDate);
    setNewTime('');
    setMode('reschedule');
  };

  const enterCancelMode = () => {
    setNavDir('right');
    setShowCustomDatePicker(false);
    setMode('cancel');
  };

  const goBackToChoose = () => {
    setNavDir('left');
    setShowCustomDatePicker(false);
    setMode('choose');
  };

  const formatRescheduleDateLabel = (dateStr) => {
    if (!dateStr) return 'Select a date';
    const match = dateOptions.find((d) => d.key === dateStr);
    if (match) return match.label;
    return getReadableDateInfo(dateStr).fullLabel;
  };

  const handleCancel = async () => {
    setSubmitting(true);
    const reason = cancelReason || selectedReason || 'No reason provided';

    try {
      // A provider already on the way or on site cannot be cancelled from here;
      // that has to be agreed with them.
      const { data: updated, error } = await supabase
        .from('requests')
        .update({
          status: 'Cancelled',
          notes: request.originalNotes
            ? `${request.originalNotes}\n[Cancelled by patient] ${reason}`
            : `[Cancelled by patient] ${reason}`,
        })
        .eq('id', request.id)
        .in('status', ['Pending', 'Accepted'])
        .select('id');

      if (error) throw error;
      if (!updated?.length) {
        toast.error('This visit is already underway, so it cannot be cancelled here.');
        return;
      }

      toast.success('Request has been cancelled.');
      onActionComplete?.();
      resetAndClose();
    } catch (err) {
      console.error('Error cancelling request:', err);
      toast.error('Failed to update server. The request may still be active.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      toast.error('Please select both a new date and time.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: sameDay } = await supabase
        .from('requests')
        .select('id, time, duration_minutes')
        .neq('id', request.id)
        .eq('provider_id', request.providerId)
        .eq('date', newDate)
        .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

      if ((sameDay || []).some(r => slotsOverlap(newDate, newTime, newDate, r.time, reqDuration, r.duration_minutes || 30))) {
        toast.error('This time slot has just been taken. Please choose another.');
        setSubmitting(false);
        return;
      }

      const { data: moved, error } = await supabase
        .from('requests')
        .update({
          date: newDate,
          time: newTime + ':00',
          duration_minutes: reqDuration,
          notes: request.originalNotes
            ? `${request.originalNotes} [Rescheduled by patient]`
            : '[Rescheduled by patient]'
        })
        .eq('id', request.id)
        .in('status', ['Pending', 'Accepted'])
        .select('id');

      if (error) {
        if (error.code === '23P01' || error.code === '23505') {
          toast.error('This time slot has just been taken. Please choose another.');
          return;
        }
        throw error;
      }

      if (!moved?.length) {
        toast.error('This visit is already underway, so it cannot be rescheduled here.');
        return;
      }

      toast.success('Appointment rescheduled successfully!');
      onActionComplete?.();
      resetAndClose();
    } catch (err) {
      console.error('Error rescheduling request:', err);
      if (err.code === '23P01' || err.code === '23505') {
        toast.error('This time slot has just been taken. Please choose another.');
      } else {
        toast.error('Reschedule failed on the server. The original schedule remains.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!request) return null;

  const currentDateInfo = getReadableDateInfo(request.date);
  const currentTimeWindow = formatSlotLabel(currentHHMM || request.time, reqDuration);
  const visibleDateChips = dateOptions.slice(0, 5);
  const isCustomDateSelected = Boolean(newDate) && !visibleDateChips.some((d) => d.key === newDate);
  const customDateObj = isCustomDateSelected ? parseLocalDate(newDate) : null;
  const isSameAsCurrent = Boolean(newDate && newTime) && newDate === request.date && newTime === currentHHMM;
  const selectedNewSlotParts = newTime && !isSameAsCurrent ? formatSlotParts(newTime, reqDuration) : null;

  const slideOffset = prefersReducedMotion ? 0 : navDir === 'left' ? -20 : 20;
  const isSwitchableSlot = (slot) =>
    slot.available && !(newDate === request.date && slot.time === currentHHMM);
  const switchableSlots = availableSlots.filter(isSwitchableSlot);
  const amOpenCount = morningSlots.filter(isSwitchableSlot).length;
  const pmOpenCount = afternoonSlots.filter(isSwitchableSlot).length;
  const otherPeriod = slotPeriod === 'am' ? 'pm' : 'am';
  const otherOpenCount = slotPeriod === 'am' ? pmOpenCount : amOpenCount;

  const modalTitle =
    mode === 'choose'
      ? 'Manage Appointment'
      : mode === 'reschedule'
        ? 'Pick New Time'
        : 'Cancel Appointment';

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) resetAndClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          asChild
          aria-modal="true"
          onInteractOutside={(event) => {
            if (submitting) event.preventDefault();
          }}
        >
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => {
              if (!submitting) resetAndClose();
            }}
          >
            <motion.div
              className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-lg flex flex-col relative max-h-[92dvh] overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 42, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              {...drawerMotionProps}
            >
              {/* Sticky Sheet Header */}
              <div
                className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-3.5 border-b border-slate-200/75 dark:border-white/10 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                {...dragHandleProps}
              >
                <div
                  className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                  aria-hidden="true"
                />

                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`neu-flat-sm w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black shrink-0 aspect-square border ${
                      mode === 'cancel'
                        ? 'text-danger dark:text-red-400 border-danger/25 dark:border-red-400/20 bg-danger/5 dark:bg-red-500/10'
                        : 'text-link dark:text-primary-400 border-white/80 dark:border-white/10'
                    }`}
                  >
                    {mode === 'cancel' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <span className="text-xs sm:text-sm font-black">
                        {getProviderInitials(request.providerName)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <DialogPrimitive.Title asChild>
                      <h2 className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                        {modalTitle}
                      </h2>
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="sr-only">
                      Reschedule or cancel your {request.service} appointment with {request.providerName}.
                    </DialogPrimitive.Description>
                    <p className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                      <span className="font-extrabold text-link dark:text-primary-400">
                        {request.providerName}
                      </span>
                      {' '}&bull; {request.service} ({reqDuration} min)
                    </p>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {mode === 'choose' && (
                  <motion.div
                    key="choose"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -slideOffset }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                      {/* Current Schedule Card */}
                      <div className="neu-inset rounded-2xl p-4 space-y-3 border border-white/60 dark:border-white/5">
                        <div className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-tertiary dark:text-tertiary">
                          <CalendarClock className="w-3.5 h-3.5 text-link dark:text-primary-400 shrink-0" />
                          <span>Current Schedule</span>
                        </div>

                        <div className="flex items-center gap-3.5">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary-400/15 border border-primary/20 dark:border-primary-400/25 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-link dark:text-primary-400 leading-none">
                              {currentDateInfo.monthShort}
                            </span>
                            <span className="text-xl font-black text-slate-900 dark:text-white leading-none mt-1 tabular-nums">
                              {currentDateInfo.dayNum}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug truncate">
                              {currentDateInfo.fullLabel}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
                              <Clock className="w-3.5 h-3.5 text-tertiary shrink-0" />
                              <span className="truncate">
                                {currentTimeWindow} ({reqDuration} mins)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/10 flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Provider isn&apos;t en route yet &mdash; adjust or cancel anytime.</span>
                        </div>
                      </div>

                      {/* Safe Separation Before Destructive Action */}
                      <div className="flex justify-center pt-0.5">
                        <button
                          type="button"
                          onClick={enterCancelMode}
                          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-danger dark:hover:text-red-400 hover:bg-danger/5 dark:hover:bg-red-500/10 transition-colors cursor-pointer active:scale-[0.98]"
                        >
                          Need to cancel this appointment?
                        </button>
                      </div>
                    </div>

                    {/* Sticky Thumb-Zone Footer */}
                    <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md space-y-2">
                      <button
                        type="button"
                        onClick={enterRescheduleMode}
                        className="w-full neu-btn-primary min-h-[48px] py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        <span>Pick New Time</span>
                        <ArrowRight className="w-4 h-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={resetAndClose}
                        className="w-full neu-btn min-h-[44px] py-3 px-4 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        Keep Current Schedule
                      </button>
                    </div>
                  </motion.div>
                )}

                {mode === 'reschedule' && (
                  <motion.form
                    key="reschedule"
                    onSubmit={handleReschedule}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -slideOffset }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-3.5">
                      {/* Compact Current Booking Reminder */}
                      <div className="neu-flat-sm rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 border border-white/75 dark:border-white/10 text-xs">
                        <span className="text-tertiary font-semibold truncate">
                          Current:{' '}
                          <strong className="text-slate-800 dark:text-slate-100">
                            {currentDateInfo.fullLabel}
                          </strong>
                        </span>
                        <span className="text-link dark:text-primary-400 font-extrabold shrink-0 tabular-nums">
                          {currentTimeWindow}
                        </span>
                      </div>

                      {/* Horizontal 5-Day Date Strip + Animated Period Switch + Slots */}
                      <div className="neu-inset rounded-2xl p-3.5 space-y-3 border border-white/60 dark:border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block leading-none">
                              New Day &amp; Arrival Window
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 block truncate">
                              {formatRescheduleDateLabel(newDate)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {newDate && !loadingSlots && availableSlots.length > 0 && (() => {
                              const allPast = availableSlots.every((s) => s.isPast);
                              if (switchableSlots.length > 0) {
                                return (
                                  <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
                                    {switchableSlots.length} open
                                  </span>
                                );
                              }
                              if (allPast) {
                                return (
                                  <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Clinic closed
                                  </span>
                                );
                              }
                              return (
                                <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                  Fully booked
                                </span>
                              );
                            })()}

                            <button
                              type="button"
                              onClick={() => setShowCustomDatePicker((prev) => !prev)}
                              className="neu-btn px-2.5 py-1.5 rounded-lg text-2xs font-extrabold text-link dark:text-primary-400 cursor-pointer active:scale-95 transition-transform"
                            >
                              {showCustomDatePicker ? 'Hide calendar' : 'More dates'}
                            </button>
                          </div>
                        </div>

                        {/* Horizontal Date Chips */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5" role="listbox" aria-label="Reschedule dates">
                          {visibleDateChips.map((opt) => {
                            const isActive = newDate === opt.key;
                            return (
                              <button
                                key={opt.key}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                onClick={() => {
                                  if (newDate !== opt.key) {
                                    setNewDate(opt.key);
                                    setNewTime('');
                                  }
                                }}
                                className={`min-w-[66px] min-h-[54px] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 transition-all active:scale-[0.96] select-none outline-none ${
                                  isActive
                                    ? 'bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20'
                                    : 'neu-flat-sm text-slate-800 dark:text-slate-100 border border-white/70 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40'
                                }`}
                              >
                                <span className={`block text-2xs font-bold uppercase ${isActive ? 'opacity-90' : 'text-tertiary'}`}>
                                  {opt.dayShort}
                                </span>
                                <span className="block text-xs sm:text-sm font-extrabold leading-tight mt-0.5 tabular-nums">
                                  {opt.monthShort} {opt.dayNum}
                                </span>
                              </button>
                            );
                          })}

                          {isCustomDateSelected && customDateObj && (
                            <button
                              type="button"
                              role="option"
                              aria-selected={true}
                              onClick={() => setShowCustomDatePicker(true)}
                              className="min-w-[70px] min-h-[54px] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20 select-none"
                            >
                              <span className="block text-2xs font-bold uppercase opacity-90">
                                {customDateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                              <span className="block text-xs sm:text-sm font-extrabold leading-tight mt-0.5 tabular-nums">
                                {customDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Expandable Custom Date Input */}
                        <AnimatePresence initial={false}>
                          {showCustomDatePicker && (
                            <motion.div
                              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="neu-flat-sm rounded-xl px-3 py-2 flex items-center justify-between gap-2 border border-white/70 dark:border-white/5">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                  Jump to date:
                                </span>
                                <input
                                  type="date"
                                  min={toLocalDateKey()}
                                  value={newDate}
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    setNewDate(e.target.value);
                                    setNewTime('');
                                  }}
                                  className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white outline-none cursor-pointer"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Slots State & Animated Period Switcher */}
                        {!newDate ? (
                          <div className="p-3 text-center text-xs text-tertiary">
                            Select a date above to view available slots.
                          </div>
                        ) : loadingSlots ? (
                          <div className="space-y-2 py-1" aria-live="polite">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {[0, 1, 2, 3, 4, 5].map((idx) => (
                                <div
                                  key={idx}
                                  className="h-12 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 animate-pulse"
                                />
                              ))}
                            </div>
                            <p className="text-center text-xs font-semibold text-link dark:text-primary-400">
                              Checking provider availability...
                            </p>
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="p-3 text-center text-xs text-tertiary">
                            No available slots for this date.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {switchableSlots.length === 0 && (
                              <div className="p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium">
                                {availableSlots.every((s) => s.isPast)
                                  ? 'Clinic working hours for today have ended (9:00 AM – 5:00 PM). Please pick tomorrow or an upcoming date.'
                                  : 'No other time slots are open for this date. Please choose another day.'}
                              </div>
                            )}

                            {/* Animated Sliding 50/50 Period Switch */}
                            <div className="relative neu-flat-sm p-1 rounded-xl grid grid-cols-2 border border-white/70 dark:border-white/5">
                              <motion.div
                                aria-hidden="true"
                                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-primary dark:bg-primary-400 shadow-sm"
                                initial={false}
                                animate={{ x: slotPeriod === 'am' ? '0%' : '100%' }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                              />
                              <button
                                type="button"
                                onClick={() => setSlotPeriod('am')}
                                className={`relative z-10 py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none ${
                                  slotPeriod === 'am'
                                    ? 'text-white dark:text-[#08182A]'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                }`}
                              >
                                Morning ({amOpenCount} open)
                              </button>
                              <button
                                type="button"
                                onClick={() => setSlotPeriod('pm')}
                                className={`relative z-10 py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none ${
                                  slotPeriod === 'pm'
                                    ? 'text-white dark:text-[#08182A]'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                }`}
                              >
                                Afternoon ({pmOpenCount} open)
                              </button>
                            </div>

                            {(() => {
                              const periodList = slotPeriod === 'am' ? morningSlots : afternoonSlots;
                              const periodOpenCount = periodList.filter(isSwitchableSlot).length;

                              if (periodList.length === 0) {
                                return (
                                  <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-dashed border-slate-300/80 dark:border-white/10 text-center space-y-2">
                                    <p className="text-xs text-tertiary">
                                      No {slotPeriod === 'am' ? 'morning' : 'afternoon'} slots for this service duration.
                                    </p>
                                    {otherOpenCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setSlotPeriod(otherPeriod)}
                                        className="px-3 py-1.5 rounded-lg bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                                      >
                                        Switch to {otherOpenCount} {otherPeriod === 'am' ? 'Morning' : 'Afternoon'} slots &rarr;
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <motion.div
                                  key={`${newDate}-${slotPeriod}`}
                                  initial={prefersReducedMotion ? false : { opacity: 0.45, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                                  className="space-y-2"
                                >
                                  {periodOpenCount === 0 && otherOpenCount > 0 && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary/10 dark:bg-primary-400/10 border border-primary/20 dark:border-primary-400/20">
                                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {slotPeriod === 'am' ? 'Morning' : 'Afternoon'} slots are full.
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSlotPeriod(otherPeriod)}
                                        className="text-xs font-extrabold text-link dark:text-primary-400 cursor-pointer shrink-0 hover:underline"
                                      >
                                        View {otherOpenCount} {otherPeriod === 'am' ? 'AM' : 'PM'} open &rarr;
                                      </button>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {periodList.map((slot) => {
                                      const isCurrentSlot = newDate === request.date && slot.time === currentHHMM;
                                      const isSelected = newTime === slot.time && !isCurrentSlot;
                                      const isDisabled = !slot.available || isCurrentSlot;
                                      const { startLabel, endLabel } = formatSlotParts(slot.time, reqDuration);

                                      return (
                                        <button
                                          key={slot.time}
                                          type="button"
                                          disabled={isDisabled}
                                          onClick={() => setNewTime(slot.time)}
                                          className={`min-h-[48px] py-2.5 px-2 rounded-xl text-center transition-all outline-none select-none ${
                                            isCurrentSlot
                                              ? 'bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 border border-primary/35 dark:border-primary-400/35 cursor-not-allowed'
                                              : !slot.available
                                                ? 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-white/5 cursor-not-allowed'
                                                : isSelected
                                                  ? 'bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20 cursor-pointer ring-2 ring-primary/35 dark:ring-primary-400/45 active:scale-[0.97]'
                                                  : 'neu-flat-sm text-slate-800 dark:text-slate-100 border border-white/75 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40 cursor-pointer active:scale-[0.96]'
                                          }`}
                                        >
                                          <span className="text-xs font-extrabold block leading-tight tabular-nums">
                                            {startLabel}
                                          </span>
                                          <span
                                            className={`text-[11px] font-semibold block mt-0.5 leading-tight tabular-nums ${
                                              isCurrentSlot
                                                ? 'text-link dark:text-primary-400 font-bold'
                                                : !slot.available
                                                  ? 'text-slate-400 dark:text-slate-600'
                                                  : isSelected
                                                    ? 'opacity-90'
                                                    : 'text-tertiary'
                                            }`}
                                          >
                                            {isCurrentSlot ? 'Current slot' : endLabel}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Live Moving-To Preview Pill */}
                      {selectedNewSlotParts && (
                        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Check className="w-4 h-4 shrink-0" />
                          <span className="truncate tabular-nums">
                            Moving to: {formatRescheduleDateLabel(newDate)}, {selectedNewSlotParts.startLabel} ({reqDuration} mins)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sticky Reschedule Footer */}
                    <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                      <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[116px_1fr] gap-2.5">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={goBackToChoose}
                          className="w-full neu-btn min-h-[46px] py-3 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !newDate || !newTime || isSameAsCurrent}
                          className="w-full neu-btn-primary min-h-[46px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>
                            {submitting
                              ? 'Saving...'
                              : selectedNewSlotParts
                                ? `Confirm ${selectedNewSlotParts.startLabel}`
                                : 'Pick a Time'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}

                {mode === 'cancel' && (
                  <motion.div
                    key="cancel"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -slideOffset }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 min-h-0 flex flex-col"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
                      {/* Gentle Reschedule Pivot */}
                      <div className="rounded-2xl px-3.5 py-3 bg-primary/5 dark:bg-primary-400/10 border border-primary/20 dark:border-primary-400/20 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                            Need a different time instead?
                          </p>
                          <p className="text-[11px] font-medium text-tertiary dark:text-tertiary mt-0.5">
                            Pick another arrival window without cancelling.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={enterRescheduleMode}
                          className="neu-btn shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold text-link dark:text-primary-400 inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                        >
                          <span>Switch time</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Tactile Cancel Reasons Grid */}
                      <div className="space-y-2.5">
                        <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary dark:text-tertiary block">
                          Reason for cancelling
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          {CANCEL_REASONS.map((reason) => {
                            const isSelected = selectedReason === reason;
                            return (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => {
                                  setSelectedReason(reason);
                                  if (reason !== 'Other') setCancelReason('');
                                }}
                                className={`min-h-[44px] px-3 py-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between gap-2 cursor-pointer active:scale-[0.98] ${
                                  reason === 'Other' ? 'col-span-2' : ''
                                } ${
                                  isSelected
                                    ? 'bg-danger/10 dark:bg-red-500/15 border border-danger/55 dark:border-red-400/55 text-danger dark:text-red-300 font-extrabold ring-1 ring-danger/25'
                                    : 'neu-flat-sm text-slate-700 dark:text-slate-200 border border-white/75 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 font-semibold'
                                }`}
                              >
                                <span className="leading-snug">{reason}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        <AnimatePresence initial={false}>
                          {selectedReason === 'Other' && (
                            <motion.div
                              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden pt-1"
                            >
                              <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Please specify your reason..."
                                rows={2}
                                className="w-full p-3 rounded-xl neu-inset border border-white/60 dark:border-white/10 text-xs text-slate-800 dark:text-slate-100 placeholder:text-tertiary outline-none focus:ring-2 focus:ring-danger/30"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Sticky Cancel Footer */}
                    <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                      <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[124px_1fr] gap-2.5">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={goBackToChoose}
                          className="w-full neu-btn min-h-[46px] py-3 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          Keep Visit
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={submitting || (!selectedReason && !cancelReason)}
                          className="w-full min-h-[46px] py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold bg-danger text-white shadow-md shadow-danger/25 hover:brightness-105 flex items-center justify-center cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default CancelRescheduleModal;
