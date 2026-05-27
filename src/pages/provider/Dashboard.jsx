import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, Users, CheckCircle, Check, X, Calendar, ChevronRight, Star, MessageCircle, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import { SkeletonPage } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatCard = ({ label, value, icon, color }) => {
  const { count, ref } = useCountUp(parseInt(value), 1500, false);
  
  return (
    <motion.div 
      className="p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between dark:border-slate-700 dark:shadow-slate-900/50 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-800"
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-2">
        <div className={`p-2 md:p-3 w-fit rounded-xl md:rounded-2xl ${color}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4 md:w-6 md:h-6' })}
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-[10px] md:text-sm font-medium mt-1 md:mt-3 leading-tight dark:text-slate-400">{label}</p>
        <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-slate-100" ref={ref}>{count}</p>
      </div>
    </motion.div>
  );
};

const ProviderDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  
  const [stats, setStats] = useState({ pending: 0, activePatients: 0, completed: 0 });
  const [schedule, setSchedule] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  
  const { user } = useAuth();

  useEffect(() => {
    let channel;

    const fetchDashboardData = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, time, status, payment_status, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .order('date', { ascending: true });

        if (error) throw error;

        const allRequests = data || [];

        // Stats calculation
        const pendingCount = allRequests.filter(r => r.status === 'Pending').length;
        const completedCount = allRequests.filter(r => r.status === 'Completed').length;
        
        // Active patients: unique patients with Accepted or Completed requests
        const activePatientIds = new Set(
          allRequests.filter(r => r.status === 'Accepted' || r.status === 'Completed').map(r => r.patient_id)
        );

        setStats({
          pending: pendingCount,
          activePatients: activePatientIds.size,
          completed: completedCount
        });

        // Today's schedule: upcoming Accepted requests
        const upcoming = allRequests
          .filter(r => r.status === 'Accepted')
          .map(r => ({
            id: r.id,
            patient: r.patient?.full_name || 'Unknown',
            time: r.time ? r.time.substring(0, 5) : '09:00',
            service: r.service,
            date: new Date(r.date).toLocaleDateString(),
            paymentStatus: r.payment_status || 'unpaid',
          }))
          .slice(0, 5);
        setSchedule(upcoming);

        // Incoming requests
        const incoming = allRequests
          .filter(r => r.status === 'Pending')
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(r => ({
            id: r.id,
            patient: r.patient?.full_name || 'Unknown',
            service: r.service,
            date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          }));
        setIncomingRequests(incoming);

        const { data: reviewData } = await supabase
          .from('provider_reviews')
          .select('id, rating, review_text, created_at, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        setReviews(reviewData || []);

      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    if (user) {
      channel = supabase
        .channel('provider-dashboard-requests')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
            filter: `provider_id=eq.${user.id}`
          },
          () => {
            fetchDashboardData();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkCollected = async (id) => {
    setActionStates(prev => ({ ...prev, [`collected_${id}`]: true }));
    try {
      await supabase
        .from('requests')
        .update({ payment_status: 'paid', status: 'Completed' })
        .eq('id', id);

      await supabase
        .from('transactions')
        .update({ status: 'collected', paid_at: new Date().toISOString() })
        .eq('request_id', id);

      toast.success('Marked as collected!');
      fetchDashboardData();
    } catch (err) {
      console.error('Error marking as collected:', err);
      toast.error('Failed to mark as collected.');
    } finally {
      setActionStates(prev => {
        const next = { ...prev };
        delete next[`collected_${id}`];
        return next;
      });
    }
  };

  const handleAction = async (id, action) => {
    setActionStates(prev => ({ ...prev, [id]: action }));
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: action === 'accepted' ? 'Accepted' : 'Rejected' })
        .eq('id', id);

      if (error) throw error;

      setTimeout(() => {
        setIncomingRequests(prev => prev.filter(r => r.id !== id));
        setActionStates(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        
        // Update stats optimistically
        setStats(prev => ({
          ...prev,
          pending: prev.pending - 1,
          activePatients: action === 'accepted' ? prev.activePatients + 1 : prev.activePatients
        }));
      }, 800);
    } catch (err) {
      console.error('Error updating request:', err);
      toast.error('Failed to update request.');
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

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6 md:space-y-8">
        <motion.div 
          className="grid grid-cols-3 gap-3 md:gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Pending Requests" 
            value={String(stats.pending)} 
            icon={<Clock />} 
            color="bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30" 
          />
          <StatCard 
            label="Active Patients" 
            value={String(stats.activePatients)} 
            icon={<Users />} 
            color="bg-blue-50 text-primary dark:bg-blue-900/30" 
          />
          <StatCard 
            label="Completed Services" 
            value={String(stats.completed)} 
            icon={<CheckCircle />} 
            color="bg-green-50 text-green-600 dark:bg-green-900/30" 
          />
        </motion.div>

        {/* Schedule */}
        <motion.div 
          className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-200" />
              <p className="text-blue-200 font-semibold text-sm">Upcoming Schedule</p>
            </div>
            <div className="space-y-3">
              {schedule.length > 0 ? (
                schedule.map((appt, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="text-center w-20 shrink-0">
                      <p className="text-lg font-bold">{appt.time}</p>
                      <p className="text-xs text-blue-200">{appt.date}</p>
                    </div>
                    <div className="w-px h-10 bg-white/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{appt.patient}</p>
                      <p className="text-blue-200 text-sm truncate">{appt.service}</p>
                      {appt.paymentStatus === 'pending_cash' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200 mt-1">
                          <Banknote className="w-3 h-3" /> Cash on visit
                        </span>
                      )}
                      {appt.paymentStatus === 'paid' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-200 mt-1">
                          <Check className="w-3 h-3" /> Paid
                        </span>
                      )}
                    </div>
                    {appt.paymentStatus === 'pending_cash' && (
                      <motion.button
                        onClick={() => handleMarkCollected(appt.id)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                        whileTap={{ scale: 0.95 }}
                        disabled={actionStates[`collected_${appt.id}`]}
                      >
                        <Check className="w-3 h-3" />
                        Mark Collected
                      </motion.button>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-white/70 text-sm">No upcoming scheduled services.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Incoming Requests Table */}
        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Incoming Requests</h3>
            <Link to="/provider/requests" className="text-primary font-semibold text-sm hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Service Needed</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incomingRequests.length > 0 ? (
                  incomingRequests.slice(0, 5).map((req, idx) => (
                    <motion.tr 
                      key={req.id} 
                      className="transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary dark:bg-blue-900/30">
                            {req.patient.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                          </div>
                          {req.patient}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.service}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.date}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <motion.button 
                            className={`p-2 rounded-xl transition-all shadow-sm dark:shadow-slate-900/50 ${
                              actionStates[req.id] === 'accepted' 
                                ? 'bg-green-500 text-white' 
                                : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white dark:bg-green-900/30'
                            }`}
                            onClick={() => handleAction(req.id, 'accepted')}
                            whileTap={{ scale: 0.9 }}
                            animate={actionStates[req.id] === 'accepted' ? { scale: [1, 1.2, 1] } : {}}
                            disabled={!!actionStates[req.id]}
                          >
                            <Check className="w-5 h-5" />
                          </motion.button>
                          <motion.button 
                            className={`p-2 rounded-xl transition-all shadow-sm dark:shadow-slate-900/50 ${
                              actionStates[req.id] === 'rejected' 
                                ? 'bg-red-500 text-white' 
                                : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white dark:bg-red-900/30'
                            }`}
                            onClick={() => handleAction(req.id, 'rejected')}
                            whileTap={{ scale: 0.9 }}
                            animate={actionStates[req.id] === 'rejected' ? { scale: [1, 1.2, 1] } : {}}
                            disabled={!!actionStates[req.id]}
                          >
                            <X className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-10">
                      <EmptyState icon="inbox" title="No incoming requests" variant="compact" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent Feedback */}
        <motion.div
          className="bg-white rounded-3xl border border-slate-100 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center gap-2 dark:border-slate-700">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Feedback</h3>
          </div>
          <div className="p-6">
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {review.patient?.full_name || 'Anonymous'}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 dark:text-slate-600'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.review_text && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">{review.review_text}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="star" title="No feedback yet" message="Reviews from patients will appear here." variant="compact" />
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderDashboard;
