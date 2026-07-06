import { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const appointments = [
  { id: 1, patient: 'Maria Santos', service: 'Home Nursing', date: '2026-01-15', time: '09:00 AM', status: 'Accepted', address: 'Brgy. Bayanan, Muntinlupa' },
  { id: 2, patient: 'Pedro Gonzales', service: 'Physical Therapy', date: '2026-01-15', time: '02:00 PM', status: 'On The Way', address: 'Brgy. Sucat, Muntinlupa' },
  { id: 3, patient: 'Juana Torres', service: 'Senior Care', date: '2026-01-16', time: '10:00 AM', status: 'Accepted', address: 'Brgy. Alabang, Muntinlupa' },
  { id: 4, patient: 'Jose Garcia', service: 'Child Care', date: '2026-01-17', time: '08:00 AM', status: 'Completed', address: 'Brgy. Putatan, Muntinlupa' },
  { id: 5, patient: 'Ana Cruz', service: 'Home Nursing', date: '2026-01-20', time: '11:00 AM', status: 'Accepted', address: 'Brgy. Tunasan, Muntinlupa' },
];

const statusColors = {
  'Accepted': 'bg-blue-100 text-blue-700',
  'On The Way': 'bg-amber-100 text-amber-700',
  'Arrived': 'bg-purple-100 text-purple-700',
  'Completed': 'bg-green-100 text-green-700',
};

const ProviderSchedule = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 15));
  const [selectedDate, setSelectedDate] = useState('2026-01-15');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const dayAppointments = appointments.filter(a => a.date === selectedDate);

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-xl"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <h2 className="text-lg font-bold text-slate-900">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-xl"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>

          <div className="grid grid-cols-7">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-slate-400 py-3 uppercase tracking-wider">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="p-3" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasAppt = appointments.some(a => a.date === dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === today;

              return (
                <button key={day} onClick={() => setSelectedDate(dateStr)}
                  className={`p-3 text-center border border-slate-50 transition-all relative ${
                    isSelected ? 'bg-primary text-white' : isToday ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-slate-700'}`}>{day}</span>
                  {hasAppt && <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${isSelected ? 'bg-white' : 'bg-primary'}`} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">
              Appointments for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
          </div>
          {dayAppointments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No appointments on this day.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {dayAppointments.map(a => (
                <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {a.patient.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{a.patient}</p>
                      <p className="text-sm text-slate-500">{a.service}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.time}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.address}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderSchedule;
