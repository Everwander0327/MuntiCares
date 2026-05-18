import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Search, FileText, ShieldCheck, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import { SkeletonPage } from '../../components/Skeleton';

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
      className="p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
      style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)' }}
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-3 rounded-2xl ${color}`}>
          {React.cloneElement(icon, { className: 'w-6 h-6' })}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trendUp ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm font-medium mt-3">{label}</p>
      <p className="text-2xl font-bold text-slate-900" ref={ref}>{count}</p>
    </motion.div>
  );
};

const PatientDashboard = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const requests = [
    { provider: 'Maria Santos', service: 'Wound Care', date: 'Oct 24, 2025', status: 'Accepted' },
    { provider: 'Jose Reyes', service: 'Elder Care', date: 'Oct 25, 2025', status: 'Pending' },
    { provider: 'Ana Cruz', service: 'Physical Therapy', date: 'Oct 26, 2025', status: 'Rejected' },
  ];

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
        {/* Stats Row */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Active Requests" 
            value="2" 
            icon={<Clock />} 
            color="bg-blue-50 text-primary" 
            trend="+15%"
            trendUp={true}
          />
          <StatCard 
            label="Accepted Providers" 
            value="1" 
            icon={<CheckCircle2 />} 
            color="bg-green-50 text-green-600" 
            trend="+8%"
            trendUp={true}
          />
          <StatCard 
            label="Pending Requests" 
            value="3" 
            icon={<AlertCircle />} 
            color="bg-yellow-50 text-yellow-600" 
            trend="-5%"
            trendUp={false}
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
              <h3 className="text-xl font-bold mb-4">Maria Santos — Wound Care</h3>
              <div className="flex items-center gap-4 text-blue-100 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Tomorrow</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>9:00 AM</span>
                </div>
              </div>
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
                {requests.map((req, idx) => (
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
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing 1-3 of 3 results</p>
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
