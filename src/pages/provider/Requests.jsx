import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Check, X, MapPin, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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

  const [actionStates, setActionStates] = React.useState({});

  const handleAccept = (id, name) => {
    setActionStates(prev => ({ ...prev, [id]: 'accepted' }));
    setTimeout(() => {
      setRequests(requests.filter(r => r.id !== id));
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      alert(`You have accepted the request from ${name}.`);
    }, 800);
  };

  const handleReject = (id, name) => {
    if (confirm(`Are you sure you want to reject ${name}'s request?`)) {
      setActionStates(prev => ({ ...prev, [id]: 'rejected' }));
      setTimeout(() => {
        setRequests(requests.filter(r => r.id !== id));
        setActionStates(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 800);
    }
  };

  return (
    <DashboardLayout role="provider">
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-900">Incoming Requests</h1>
          <p className="text-slate-500">Review and respond to new patient requests</p>
        </motion.div>

        {requests.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <AnimatePresence>
              {requests.map((req) => (
                <motion.div 
                  key={req.id} 
                  className={`bg-white p-6 rounded-[2rem] border shadow-sm transition-all duration-300 ${
                    actionStates[req.id] === 'accepted' ? 'border-green-200 bg-green-50/50' :
                    actionStates[req.id] === 'rejected' ? 'border-red-200 bg-red-50/50' :
                    'border-slate-100 hover:shadow-xl'
                  }`}
                  variants={staggerItem}
                  layout
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                >
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
                    <motion.button 
                      onClick={() => handleAccept(req.id, req.patient)}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all shadow-lg ${
                        actionStates[req.id] === 'accepted' 
                          ? 'bg-green-500 text-white shadow-green-200' 
                          : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200'
                      }`}
                      whileTap={{ scale: 0.95 }}
                      animate={actionStates[req.id] === 'accepted' ? { scale: [1, 1.1, 1] } : {}}
                      disabled={!!actionStates[req.id]}
                    >
                      <Check className="w-4 h-4" />
                      {actionStates[req.id] === 'accepted' ? 'Accepted ✓' : 'Accept'}
                    </motion.button>
                    <motion.button 
                      onClick={() => handleReject(req.id, req.patient)}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all ${
                        actionStates[req.id] === 'rejected'
                          ? 'bg-red-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'
                      }`}
                      whileTap={{ scale: 0.95 }}
                      animate={actionStates[req.id] === 'rejected' ? { scale: [1, 1.1, 1] } : {}}
                      disabled={!!actionStates[req.id]}
                    >
                      <X className="w-4 h-4" />
                      {actionStates[req.id] === 'rejected' ? 'Rejected' : 'Reject'}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-20 bg-white rounded-[2rem] border border-slate-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-slate-500 text-lg text-center">No incoming requests at the moment.</p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProviderRequests;
