import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Briefcase, FileText, ShieldAlert, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import useCountUp from '../../hooks/useCountUp';
import { SkeletonPage } from '../../components/Skeleton';
import { supabase } from '../../lib/supabase';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatCard = ({ label, value, icon, color }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1500, false);
  
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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 z-50 relative dark:bg-slate-800 dark:border-slate-700">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-sm text-primary font-semibold">{payload[0].value} requests</p>
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalProviders: 0,
    totalRequests: 0,
    pendingApprovals: 0
  });
  const [barChartData, setBarChartData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch counts
        const { count: patientCount, error: err1 } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'patient');

        const { count: providerCount, error: err2 } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'provider');

        const { count: requestCount, error: err3 } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true });

        const { count: pendingApprovalCount, error: err4 } = await supabase
          .from('providers')
          .select('*', { count: 'exact', head: true })
          .eq('is_profile_complete', true)
          .eq('is_approved', false);

        if (err1 || err2 || err3 || err4) {
          console.error('Error fetching stats');
        }

        setStats({
          totalPatients: patientCount || 0,
          totalProviders: providerCount || 0,
          totalRequests: requestCount || 0,
          pendingApprovals: pendingApprovalCount || 0
        });

        setPieChartData([
          { name: 'Patients', value: patientCount || 0, color: '#1E6FBF' },
          { name: 'Providers', value: providerCount || 0, color: '#60A5FA' },
        ]);

        // Fetch requests for bar chart (aggregate by month)
        const { data: requests, error: reqErr } = await supabase
          .from('requests')
          .select('created_at, patient:patient_id(full_name), service, status')
          .order('created_at', { ascending: false });

        if (reqErr) throw reqErr;

        // Process monthly data (last 6 months)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyCounts = {};
        
        // Initialize last 6 months
        const d = new Date();
        for (let i = 5; i >= 0; i--) {
          const d2 = new Date(d.getFullYear(), d.getMonth() - i, 1);
          monthlyCounts[`${monthNames[d2.getMonth()]} ${d2.getFullYear()}`] = 0;
        }

        (requests || []).forEach(req => {
          const rd = new Date(req.created_at);
          const key = `${monthNames[rd.getMonth()]} ${rd.getFullYear()}`;
          if (monthlyCounts[key] !== undefined) {
            monthlyCounts[key]++;
          }
        });

        const chartData = Object.keys(monthlyCounts).map(key => ({
          month: key.split(' ')[0], // Just show month name
          requests: monthlyCounts[key]
        }));
        
        setBarChartData(chartData);

        // Process recent activity (last 5 requests)
        const activity = (requests || []).slice(0, 5).map(req => ({
          user: req.patient?.full_name || 'Unknown',
          action: `Requested ${req.service}`,
          date: new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          status: req.status
        }));
        setRecentActivity(activity);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 md:space-y-8">
        <motion.div 
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard 
            label="Total Patients" 
            value={stats.totalPatients} 
            icon={<Users />} 
            color="bg-blue-50 text-primary dark:bg-blue-900/30" 
          />
          <StatCard 
            label="Total Providers" 
            value={stats.totalProviders} 
            icon={<Briefcase />} 
            color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" 
          />
          <StatCard 
            label="Total Requests" 
            value={stats.totalRequests} 
            icon={<FileText />} 
            color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300" 
          />
          <StatCard 
            label="Pending Approvals" 
            value={stats.pendingApprovals} 
            icon={<ShieldAlert />} 
            color="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300" 
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
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 mb-6 dark:text-slate-100">Requests Per Month</h3>
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
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 mb-6 dark:text-slate-100">User Distribution</h3>
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
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', zIndex: 100, background: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-color, #1e293b)' }}
                  />
                  <Legend 
                    verticalAlign="bottom"
                    formatter={(value) => <span className="text-slate-600 font-medium text-sm dark:text-slate-200">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Activity Table */}
        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Service Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-semibold">Patient</th>
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.length > 0 ? recentActivity.map((act, idx) => (
                  <motion.tr 
                    key={idx} 
                    className="transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                  >
                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">{act.user}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{act.action}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{act.date}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        act.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        act.status === 'Accepted' ? 'bg-blue-100 text-blue-700' :
                        act.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                          act.status === 'Completed' ? 'bg-green-500' :
                          act.status === 'Accepted' ? 'bg-blue-500' :
                          act.status === 'Pending' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                        {act.status}
                      </span>
                    </td>
                  </motion.tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">No recent activity.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
