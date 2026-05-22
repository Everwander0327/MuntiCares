import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Search, FileText, ShieldCheck, Calendar, ChevronLeft, ChevronRight, Navigation, Home, Stethoscope, MapPin, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import usePatientRequests from '../../hooks/usePatientRequests';
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
  const [activeVisit, setActiveVisit] = useState(null);
  const { user } = useAuth();

  // Use shared hook for requests + realtime
  const { requests: fetchedRequests, loading: requestsLoading } = usePatientRequests(user?.id || null);

  useEffect(() => {
    let channel;

    // map fetchedRequests into local structures used by this component
    if (!requestsLoading) {
      if (fetchedRequests && fetchedRequests.length > 0) {
      const formattedRequests = (fetchedRequests || []).map(req => {
        let timeStr = '';
        try { if (req.time) timeStr = new Date(`2000-01-01T${req.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeStr = req.time || ''; }
        return {
          provider: req.provider || 'Unknown',
          service: req.service,
          date: new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: timeStr,
          status: req.status,
        };
      });

      setRequests(formattedRequests);

      const accepted = (fetchedRequests || []).filter(r => ['Accepted', 'On The Way', 'Arrived'].includes(r.status)).length;
      const pending = (fetchedRequests || []).filter(r => r.status === 'Pending').length;
      setStats({ active: accepted + pending, accepted, pending });

      const priorityOrder = ['On The Way', 'Arrived', 'Accepted'];
      let activeReq = null;
      for (const status of priorityOrder) {
        activeReq = (fetchedRequests || []).find(r => r.status === status);
        if (activeReq) break;
      }

      if (activeReq) {
        let timeLabel = '';
        try { if (activeReq.time) timeLabel = new Date(`2000-01-01T${activeReq.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeLabel = activeReq.time || ''; }
        setActiveVisit({
          providerId: activeReq.providerId,
          provider: activeReq.provider || 'Unknown',
          service: activeReq.service,
          date: new Date(activeReq.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: timeLabel,
          status: activeReq.status,
        });
      } else {
        setActiveVisit(null);
      }

      setLoading(false);
      } else {
        // no requests
        setRequests([]);
        setStats({ active: 0, accepted: 0, pending: 0 });
        setActiveVisit(null);
      setLoading(false);
      }

    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchedRequests, requestsLoading, user]);

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

          {/* Live Visit Tracker */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6 relative overflow-hidden">
            {activeVisit ? (() => {
              const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];
              const STEP_LABELS = ['Confirmed', 'En Route', 'Arrived', 'Done'];
              const STEP_ICONS = [
                <CheckCircle2 className="w-3.5 h-3.5" />,
                <Navigation className="w-3.5 h-3.5" />,
                <Home className="w-3.5 h-3.5" />,
                <Stethoscope className="w-3.5 h-3.5" />,
              ];
              const STEP_COLORS = ['bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-green-500'];
              const currentStep = STATUS_STEPS.indexOf(activeVisit.status);

              const STATUS_MESSAGES = {
                Accepted: '✅ Your provider has confirmed the visit. Please prepare for their arrival.',
                'On The Way': '🚗 Your provider is on the way to your location. Please stay at home.',
                Arrived: '🏠 Your provider has arrived! The home care session is starting now.',
                Completed: '✅ Your visit has been completed. Check your medical records for notes.',
              };

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Home Care Visit</p>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{activeVisit.provider}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/patient/messages?provider=${activeVisit.providerId}`}
                        className="p-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all flex items-center justify-center"
                        title="Chat with Provider"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Link>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{activeVisit.service}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-500 mb-5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium">{activeVisit.date}</span>
                    </div>
                    {activeVisit.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{activeVisit.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Stepper */}
                  <div className="flex items-center gap-1 mb-2">
                    {STATUS_STEPS.map((step, i) => (
                      <React.Fragment key={step}>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                          i < currentStep ? 'bg-green-100 text-green-600'
                          : i === currentStep ? `${STEP_COLORS[i]} text-white shadow-lg`
                          : 'bg-slate-100 text-slate-400'
                        }`}>
                          {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : STEP_ICONS[i]}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                            i < currentStep ? 'bg-green-200' : i === currentStep ? `${STEP_COLORS[i]} opacity-30` : 'bg-slate-100'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-5">
                    {STEP_LABELS.map((label, i) => (
                      <span key={label} className={`text-[9px] sm:text-[10px] font-bold transition-colors ${
                        i <= currentStep ? 'text-slate-700' : 'text-slate-300'
                      }`}>{label}</span>
                    ))}
                  </div>

                  {/* Status Message */}
                  <div className={`p-3 rounded-xl text-sm font-medium ${
                    activeVisit.status === 'On The Way' ? 'bg-amber-50 text-amber-800 border border-amber-100'
                    : activeVisit.status === 'Arrived' ? 'bg-purple-50 text-purple-800 border border-purple-100'
                    : activeVisit.status === 'Completed' ? 'bg-green-50 text-green-800 border border-green-100'
                    : 'bg-blue-50 text-blue-800 border border-blue-100'
                  }`}>
                    {STATUS_MESSAGES[activeVisit.status]}
                  </div>
                </>
              );
            })() : (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Stethoscope className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-700 font-bold">No Active Visits</p>
                <p className="text-sm text-slate-500 mt-1">Book a provider to see your visit tracker here.</p>
              </div>
            )}
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
                          ['Accepted', 'Completed'].includes(req.status) ? 'bg-green-100 text-green-700' :
                          req.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          req.status === 'Cancelled' ? 'bg-slate-100 text-slate-500' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                            ['Accepted', 'Completed'].includes(req.status) ? 'bg-green-500' :
                            req.status === 'Pending' ? 'bg-yellow-500' :
                            req.status === 'Cancelled' ? 'bg-slate-400' :
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
