import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Briefcase, FileText, ShieldAlert, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
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
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${color}`}>
          {React.cloneElement(icon, { className: 'w-6 h-6' })}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-50 px-2 py-1 rounded-lg">
            <TrendingUp className="w-3 h-3" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-900" ref={ref}>{count}</p>
    </motion.div>
  );
};

const barChartData = [
  { month: 'Jul', requests: 32 },
  { month: 'Aug', requests: 45 },
  { month: 'Sep', requests: 38 },
  { month: 'Oct', requests: 52 },
  { month: 'Nov', requests: 61 },
  { month: 'Dec', requests: 48 },
];

const pieChartData = [
  { name: 'Patients', value: 128, color: '#1E6FBF' },
  { name: 'Providers', value: 34, color: '#60A5FA' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100">
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-sm text-primary font-semibold">{payload[0].value} requests</p>
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const activities = [
    { user: 'Juan Dela Cruz', action: 'Requested Wound Care', date: 'Oct 24, 2:15 PM', status: 'Pending' },
    { user: 'Maria Santos', action: 'Updated Profile', date: 'Oct 24, 1:45 PM', status: 'Success' },
    { user: 'Admin', action: 'Verified Provider Jose Reyes', date: 'Oct 24, 11:30 AM', status: 'Success' },
    { user: 'Pedro Lim', action: 'New Provider Registration', date: 'Oct 24, 9:20 AM', status: 'Review' },
    { user: 'System', action: 'Automated Backup Completed', date: 'Oct 24, 3:00 AM', status: 'Success' },
  ];

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Total Patients" 
            value="128" 
            icon={<Users />} 
            color="bg-blue-50 text-primary" 
            trend="+12%"
          />
          <StatCard 
            label="Total Providers" 
            value="34" 
            icon={<Briefcase />} 
            color="bg-purple-50 text-purple-600" 
            trend="+8%"
          />
          <StatCard 
            label="Total Requests" 
            value="267" 
            icon={<FileText />} 
            color="bg-orange-50 text-orange-600" 
            trend="+22%"
          />
          <StatCard 
            label="Pending Approvals" 
            value="5" 
            icon={<ShieldAlert />} 
            color="bg-red-50 text-red-600" 
            trend="+3%"
          />
        </motion.div>

        {/* Charts Row */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Bar Chart */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Requests Per Month</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="requests" fill="#1E6FBF" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">User Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} users`, name]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9' }}
                  />
                  <Legend 
                    verticalAlign="bottom"
                    formatter={(value) => <span className="text-slate-600 font-medium text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Activity Table */}
        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
            <button className="text-primary font-semibold text-sm hover:underline">Download Log</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act, idx) => (
                  <motion.tr 
                    key={idx} 
                    className="transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-700">{act.user}</td>
                    <td className="px-6 py-4 text-slate-600">{act.action}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{act.date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        act.status === 'Success' ? 'bg-green-100 text-green-700' :
                        act.status === 'Review' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-primary'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                          act.status === 'Success' ? 'bg-green-500' :
                          act.status === 'Review' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        {act.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
