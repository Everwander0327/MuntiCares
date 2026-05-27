import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Check, X, MapPin, Calendar, Clock, Wallet, Banknote, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';

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
    if (!user) return;

    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, notes, status, payment_status, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .eq('status', 'Pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const patientIds = data.map(r => r.patient_id);
        const { data: patientProfiles } = await supabase
          .from('patients')
          .select('user_id, address')
          .in('user_id', patientIds);

        const formatted = (data || []).map(r => {
          const profile = patientProfiles?.find(p => p.user_id === r.patient_id);
          const timeString = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          
          return {
            id: r.id,
            patient: r.patient?.full_name || 'Unknown Patient',
            service: r.service,
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: timeString,
            notes: r.notes || '',
            paymentStatus: r.payment_status || 'unpaid',
            location: profile?.address || 'Address pending profile completion'
          };
        });

        setRequests(formatted);
      } catch (err) {
        console.error('Error fetching incoming requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

    const channel = supabase
      .channel('provider-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `provider_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new;
          const oldRow = payload.old;
          const newStatus = newRow?.status;
          const deletedId = oldRow?.id;

          if (payload.eventType === 'DELETE' || newStatus === 'Cancelled' || newStatus === 'Rejected' || newStatus === 'Completed' || newStatus === 'Accepted') {
            setRequests(prev => prev.filter(r => r.id !== deletedId && r.id !== newRow?.id));
            return;
          }

          // INSERT — new Pending request
          if (payload.eventType === 'INSERT' && newStatus === 'Pending') {
            const mapped = {
              id: newRow.id,
              patient: newRow.patient?.full_name || 'Unknown Patient',
              service: newRow.service,
              date: new Date(newRow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              time: new Date(`2000-01-01T${newRow.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              notes: newRow.notes || '',
              paymentStatus: newRow.payment_status || 'unpaid',
              location: 'Muntinlupa',
            };
            setRequests(prev => {
              if (prev.find(r => r.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
            return;
          }

          // Payment status update (e.g., unpaid → pending_cash or unpaid → paid)
          if (payload.eventType === 'UPDATE' && newRow?.payment_status !== oldRow?.payment_status) {
            setRequests(prev => prev.map(r =>
              r.id === newRow.id ? { ...r, paymentStatus: newRow.payment_status } : r
            ));
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAccept = async (id) => {
    const { data: current } = await supabase
      .from('requests')
      .select('status')
      .eq('id', id)
      .single();

    if (!current || current.status !== 'Pending') {
      toast.error('This request is no longer available.');
      setRequests(prev => prev.filter(r => r.id !== id));
      return;
    }

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
      toast.error('Failed to accept request.');
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleReject = async (id, name) => {
    setActionStates(prev => ({ ...prev, [id]: 'rejected' }));
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'Rejected' })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Rejected ${name}'s request.`, { icon: '👋' });
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
      toast.error('Failed to reject request.');
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const paymentIcon = (status) => {
    switch (status) {
      case 'paid': return <Check className="w-3.5 h-3.5" />;
      case 'pending_cash': return <Banknote className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const paymentLabel = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'pending_cash': return 'Cash';
      default: return 'Awaiting Payment';
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Incoming Requests</h1>
          <p className="text-slate-500 dark:text-slate-400">Review and respond to new patient requests</p>
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
                  className={`bg-white p-6 rounded-[2rem] border shadow-sm transition-all duration-300 dark:bg-slate-800 dark:shadow-slate-900/50 ${
                    actionStates[req.id] === 'accepted' ? 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-900/30' :
                    actionStates[req.id] === 'rejected' ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/30' :
                    'border-slate-100 hover:shadow-xl dark:border-slate-700'
                  }`}
                  variants={staggerItem}
                  layout
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold dark:bg-blue-900/30">
                        {req.patient.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{req.patient}</h3>
                        <p className="text-primary text-sm font-semibold">{req.service}</p>
                      </div>
                    </div>
                    {/* Payment badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                      req.paymentStatus === 'paid'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200'
                        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200'
                    }`}>
                      {paymentIcon(req.paymentStatus)}
                      {paymentLabel(req.paymentStatus)}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{req.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{req.time}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>{req.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Wallet className={`w-4 h-4 ${req.paymentStatus === 'paid' ? 'text-green-500' : 'text-amber-500'}`} />
                      <span className={`font-semibold ${req.paymentStatus === 'paid' ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        {req.paymentStatus === 'paid' ? 'Paid' : req.paymentStatus === 'pending_cash' ? 'Cash on visit' : 'Awaiting Payment'}
                      </span>
                    </div>
                  </div>

                  {req.notes && (
                    <div className="mb-6 p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100 dark:bg-yellow-900/30 dark:border-yellow-900/50">
                      <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1 dark:text-yellow-200">Patient Notes</p>
                      <p className="text-sm text-yellow-900 leading-relaxed italic dark:text-yellow-100">{'\u201C'}{req.notes}{'\u201D'}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      onClick={() => {
                        if (req.paymentStatus === 'paid' || req.paymentStatus === 'pending_cash') {
                          handleAccept(req.id);
                        } else {
                          toast('Awaiting payment from patient.', { icon: '⏳' });
                        }
                      }}
                      className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all shadow-lg ${
                        actionStates[req.id] === 'accepted' 
                          ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50' 
                          : 'bg-green-500 text-white hover:bg-green-600 shadow-green-200 dark:shadow-green-900/50'
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
                          : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30'
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
            className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50 shadow-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <EmptyState icon="inbox" title="No incoming requests" message="New service requests from patients will appear here." />
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProviderRequests;
