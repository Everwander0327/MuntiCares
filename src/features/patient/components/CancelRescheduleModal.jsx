import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button
} from '@/shared/ui';
import { WORKING_HOURS, getServiceDurationMinutes } from '@/config/constants';
import { slotsOverlap, toLocalDateKey, formatSlotLabel } from '@/lib/localDate';

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

const CancelRescheduleModal = ({ isOpen, onClose, request, onActionComplete }) => {
  const [mode, setMode] = useState('choose'); // 'choose' | 'cancel' | 'reschedule'
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Compute request duration in minutes (from request or fallback from service name)
  const reqDuration = useMemo(() => {
    return request?.duration_minutes || getServiceDurationMinutes(request?.service);
  }, [request?.duration_minutes, request?.service]);

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
    setCancelReason('');
    setSelectedReason('');
    setNewDate('');
    setNewTime('');
    setAvailableSlots([]);
    onClose();
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent className="max-w-md w-full p-6 bg-surface dark:bg-surface-dark border-border dark:border-border-dark rounded-3xl shadow-2xl">
        {mode === 'choose' && (
          <div className="space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Manage Appointment</DialogTitle>
                  <p className="text-xs text-tertiary dark:text-tertiary">
                    {request.providerName} &bull; {request.service} ({reqDuration} min)
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-tertiary dark:text-tertiary">Current Date:</span>
                <span className="font-semibold">{request.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tertiary dark:text-tertiary">Current Time:</span>
                <span className="font-semibold">{request.time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-tertiary dark:text-tertiary">Duration:</span>
                <span className="font-semibold text-link">{reqDuration} minutes</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('reschedule')}
                className="p-4 rounded-2xl border-2 border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 flex flex-col items-center gap-2 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Pick New Time</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('cancel')}
                className="p-4 rounded-2xl border-2 border-danger/20 hover:border-danger bg-danger/5 hover:bg-danger/10 flex flex-col items-center gap-2 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-danger text-white flex items-center justify-center shadow-md shadow-danger/20 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold">Cancel Visit</span>
              </button>
            </div>

            <Button variant="secondary" className="w-full" onClick={resetAndClose}>
              Keep Current Schedule
            </Button>
          </div>
        )}

        {mode === 'cancel' && (
          <div className="space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-danger/10 flex items-center justify-center text-danger">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Cancel Appointment</DialogTitle>
                  <DialogDescription>Please tell us why you need to cancel this visit</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-tertiary dark:text-tertiary">
                Reason for cancellation
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {CANCEL_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => { setSelectedReason(reason); setCancelReason(''); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      selectedReason === reason
                        ? 'bg-danger/10 border-danger text-danger font-semibold'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {selectedReason === 'Other' && (
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please specify your reason..."
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-danger/30 outline-none"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setMode('choose')}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={submitting || (!selectedReason && !cancelReason)}
              >
                {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'reschedule' && (
          <form onSubmit={handleReschedule} className="space-y-6">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-link">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Reschedule Visit</DialogTitle>
                  <DialogDescription>
                    {reqDuration > 30 ? `Select a ${reqDuration}-min contiguous time block` : 'Pick a new date and time for this visit'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-tertiary dark:text-tertiary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> New Date
                </label>
                <input
                  type="date"
                  min={toLocalDateKey()}
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    setNewTime('');
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-tertiary dark:text-tertiary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> New Time Slot {reqDuration > 30 ? `(${reqDuration} min block)` : ''}
                  </label>
                  {reqDuration > 30 && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-link">
                      {reqDuration / 30} slots
                    </span>
                  )}
                </div>

                {!newDate ? (
                  <p className="text-sm text-tertiary dark:text-tertiary ml-1">Select a date to see available slots.</p>
                ) : loadingSlots ? (
                  <p className="text-sm text-tertiary dark:text-tertiary ml-1">Checking availability...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-tertiary dark:text-tertiary ml-1">No available slots for this date.</p>
                ) : (
                  <div className={`grid gap-2 max-h-56 overflow-y-auto pr-0.5 ${reqDuration > 30 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {availableSlots.map(slot => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setNewTime(slot.time)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 text-center ${
                          newTime === slot.time
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                            : slot.available
                              ? 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-primary hover:text-link cursor-pointer'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-slate-700/50 cursor-not-allowed'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" type="button" onClick={() => setMode('choose')}>
                Go Back
              </Button>
              <Button type="submit" disabled={submitting || !newTime}>
                {submitting ? 'Saving...' : 'Confirm Reschedule'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CancelRescheduleModal;
