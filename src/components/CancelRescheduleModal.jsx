import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const SLOT_DURATION_MINUTES = 60;

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

  useEffect(() => {
    if (mode !== 'reschedule' || !newDate || !request?.providerId) {
      setAvailableSlots([]);
      return;
    }

    const fetchAvailableSlots = async () => {
      setLoadingSlots(true);
      try {
        const { data: existingBookings } = await supabase
          .from('requests')
          .select('time')
          .neq('id', request.id)
          .eq('provider_id', request.providerId)
          .eq('date', newDate)
          .in('status', ['Accepted', 'On The Way', 'Arrived']);

        const bookedTimes = (existingBookings || []).map(b => b.time);

        const slots = [];
        for (let hour = WORKING_HOURS_START; hour < WORKING_HOURS_END; hour++) {
          const time = `${String(hour).padStart(2, '0')}:00`;
          const isBooked = bookedTimes.some(bt => {
            const bh = parseInt(bt.split(':')[0]);
            const bm = parseInt(bt.split(':')[1]);
            const slotStart = hour;
            const slotEnd = hour + SLOT_DURATION_MINUTES / 60;
            const bookingTime = bh + bm / 60;
            return bookingTime >= slotStart && bookingTime < slotEnd;
          });
          slots.push({ time, available: !isBooked });
        }

        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error fetching slots for reschedule:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [mode, newDate, request?.id, request?.providerId]);

  if (!isOpen || !request) return null;

  const handleCancel = async () => {
    setSubmitting(true);
    const reason = cancelReason || selectedReason || 'No reason provided';

    // Optimistic: close modal and notify immediately
    const actionComplete = onActionComplete;
    const close = onClose;
    close();
    toast.success('Request has been cancelled.');
    if (actionComplete) actionComplete();

    // Background: update DB
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'Cancelled', notes: `[Cancelled by patient] ${reason}` })
        .eq('id', request.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error cancelling request:', err);
      toast.error('Failed to update server. The request may still be active.');
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      toast.error('Please select both a new date and time.');
      return;
    }

    setSubmitting(true);

    // Optimistic: close and notify immediately
    const actionComplete = onActionComplete;
    const close = onClose;
    close();
    toast.success('Appointment rescheduled successfully!');
    if (actionComplete) actionComplete();

    // Background: check conflicts + update DB
    try {
      const { data: conflict } = await supabase
        .from('requests')
        .select('id')
        .neq('id', request.id)
        .eq('provider_id', request.providerId)
        .eq('date', newDate)
        .in('status', ['Accepted', 'On The Way', 'Arrived'])
        .gte('time', newTime + ':00')
        .lt('time', `${String(parseInt(newTime.split(':')[0]) + 1).padStart(2, '0')}:00`);

      if (conflict && conflict.length > 0) {
        toast.error('That slot was taken. The reschedule may not have been saved.');
        setSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('requests')
        .update({ 
          date: newDate, 
          time: newTime + ':00',
          notes: request.originalNotes 
            ? `${request.originalNotes} [Rescheduled by patient]`
            : '[Rescheduled by patient]'
        })
        .eq('id', request.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error rescheduling request:', err);
      toast.error('Reschedule failed on the server. The original schedule remains.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setMode('choose');
    setCancelReason('');
    setNewDate('');
    setNewTime('');
    setAvailableSlots([]);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={resetAndClose}
      >
        <motion.div
          className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-md w-full border border-slate-100 dark:border-slate-700 shadow-2xl relative"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={resetAndClose}
            className="absolute right-6 top-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </button>

          {/* Choose Mode */}
          {mode === 'choose' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Manage Appointment</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  with <span className="font-bold text-primary">{request.providerName}</span> on {request.date}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setMode('reschedule')}
                  className="flex items-center gap-4 p-5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/20 border border-blue-100 rounded-2xl transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50 group-hover:shadow-md transition-shadow">
                    <CalendarClock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Reschedule</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Change the date or time of this visit</p>
                  </div>
                </button>

                <button
                  onClick={() => setMode('cancel')}
                  className="flex items-center gap-4 p-5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-100 rounded-2xl transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50 group-hover:shadow-md transition-shadow">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">Cancel Request</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Withdraw this appointment entirely</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step indicator for cancel/reschedule */}
          {mode !== 'choose' && (
            <div className="flex items-center gap-2 mb-6 px-1">
              <button onClick={() => setMode('choose')} className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
                <span className="text-xs font-semibold">Choose Action</span>
              </button>
              <div className="flex-1 h-0.5 rounded-full bg-green-200" />
              <div className="flex items-center gap-2 text-primary">
                <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {mode === 'cancel' ? '!' : '2'}
                </div>
                <span className="text-xs font-semibold">{mode === 'cancel' ? 'Confirm Cancel' : 'Pick New Time'}</span>
              </div>
            </div>
          )}

          {/* Cancel Confirmation */}
          {mode === 'cancel' && (
            <div className="space-y-6">
              <div className="text-center">
                <span className="text-3xl">⚠️</span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">Cancel Appointment?</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This action cannot be undone.</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Reason for cancelling</label>
                <div className="flex flex-wrap gap-2">
                  {CANCEL_REASONS.map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => {
                        setSelectedReason(reason);
                        setCancelReason(reason === 'Other' ? '' : reason);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        selectedReason === reason
                          ? 'bg-red-500 text-white border-red-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-red-300 hover:text-red-600'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                {selectedReason === 'Other' && (
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Let the provider know why you're cancelling..."
                    rows={2}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-3 outline-none focus:ring-2 focus:ring-red-100 transition-all text-sm resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('choose')}
                  className="w-full py-3 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-sm"
                >
                  Go Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 dark:shadow-red-900/50 text-sm"
                >
                  {submitting ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* Reschedule Form */}
          {mode === 'reschedule' && (
            <form onSubmit={handleReschedule} className="space-y-6">
              <div className="text-center">
                <span className="text-3xl">📅</span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">Reschedule Visit</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pick a new date and time for this visit</p>
              </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> New Date
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={newDate}
                      onChange={e => {
                        setNewDate(e.target.value);
                        setNewTime('');
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> New Time Slot
                    </label>
                    {!newDate ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 ml-1">Select a date to see available slots.</p>
                    ) : loadingSlots ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 ml-1">Checking availability...</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 ml-1">No available slots for this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => setNewTime(slot.time)}
                            className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all border ${
                              newTime === slot.time
                                  ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                  : slot.available
                                    ? 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-primary hover:text-primary'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-500 border-slate-100 dark:border-slate-700 cursor-not-allowed line-through'
                            }`}
                          >
                            {new Date(`2000-01-01T${slot.time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="w-full py-3 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-sm"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary/20 text-sm"
                >
                  {submitting ? 'Saving...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CancelRescheduleModal;
