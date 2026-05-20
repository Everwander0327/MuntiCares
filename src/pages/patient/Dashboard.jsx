import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Search, FileText, ShieldCheck, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import { SkeletonPage } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatCard = ({ label, value, icon, color, trend, trendUp }) => {
  const { count, ref } = useCountUp(parseInt(value), 1500, false);
  
  return (
    <motion.div 
      className="p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)' }}
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-2">
        <div className={`p-2 md:p-3 w-fit rounded-xl md:rounded-2xl ${color}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4 md:w-6 md:h-6' })}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg w-fit ${trendUp ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
            {trendUp ? <TrendingUp className="w-2 h-2 md:w-3 md:h-3" /> : <TrendingDown className="w-2 h-2 md:w-3 md:h-3" />}
            <span className="hidden xl:inline">{trend}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-[10px] md:text-sm font-medium mt-1 md:mt-3 leading-tight">{label}</p>
        <p className="text-lg md:text-2xl font-bold text-slate-900" ref={ref}>{count}</p>
      </div>
    </motion.div>
  );
};

const PatientDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, accepted: 0, pending: 0 });
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch all requests for this patient, join with provider info
        const { data: requestsData, error: requestsError } = await supabase
          .from('requests')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (requestsError) throw requestsError;

        const formattedRequests = (requestsData || []).map(req => ({
          provider: req.provider?.full_name || 'Unknown',
          service: req.service,
          date: new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: req.status,
        }));

        setRequests(formattedRequests);

        // Calculate stats
        const accepted = (requestsData || []).filter(r => r.status === 'Accepted').length;
        const pending = (requestsData || []).filter(r => r.status === 'Pending').length;
        const active = accepted + pending;

        setStats({ active, accepted, pending });

        // Find upcoming appointment (next accepted request)
        const upcoming = (requestsData || []).find(r => r.status === 'Accepted');
        if (upcoming) {
          setUpcomingAppointment({
            provider: upcoming.provider?.full_name || 'Unknown',
            service: upcoming.service,
            date: new Date(upcoming.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          });
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 md:space-y-8">
        {/* Stats Row */}
        <motion.div 
          className="grid grid-cols-3 gap-3 md:gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Active Requests" 
            value={String(stats.active)} 
            icon={<Clock />} 
            color="bg-blue-50 text-primary" 
          />
          <StatCard 
            label="Accepted Providers" 
            value={String(stats.accepted)} 
            icon={<CheckCircle2 />} 
            color="bg-green-50 text-green-600" 
          />
          <StatCard 
            label="Pending Requests" 
            value={String(stats.pending)} 
            icon={<AlertCircle />} 
            color="bg-yellow-50 text-yellow-600" 
          />
        </motion.div>

        {/* Quick Actions + Upcoming Appointment */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {/* Quick Actions */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link 
                to="/patient/providers"
                className="btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20"
              >
                <Search className="w-4 h-4" />
                Find a Provider
              </Link>
              <Link 
                to="/patient/requests"
                className="btn-outline flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
              >
                <FileText className="w-4 h-4" />
                View Requests
              </Link>
              <Link 
                to="/patient/consent"
                className="btn-outline flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
              >
                <ShieldCheck className="w-4 h-4" />
                Manage Consent
              </Link>
            </div>
          </div>

          {/* Upcoming Appointment */}
          <div className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-blue-200 text-sm font-semibold mb-2">Upcoming Appointment</p>
              {upcomingAppointment ? (
                <>
                  <h3 className="text-xl font-bold mb-4">{upcomingAppointment.provider} — {upcomingAppointment.service}</h3>
                  <div className="flex items-center gap-4 text-blue-100 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{upcomingAppointment.date}</span>
                    </div>
                  </div>
                </>
              ) : (
                <h3 className="text-xl font-bold mb-4">No upcoming appointments</h3>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent Requests Table */}
        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Recent Requests</h3>
            <Link to="/patient/requests" className="text-primary font-semibold text-sm hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Provider Name</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  requests.slice(0, 5).map((req, idx) => (
                    <motion.tr 
                      key={idx} 
                      className="transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary">
                            {req.provider.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-slate-700">{req.provider}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{req.service}</td>
                      <td className="px-6 py-4 text-slate-600">{req.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          req.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                          req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                            req.status === 'Accepted' ? 'bg-green-500' :
                            req.status === 'Pending' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                          {req.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-slate-400">
                      No requests yet. Start by finding a provider!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {Math.min(requests.length, 5)} of {requests.length} results</p>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors" disabled>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-primary text-white text-sm font-bold">1</button>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors" disabled>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
