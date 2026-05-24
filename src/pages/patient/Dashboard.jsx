import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Search, FileText, ShieldCheck, Calendar, ChevronLeft, ChevronRight, Navigation, Home, Stethoscope, MapPin, MessageSquare, MessageCircle, RefreshCw, Star, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import usePatientRequests from '../../hooks/usePatientRequests';
import { SkeletonPage } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

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
      className="p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-all flex flex-col justify-between bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-800"
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-2">
        <div className={`p-2 md:p-3 w-fit rounded-xl md:rounded-2xl ${color}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4 md:w-6 md:h-6' })}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] md:text-xs font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg w-fit ${trendUp ? 'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/30' : 'text-red-500 dark:text-red-300 bg-red-50 dark:bg-red-900/30'}`}>
            {trendUp ? <TrendingUp className="w-2 h-2 md:w-3 md:h-3" /> : <TrendingDown className="w-2 h-2 md:w-3 md:h-3" />}
            <span className="hidden xl:inline">{trend}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium mt-1 md:mt-3 leading-tight">{label}</p>
        <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-slate-100" ref={ref}>{count}</p>
      </div>
    </motion.div>
  );
};

const PatientDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, accepted: 0, pending: 0 });
  const [activeVisit, setActiveVisit] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = React.useRef(0);
  const pullDistRef = React.useRef(0);
  const isPulling = React.useRef(false);
  const mainRef = React.useRef(null);
  const prevStatusesRef = useRef({});
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

      (fetchedRequests || []).forEach(req => {
        const prev = prevStatusesRef.current[req.id];
        if (prev && prev !== req.status) {
          const providerName = req.provider || 'A provider';
          const msgMap = {
            'Accepted': `${providerName} accepted your request!`,
            'Cancelled': `${providerName} cancelled your request.`,
            'Rejected': `${providerName} declined your request.`,
            'On The Way': `${providerName} is on the way!`,
            'Arrived': `${providerName} has arrived!`,
            'Completed': `Your session with ${providerName} is complete.`,
          };
          const msg = msgMap[req.status];
          if (msg) toast(msg, { icon: '🔄', duration: 4000 });
        }
        prevStatusesRef.current[req.id] = req.status;
      });

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

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .gte('created_at', yesterday);

      if (!error) {
        const readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        const unreadCount = (data || []).filter(m => !readIds.has(m.id)).length;
        setUnreadCount(unreadCount);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('dashboard-unread-msg')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnreadCount())
      .subscribe();

    const onMessagesRead = () => fetchUnreadCount();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchUnreadCount(); };
    const onWindowFocus = () => fetchUnreadCount();
    window.addEventListener('messages-read', onMessagesRead);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const pollInterval = setInterval(fetchUnreadCount, 2000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [user]);

  const getScrollContainer = () => {
    if (!mainRef.current) return null;
    let el = mainRef.current.parentElement;
    while (el) {
      if (window.getComputedStyle(el).overflowY === 'auto') return el;
      el = el.parentElement;
    }
    return null;
  };

  const handleTouchStart = (e) => {
    const scrollContainer = getScrollContainer();
    if (scrollContainer && scrollContainer.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) {
      const clamped = Math.min(dist * 0.5, 80);
      pullDistRef.current = clamped;
      setPullDistance(clamped);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistRef.current >= 60 && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      pullDistRef.current = 0;
      isPulling.current = false;
      window.location.reload();
    } else {
      setPullDistance(0);
      pullDistRef.current = 0;
      isPulling.current = false;
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ height: pullDistance + 20, paddingTop: pullDistance > 30 ? pullDistance * 0.3 : 0 }}
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: pullDistance >= 60 ? 180 : 0 }}
            className="w-8 h-8 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </motion.div>
        </div>
      )}
      <div
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="space-y-6 md:space-y-8"
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance}px)`, transition: 'transform 0.1s ease-out' } : { transition: 'transform 0.3s ease-out' }}
      >
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
            color="bg-blue-50 dark:bg-blue-900/30 text-primary" 
          />
          <StatCard 
            label="Accepted Providers" 
            value={String(stats.accepted)} 
            icon={<CheckCircle2 />} 
            color="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300" 
          />
          <StatCard 
            label="Pending Requests" 
            value={String(stats.pending)} 
            icon={<AlertCircle />} 
            color="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300" 
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
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quick Actions</h3>
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
                to="/patient/messages"
                className={`btn-outline flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold relative`}
              >
                <MessageCircle className="w-4 h-4" />
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Contextual action cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {activeVisit && stats.accepted > 0 && (
                <Link
                  to={`/patient/messages?provider=${activeVisit.providerId}`}
                  className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl transition-all group"
                >
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50 group-hover:shadow transition-shadow">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Message Provider</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{activeVisit.provider}</p>
                  </div>
                </Link>
              )}

              {fetchedRequests?.some(r => r.status === 'Completed') && (
                <Link
                  to="/patient/providers"
                  className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-100 dark:border-orange-900/50 rounded-2xl transition-all group"
                >
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50 group-hover:shadow transition-shadow">
                    <RotateCcw className="w-5 h-5 text-orange-500 dark:text-orange-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Rebook a Provider</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Book a new appointment</p>
                  </div>
                </Link>
              )}

              {fetchedRequests?.some(r => ['Completed', 'Accepted'].includes(r.status)) && (
                <Link
                  to="/patient/requests"
                  className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-100 dark:border-green-900/50 rounded-2xl transition-all group"
                >
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50 group-hover:shadow transition-shadow">
                    <Star className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="min-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">View Visit History</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Check past and upcoming visits</p>
                  </div>
                </Link>
              )}

              {!fetchedRequests?.some(r => ['Accepted', 'On The Way', 'Arrived', 'Completed'].includes(r.status)) && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl col-span-1 sm:col-span-2">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm dark:shadow-slate-900/50">
                    <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Ready to get started?</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Find a provider and book your first visit</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Visit Tracker */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 p-5 sm:p-6 relative overflow-hidden">
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
                      <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Home Care Visit</p>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{activeVisit.provider}</h3>
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

                  <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mb-5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="font-medium">{activeVisit.date}</span>
                    </div>
                    {activeVisit.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="font-medium">{activeVisit.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Stepper */}
                  <div className="flex items-center gap-1 mb-2">
                    {STATUS_STEPS.map((step, i) => (
                      <React.Fragment key={step}>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                          i < currentStep ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300'
                          : i === currentStep ? `${STEP_COLORS[i]} text-white shadow-lg`
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                        }`}>
                          {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : STEP_ICONS[i]}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                            i < currentStep ? 'bg-green-200' : i === currentStep ? `${STEP_COLORS[i]} opacity-30` : 'bg-slate-100 dark:bg-slate-700'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mb-5">
                    {STEP_LABELS.map((label, i) => (
                      <span key={label} className={`text-[9px] sm:text-[10px] font-bold transition-colors ${
                        i <= currentStep ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'
                      }`}>{label}</span>
                    ))}
                  </div>

                  {/* Status Message */}
                  <div className={`p-3 rounded-xl text-sm font-medium ${
                    activeVisit.status === 'On The Way' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-100 dark:border-amber-900/50'
                    : activeVisit.status === 'Arrived' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-100 dark:border-purple-900/50'
                    : activeVisit.status === 'Completed' ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-100 dark:border-green-900/50'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-900/50'
                  }`}>
                    {STATUS_MESSAGES[activeVisit.status]}
                  </div>
                </>
              );
            })() : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-primary" />
                </div>
                <p className="text-slate-800 dark:text-slate-200 font-bold text-lg">No Active Visits</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  You don't have any upcoming visits. Browse available providers and book a home care service to get started.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/patient/providers"
                    className="btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20"
                  >
                    <Search className="w-4 h-4" />
                    Find a Provider
                  </Link>
                  <Link
                    to="/patient/requests"
                    className="btn-outline inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold"
                  >
                    <FileText className="w-4 h-4" />
                    View Past Requests
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Requests Table */}
        <motion.div 
          className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Requests</h3>
            <Link to="/patient/requests" className="text-primary font-semibold text-sm hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm uppercase tracking-wider">
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
                          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-primary">
                            {req.provider.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{req.provider}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.service}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          ['Accepted', 'Completed'].includes(req.status) ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200' :
                          req.status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200' :
                          req.status === 'Cancelled' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' :
                          'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200'
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
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div>
                          <p className="text-slate-600 dark:text-slate-300 font-bold">No Requests Yet</p>
                          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                            Find a provider and book your first home care service.
                          </p>
                        </div>
                        <Link
                          to="/patient/providers"
                          className="mt-1 text-primary font-bold text-sm hover:underline inline-flex items-center gap-1"
                        >
                          <Search className="w-3.5 h-3.5" />
                          Browse Providers
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Showing {Math.min(requests.length, 5)} of {requests.length} results</p>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" disabled>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-lg bg-primary text-white text-sm font-bold">1</button>
              <button className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" disabled>
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
