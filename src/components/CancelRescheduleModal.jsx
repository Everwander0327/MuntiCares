import { useState } from 'react';
import { X, Calendar, Clock, AlertTriangle, CalendarClock, Info } from 'lucide-react';

const CANCEL_REASONS = [
  'Schedule conflict',
  'Found another provider',
  'Emergency / health issue',
  'Transportation issue',
  'Changed my mind',
  'Other',
];

const CancelRescheduleModal = ({ isOpen, onClose, request }) => {
  const isNewBooking = !request?.id;
  const [mode, setMode] = useState(isNewBooking ? 'schedule' : 'choose');
  const [selectedReason, setSelectedReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [comingSoon, setComingSoon] = useState('');

  if (!isOpen) return null;

  const title = isNewBooking ? 'Schedule Booking' : mode === 'choose' ? 'Manage Booking' : mode === 'cancel' ? 'Cancel Booking' : 'Schedule Booking';

  const handleComingSoon = (msg) => {
    setComingSoon(msg);
    setTimeout(() => { setComingSoon(''); onClose(); }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {comingSoon && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700 font-semibold">
              <Info className="w-4 h-4" /> {comingSoon}
            </div>
          )}

          {mode === 'choose' && (
            <>
              <p className="text-sm text-slate-600">
                What would you like to do with your booking with <span className="font-bold">{request?.provider || request?.patient || 'Provider'}</span>?
              </p>
              <button onClick={() => setMode('schedule')} className="w-full p-4 rounded-2xl border-2 border-blue-100 hover:border-primary hover:bg-blue-50 transition-all text-left flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-primary"><CalendarClock className="w-5 h-5" /></div>
                <div><p className="font-bold text-slate-900">Schedule</p><p className="text-sm text-slate-500">Pick a new date and time</p></div>
              </button>
              <button onClick={() => setMode('cancel')} className="w-full p-4 rounded-2xl border-2 border-red-100 hover:border-red-400 hover:bg-red-50 transition-all text-left flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-500"><AlertTriangle className="w-5 h-5" /></div>
                <div><p className="font-bold text-slate-900">Cancel</p><p className="text-sm text-slate-500">Cancel this booking</p></div>
              </button>
            </>
          )}

          {mode === 'cancel' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Please tell us why you're cancelling:</p>
              <div className="space-y-2">
                {CANCEL_REASONS.map(r => (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedReason === r ? 'border-red-400 bg-red-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <input type="radio" name="reason" value={r} checked={selectedReason === r} onChange={e => setSelectedReason(e.target.value)} className="accent-red-500" />
                    <span className="text-sm text-slate-700">{r}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setMode('choose')} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Back</button>
                <button onClick={() => handleComingSoon('Cancellation is coming soon.')} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600">Confirm Cancel</button>
              </div>
            </div>
          )}

          {(mode === 'schedule') && (
            <div className="space-y-4">
              {isNewBooking && (
                <div className="text-center p-4 bg-blue-50 rounded-2xl">
                  <p className="text-sm font-semibold text-slate-700">Booking with <span className="text-primary">{request?.name || request?.provider || request?.patient}</span></p>
                  <p className="text-xs text-slate-500">{request?.service}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2"><Calendar className="w-4 h-4" /> {isNewBooking ? 'Select Date' : 'New Date'}</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2"><Clock className="w-4 h-4" /> {isNewBooking ? 'Select Time' : 'New Time'}</label>
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-3 pt-2">
                {!isNewBooking && (
                  <button onClick={() => setMode('choose')} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Back</button>
                )}
                <button onClick={() => handleComingSoon(isNewBooking ? 'Booking is coming soon.' : 'Rescheduling is coming soon.')} className={`${isNewBooking ? 'w-full' : 'flex-1'} py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600`}>
                  {isNewBooking ? 'Confirm Booking' : 'Confirm Schedule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CancelRescheduleModal;
