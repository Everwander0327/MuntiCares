import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Users, Briefcase, FileText, ShieldAlert, TrendingUp, Award } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import DateRangePicker from '../../components/DateRangePicker';
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
        <p className="text-slate-500 text-2xs md:text-sm font-medium mt-1 md:mt-3 leading-tight dark:text-slate-400">{label}</p>
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
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
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
  const [growthChartData, setGrowthChartData] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch counts
        const { count: patientCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'patient');

        const { count: providerCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'provider');

        const { count: requestCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true });

        const { count: pendingApprovalCount } = await supabase
          .from('providers')
          .select('*', { count: 'exact', head: true })
          .eq('is_profile_complete', true)
          .eq('is_approved', false);

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

        // Fetch requests for bar chart
        const { data: requests } = await supabase
          .from('requests')
          .select('created_at, patient:patient_id(full_name), service, status')
          .order('created_at', { ascending: false });

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyCounts = {};

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
          month: key.split(' ')[0],
          requests: monthlyCounts[key]
        }));
        setBarChartData(chartData);

        // Recent activity
        const activity = (requests || []).slice(0, 5).map(req => ({
          user: req.patient?.full_name || 'Unknown',
          action: `Requested ${req.service}`,
          date: new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          status: req.status
        }));
        setRecentActivity(activity);

        // User growth trends (last 12 months)
        const { data: allUsers } = await supabase
          .from('users')
          .select('role, created_at');

        const growthMap = {};
        for (let i = 11; i >= 0; i--) {
          const d2 = new Date(d.getFullYear(), d.getMonth() - i, 1);
          const key = `${monthNames[d2.getMonth()]} ${d2.getFullYear()}`;
          growthMap[key] = { month: monthNames[d2.getMonth()], patients: 0, providers: 0, total: 0 };
        }

        (allUsers || []).forEach(u => {
          const ud = new Date(u.created_at);
          const key = `${monthNames[ud.getMonth()]} ${ud.getFullYear()}`;
          if (growthMap[key]) {
            growthMap[key].total++;
            if (u.role === 'patient') growthMap[key].patients++;
            if (u.role === 'provider') growthMap[key].providers++;
          }
        });

        setGrowthChartData(Object.values(growthMap));

        // Top providers by rating and completed count
        const { data: providersData } = await supabase
          .from('providers')
          .select('*, user:user_id(full_name)')
          .eq('is_approved', true)
          .order('rating', { ascending: false })
          .limit(5);

        const top = (providersData || []).map(p => ({
          name: p.user?.full_name || 'Unknown',
          rating: p.rating || 0,
          trust_score: p.trust_score || 0,
          services: p.services || [],
        }));
        setTopProviders(top);

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
        {/* Header with Date Range */}
        <motion.div
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Platform analytics and overview</p>
          </div>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }}
          />
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <StatCard label="Total Patients" value={stats.totalPatients} icon={<Users />} color="bg-blue-50 text-primary dark:bg-blue-900/30" />
          <StatCard label="Total Providers" value={stats.totalProviders} icon={<Briefcase />} color="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" />
          <StatCard label="Total Requests" value={stats.totalRequests} icon={<FileText />} color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300" />
          <StatCard label="Pending Approvals" value={stats.pendingApprovals} icon={<ShieldAlert />} color="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300" />
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
                  <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom"
                    formatter={(value) => <span className="text-slate-600 font-medium text-sm dark:text-slate-200">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* User Growth */}
        <motion.div
          className="grid grid-cols-1 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50">
            <h3 className="text-lg font-bold text-slate-900 mb-6 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              User Growth (12 Months)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="patients" stroke="#1E6FBF" strokeWidth={2} dot={false} name="Patients" />
                  <Line type="monotone" dataKey="providers" stroke="#60A5FA" strokeWidth={2} dot={false} name="Providers" />
                  <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} dot={false} name="Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* Bottom Row: Recent Activity + Top Providers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <motion.div
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent Service Requests</h3>
            </div>
            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
              {recentActivity.length > 0 ? recentActivity.map((act, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{act.user}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{act.action}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${
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
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{act.date}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-400 text-center py-10 dark:text-slate-500">No recent activity.</p>
              )}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
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
                    <motion.tr key={idx} className="transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">{act.user}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{act.action}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{act.date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-semibold uppercase tracking-wider ${
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

          {/* Top Providers */}
          <motion.div
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Top Rated Providers
              </h3>
            </div>
            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
              {topProviders.length > 0 ? topProviders.map((p, idx) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                    <span className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                      ★ {Number(p.rating).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{p.services.slice(0, 2).join(', ')}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full dark:bg-slate-700">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.trust_score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{p.trust_score}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-400 text-center py-10 dark:text-slate-500">No providers yet.</p>
              )}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Services</th>
                    <th className="px-6 py-4 font-semibold">Rating</th>
                    <th className="px-6 py-4 font-semibold">Trust Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topProviders.length > 0 ? topProviders.map((p, idx) => (
                    <motion.tr key={idx} className="transition-colors"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + idx * 0.1 }}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600 text-sm dark:text-slate-300">{p.services.slice(0, 2).join(', ')}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                          ★ {Number(p.rating).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full dark:bg-slate-700">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p.trust_score}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{p.trust_score}%</span>
                        </div>
                      </td>
                    </motion.tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">No providers yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
