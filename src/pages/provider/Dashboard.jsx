import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, Users, CheckCircle, Check, X, TrendingUp, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import useCountUp from '../../hooks/useCountUp';
import { SkeletonPage } from '../../components/Skeleton';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatCard = ({ label, value, icon, color, trend }) => {
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
          <div className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded-lg">
            <TrendingUp className="w-3 h-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm font-medium mt-3">{label}</p>
      <p className="text-2xl font-bold text-slate-900" ref={ref}>{count}</p>
    </motion.div>
  );
};

const ProviderDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const requests = [
    { patient: 'Juan Dela Cruz', service: 'Wound Care Dressing', date: 'Oct 28, 2025' },
    { patient: 'Liza Soberano', service: 'Blood Pressure Monitoring', date: 'Oct 29, 2025' },
    { patient: 'Enrique Gil', service: 'Medication Assistance', date: 'Oct 30, 2025' },
  ];

  const todaySchedule = [
    { patient: 'Maria Makiling', time: '10:00 AM', service: 'Wound Care Check' },
    { patient: 'Leonor Rivera', time: '2:30 PM', service: 'Physical Therapy Session' },
  ];

  const handleAction = (idx, action) => {
    setActionStates(prev => ({ ...prev, [idx]: action }));
    setTimeout(() => {
      setActionStates(prev => ({ ...prev, [idx]: null }));
    }, 1500);
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
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Pending Requests" 
            value="4" 
            icon={<Clock />} 
            color="bg-yellow-50 text-yellow-600" 
            trend="+10%"
          />
          <StatCard 
            label="Active Patients" 
            value="6" 
            icon={<Users />} 
            color="bg-blue-50 text-primary" 
            trend="+18%"
          />
          <StatCard 
            label="Completed Services" 
            value="23" 
            icon={<CheckCircle />} 
            color="bg-green-50 text-green-600" 
            trend="+25%"
          />
        </motion.div>

        {/* Today's Schedule */}
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
              <p className="text-blue-200 font-semibold text-sm">Today's Schedule</p>
            </div>
            <div className="space-y-3">
              {todaySchedule.map((appt, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="text-lg font-bold">{appt.time}</p>
                  </div>
                  <div className="w-px h-10 bg-white/20" />
                  <div>
                    <p className="font-bold">{appt.patient}</p>
                    <p className="text-blue-200 text-sm">{appt.service}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Incoming Requests Table */}
        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Incoming Requests</h3>
            <button className="text-primary font-semibold text-sm hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Service Needed</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
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
                    <td className="px-6 py-4 font-semibold text-slate-700">{req.patient}</td>
                    <td className="px-6 py-4 text-slate-600">{req.service}</td>
                    <td className="px-6 py-4 text-slate-600">{req.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <motion.button 
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            actionStates[idx] === 'accepted' 
                              ? 'bg-green-500 text-white' 
                              : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                          }`}
                          onClick={() => handleAction(idx, 'accepted')}
                          whileTap={{ scale: 0.9 }}
                          animate={actionStates[idx] === 'accepted' ? { scale: [1, 1.2, 1] } : {}}
                        >
                          <Check className="w-5 h-5" />
                        </motion.button>
                        <motion.button 
                          className={`p-2 rounded-xl transition-all shadow-sm ${
                            actionStates[idx] === 'rejected' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
                          }`}
                          onClick={() => handleAction(idx, 'rejected')}
                          whileTap={{ scale: 0.9 }}
                          animate={actionStates[idx] === 'rejected' ? { scale: [1, 1.2, 1] } : {}}
                        >
                          <X className="w-5 h-5" />
                        </motion.button>
                      </div>
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

export default ProviderDashboard;
