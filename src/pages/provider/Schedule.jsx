import DashboardLayout from '../../layouts/DashboardLayout';

const ProviderSchedule = () => {
  const schedule = [
    { patient: 'Maria Santos', service: 'Home Nursing', date: 'Jan 15, 2026', time: '09:00 AM' },
    { patient: 'Pedro Gonzales', service: 'Physical Therapy', date: 'Jan 15, 2026', time: '02:00 PM' },
    { patient: 'Juana Torres', service: 'Senior Care', date: 'Jan 16, 2026', time: '10:00 AM' },
    { patient: 'Jose Garcia', service: 'Child Care', date: 'Jan 17, 2026', time: '08:00 AM' },
  ];

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patient</th>
                <th className="px-6 py-4 font-semibold">Service</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((s, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-700">{s.patient}</td>
                  <td className="px-6 py-4 text-slate-600">{s.service}</td>
                  <td className="px-6 py-4 text-slate-600">{s.date}</td>
                  <td className="px-6 py-4 text-slate-600">{s.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderSchedule;
