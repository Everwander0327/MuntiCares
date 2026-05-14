import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Check, X, MapPin, Calendar, Clock } from 'lucide-react';

const ProviderRequests = () => {
  const [requests, setRequests] = React.useState([
    { id: 1, patient: 'Juan Dela Cruz', service: 'Wound Care Dressing', date: 'Oct 28, 2025', time: '10:00 AM', location: 'Putatan, Muntinlupa' },
    { id: 2, patient: 'Liza Soberano', service: 'Blood Pressure Monitoring', date: 'Oct 29, 2025', time: '02:00 PM', location: 'Alabang, Muntinlupa' },
    { id: 3, patient: 'Enrique Gil', service: 'Medication Assistance', date: 'Oct 30, 2025', time: '09:00 AM', location: 'Bayanan, Muntinlupa' },
    { id: 4, patient: 'Kathryn Bernardo', service: 'Post-Surgery Checkup', date: 'Oct 31, 2025', time: '11:00 AM', location: 'Tunasan, Muntinlupa' },
    { id: 5, patient: 'Daniel Padilla', service: 'Elder Care Checkup', date: 'Nov 01, 2025', time: '01:00 PM', location: 'Ayala Alabang, Muntinlupa' },
    { id: 6, patient: 'James Reid', service: 'Physiotherapy', date: 'Nov 02, 2025', time: '03:00 PM', location: 'Cupang, Muntinlupa' },
    { id: 7, patient: 'Nadine Lustre', service: 'Medication Delivery', date: 'Nov 03, 2025', time: '08:00 AM', location: 'Sucat, Muntinlupa' },
    { id: 8, patient: 'Piolo Pascual', service: 'Home Nursing', date: 'Nov 04, 2025', time: '12:00 PM', location: 'Buli, Muntinlupa' },
  ]);

  const handleAccept = (id, name) => {
    setRequests(requests.filter(r => r.id !== id));
    alert(`You have accepted the request from ${name}.`);
  };

  const handleReject = (id, name) => {
    if (confirm(`Are you sure you want to reject ${name}'s request?`)) {
      setRequests(requests.filter(r => r.id !== id));
    }
  };

  return (
    <DashboardLayout role="provider">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incoming Requests</h1>
          <p className="text-slate-500">Review and respond to new patient requests</p>
        </div>

        {requests.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requests.map((req) => (
              <div key={req.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold">
                      {req.patient.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{req.patient}</h3>
                      <p className="text-primary text-sm font-semibold">{req.service}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>{req.date}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{req.time}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{req.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleAccept(req.id, req.patient)}
                    className="flex items-center justify-center gap-2 bg-green-500 text-white py-3 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-200"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button 
                    onClick={() => handleReject(req.id, req.patient)}
                    className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
            <p className="text-slate-500 text-lg text-center">No incoming requests at the moment.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProviderRequests;
