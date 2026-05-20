import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Check, X, MapPin, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    const fetchRequests = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, status, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Note: location is currently not on users table, so we just use a default or fetch if added later.
        const formatted = (data || []).map(r => ({
          id: r.id,
          patient: r.patient?.full_name || 'Unknown Patient',
          service: r.service,
          date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: r.time,
          location: 'Muntinlupa City' // Placeholder since patients don't have location yet
        }));

        setRequests(formatted);
      } catch (err) {
        console.error('Error fetching incoming requests:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [user]);

  const handleAccept = async (id, name) => {
    setActionStates(prev => ({ ...prev, [id]: 'accepted' }));
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'Accepted' })
        .eq('id', id);

      if (error) throw error;

      setTimeout(() => {
        setRequests(prev => prev.filter(r => r.id !== id));
        setActionStates(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 800);
    } catch (err) {
      console.error('Error accepting request:', err);
      alert('Failed to accept request.');
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleReject = async (id, name) => {
    if (window.confirm(`Are you sure you want to reject ${name}'s request?`)) {
      setActionStates(prev => ({ ...prev, [id]: 'rejected' }));
      try {
        const { error } = await supabase
          .from('requests')
          .update({ status: 'Rejected' })
          .eq('id', id);

        if (error) throw error;

        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.id !== id));
          setActionStates(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 800);
      } catch (err) {
        console.error('Error rejecting request:', err);
        alert('Failed to reject request.');
        setActionStates(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

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
                        {req.patient.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
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
