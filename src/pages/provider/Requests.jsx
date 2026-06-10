import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Check, X, MapPin, Calendar, Clock, Wallet, Banknote, CheckCircle, Loader2, Receipt as ReceiptIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ReceiptModal from '../../components/ReceiptModal';
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

const tabs = [
  { id: 'incoming', label: 'Incoming' },
  { id: 'active', label: 'Active' },
];

const ProviderRequests = () => {
  const [activeTab, setActiveTab] = useState('incoming');
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  const [completing, setCompleting] = useState({});
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, notes, status, payment_status, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .in('status', ['Pending', 'Accepted'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        const patientIds = [...new Set((data || []).map(r => r.patient_id))];
        const { data: patientProfiles } = await supabase
          .from('patients')
          .select('user_id, address')
          .in('user_id', patientIds);

        const format = (r) => {
          const profile = patientProfiles?.find(p => p.user_id === r.patient_id);
          return {
            id: r.id,
            patient: r.patient?.full_name || 'Unknown Patient',
            service: r.service,
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            notes: r.notes || '',
            status: r.status,
            paymentStatus: r.payment_status || 'unpaid',
            location: profile?.address || 'Muntinlupa',
          };
        };

        setPending((data || []).filter(r => r.status === 'Pending').map(format));
        setActive((data || []).filter(r => r.status === 'Accepted').map(format));
      } catch (err) {
        console.error('Error fetching requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

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

          if (payload.eventType === 'DELETE') {
            setPending(prev => prev.filter(r => r.id !== oldRow?.id));
            setActive(prev => prev.filter(r => r.id !== oldRow?.id));
            return;
          }

          if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;

          if (newRow?.status === 'Pending') {
            setActive(prev => prev.filter(r => r.id !== newRow.id));
            const exists = pending.some(r => r.id === newRow.id);
            if (!exists) {
              setPending(prev => [{
                id: newRow.id,
                patient: newRow.patient?.full_name || 'Unknown Patient',
                service: newRow.service,
                date: new Date(newRow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                time: new Date(`2000-01-01T${newRow.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                notes: newRow.notes || '',
                status: newRow.status,
                paymentStatus: newRow.payment_status || 'unpaid',
                location: 'Muntinlupa',
              }, ...prev]);
            } else {
              setPending(prev => prev.map(r => r.id === newRow.id ? { ...r, paymentStatus: newRow.payment_status, notes: newRow.notes || '' } : r));
            }
          } else if (newRow?.status === 'Accepted') {
            setPending(prev => prev.filter(r => r.id !== newRow.id));
            setActive(prev => {
              const exists = prev.some(r => r.id === newRow.id);
              if (exists) return prev.map(r => r.id === newRow.id ? { ...r, paymentStatus: newRow.payment_status } : r);
              return [{ id: newRow.id,
                patient: newRow.patient?.full_name || 'Unknown Patient',
                service: newRow.service,
                date: new Date(newRow.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                time: new Date(`2000-01-01T${newRow.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                notes: newRow.notes || '',
                status: newRow.status,
                paymentStatus: newRow.payment_status || 'unpaid',
                location: 'Muntinlupa' }, ...prev];
            });
          } else if (newRow?.status === 'Completed' || newRow?.status === 'Cancelled' || newRow?.status === 'Rejected') {
            setPending(prev => prev.filter(r => r.id !== newRow.id));
            setActive(prev => prev.filter(r => r.id !== newRow.id));
          }

          if (newRow?.payment_status !== oldRow?.payment_status && newRow?.status === 'Pending') {
            setPending(prev => prev.map(r =>
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
      setPending(prev => prev.filter(r => r.id !== id));
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
        setPending(prev => prev.filter(r => r.id !== id));
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
        setPending(prev => prev.filter(r => r.id !== id));
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

  const handleMarkComplete = async (req) => {
    setCompleting(prev => ({ ...prev, [req.id]: true }));
    try {
      const { data: txData, error: txFindError } = await supabase
        .from('transactions')
        .select('id, payment_method, provider_payout')
        .eq('request_id', req.id)
        .single();

      if (txFindError && txFindError.code !== 'PGRST116') throw txFindError;

      const updates = [];

      updates.push(
        supabase
          .from('requests')
          .update({ status: 'Completed' })
          .eq('id', req.id)
      );

      if (txData) {
        updates.push(
          supabase
            .from('transactions')
            .update({ status: 'completed', paid_at: new Date().toISOString() })
            .eq('id', txData.id)
        );
      }

      await Promise.all(updates);

      toast.success('Service marked complete! Payment released to you.');

      setTimeout(() => {
        setActive(prev => prev.filter(r => r.id !== req.id));
        setCompleting(prev => {
          const next = { ...prev };
          delete next[req.id];
          return next;
        });
      }, 500);
    } catch (err) {
      console.error('Error marking complete:', err);
      toast.error('Failed to mark as complete.');
      setCompleting(prev => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
    }
  };

  if (loading) {
    return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Service Requests</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage incoming and active service requests</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.id === 'incoming' && pending.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-2xs">{pending.length}</span>
              )}
              {tab.id === 'active' && active.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-2xs">{active.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'incoming' && (
          <>
            {pending.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <AnimatePresence>
                  {pending.map((req) => (
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
          </>
        )}

        {activeTab === 'active' && (
          <>
            {active.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                <AnimatePresence>
                  {active.map((req) => (
                    <motion.div
                      key={req.id}
                      className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm hover:shadow-xl transition-all dark:bg-slate-800 dark:border-blue-900/50"
                      variants={staggerItem}
                      layout
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.3 } }}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 font-bold dark:bg-green-900/30 dark:text-green-300">
                            {req.patient.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100">{req.patient}</h3>
                            <p className="text-primary text-sm font-semibold">{req.service}</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
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
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {req.paymentStatus === 'paid' && (
                          <motion.button
                            onClick={async () => {
                              const { data } = await supabase
                                .from('transactions')
                                .select('*')
                                .eq('request_id', req.id)
                                .single();
                              if (data) {
                                setSelectedReceipt({ ...data, providerName: req.patient });
                              }
                            }}
                            className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                            whileTap={{ scale: 0.95 }}
                          >
                            <ReceiptIcon className="w-4 h-4" /> View Receipt
                          </motion.button>
                        )}
                        <motion.button
                          onClick={() => handleMarkComplete(req)}
                          className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all shadow-lg bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                          whileTap={{ scale: 0.95 }}
                          disabled={!!completing[req.id]}
                        >
                          {completing[req.id] ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Completing...</>
                          ) : (
                            <><CheckCircle className="w-4 h-4" /> Mark Complete</>
                          )}
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
                <EmptyState icon="check-circle" title="No active services" message="Accepted service requests will appear here. Mark them complete when done." />
              </motion.div>
            )}
          </>
        )}
      </div>

      <ReceiptModal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        transaction={selectedReceipt}
      />
    </DashboardLayout>
  );
};

export default ProviderRequests;
