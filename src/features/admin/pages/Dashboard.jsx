import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, Label 
} from 'recharts';
import { DateRangePicker, SkeletonPage } from '@/shared/ui';
import useCountUp from '@/hooks/useCountUp';
import { supabase } from '@/lib/supabase';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const StatCard = ({ label, value, colorClass, borderAccent, subtitle }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1400, false);
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`neu-flat-sm rounded-2xl sm:rounded-[1.25rem] p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-all border-l-4 ${borderAccent} bg-white/40 dark:bg-slate-900/30`}
    >
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-bold tracking-wide truncate">
          {label}
        </p>
        <p className={`text-2xl sm:text-3xl md:text-4xl font-display font-black tracking-tight mt-1.5 leading-none ${colorClass}`} ref={ref}>
          {count}
        </p>
      </div>
      {subtitle && (
        <p className="text-3xs text-slate-400 dark:text-slate-500 font-semibold mt-2.5 truncate">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="neu-flat px-4 py-2.5 rounded-2xl border border-white/80 dark:border-white/10 shadow-xl bg-[#ebf1f8]/95 dark:bg-[#172236]/95 backdrop-blur-md z-50">
        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span>{p.name}: <span className="font-mono font-black" style={{ color: p.color }}>{p.value}</span></span>
          </div>
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
          { name: 'Providers', value: providerCount || 0, color: '#38bdf8' },
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
      <div className="space-y-6 md:space-y-8 pb-10">
        
        {/* Unified Header & Analytics Master Card */}
        <section className="neu-flat p-5 sm:p-7 md:p-8 rounded-2xl sm:rounded-[2.25rem] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-black tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
                Platform Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Live overview of healthcare metrics, services, and community operations.
              </p>
            </div>

            <div className="shrink-0">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }}
              />
            </div>
          </div>

          {/* Stat Cards Row Inside Header */}
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 pt-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <StatCard 
              label="Total Patients" 
              value={stats.totalPatients} 
              colorClass="text-primary" 
              borderAccent="border-primary" 
              subtitle="Registered residents"
            />
            <StatCard 
              label="Total Providers" 
              value={stats.totalProviders} 
              colorClass="text-sky-500" 
              borderAccent="border-sky-500" 
              subtitle="Healthcare pros"
            />
            <StatCard 
              label="Total Requests" 
              value={stats.totalRequests} 
              colorClass="text-amber-500" 
              borderAccent="border-amber-500" 
              subtitle="All-time bookings"
            />
            <StatCard 
              label="Pending Approvals" 
              value={stats.pendingApprovals} 
              colorClass="text-rose-500" 
              borderAccent="border-rose-500" 
              subtitle="Awaiting verification"
            />
          </motion.div>
        </section>

        {/* Charts Row */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          {/* Bar Chart - Neumorphic Pillar Style */}
          <div className="neu-flat rounded-3xl p-5 sm:p-6 md:p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">Requests Per Month</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Service booking volume</p>
              </div>
            </div>

            <div className="neu-inset rounded-2xl p-3 sm:p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barSize={26}>
                  <defs>
                    {/* Neumorphic 3D Bar Gradient */}
                    <linearGradient id="neuBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                      <stop offset="60%" stopColor="#1E6FBF" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0e3a6c" stopOpacity={0.85} />
                    </linearGradient>
                    <filter id="neuBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1E6FBF" floodOpacity="0.35" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(30, 111, 191, 0.05)', radius: 12 }} />
                  <Bar dataKey="requests" fill="url(#neuBarGrad)" radius={[12, 12, 6, 6]} filter="url(#neuBarGlow)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart - Neumorphic Beveled Donut */}
          <div className="neu-flat rounded-3xl p-5 sm:p-6 md:p-7 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">User Distribution</h3>
                <p className="text-3xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Patients vs. Providers ratio</p>
              </div>
            </div>

            <div className="neu-inset rounded-2xl p-3 sm:p-4 h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    <linearGradient id="patientPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1E6FBF" />
                    </linearGradient>
                    <linearGradient id="providerPieGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                    <filter id="neuPieShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.18" />
                    </filter>
                    {/* Filter for center hub disc */}
                    <filter id="hubShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.12" />
                    </filter>
                  </defs>

                  {/* Centered SVG Hub Base Ring */}
                  <Pie 
                    data={pieChartData} 
                    cx="50%" 
                    cy="45%" 
                    innerRadius={54} 
                    outerRadius={86} 
                    paddingAngle={6} 
                    cornerRadius={8}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={2}
                    filter="url(#neuPieShadow)"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? "url(#patientPieGrad)" : "url(#providerPieGrad)"} 
                      />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        const { cx, cy } = viewBox || {};
                        if (!cx || !cy) return null;
                        return (
                          <g pointerEvents="none">
                            <circle
                              cx={cx}
                              cy={cy}
                              r={44}
                              className="fill-[#e8f0f8] dark:fill-[#1b263b] stroke-white/80 dark:stroke-white/10"
                              strokeWidth={2}
                              filter="url(#hubShadow)"
                            />
                            <text
                              x={cx}
                              y={cy - 7}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-slate-400 dark:fill-slate-500 font-extrabold text-[9px] tracking-widest uppercase"
                            >
                              TOTAL
                            </text>
                            <text
                              x={cx}
                              y={cy + 10}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-slate-900 dark:fill-white font-display font-black text-sm"
                            >
                              {(stats.totalPatients + stats.totalProviders) || 0}
                            </text>
                          </g>
                        );
                      }}
                      position="center"
                    />
                  </Pie>

                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom"
                    formatter={(value) => <span className="text-slate-700 dark:text-slate-200 font-bold text-xs">{value}</span>} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        {/* User Growth - Neumorphic Glowing Area / Wave Chart */}
        <motion.div
          className="neu-flat rounded-3xl p-5 sm:p-6 md:p-7"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">User Growth (12 Months)</h3>
              <p className="text-3xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Community onboarding trajectory</p>
            </div>
          </div>

          <div className="neu-inset rounded-2xl p-3 sm:p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthChartData}>
                <defs>
                  {/* Patients Area Gradient */}
                  <linearGradient id="patientAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E6FBF" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#1E6FBF" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Providers Area Gradient */}
                  <linearGradient id="providerAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Total Area Gradient */}
                  <linearGradient id="totalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <filter id="neuLineGlow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="patients" 
                  stroke="#1E6FBF" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#patientAreaGrad)" 
                  name="Patients" 
                  dot={{ r: 3, fill: '#1E6FBF', stroke: '#fff', strokeWidth: 1.5 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="providers" 
                  stroke="#38bdf8" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#providerAreaGrad)" 
                  name="Providers" 
                  dot={{ r: 3, fill: '#38bdf8', stroke: '#fff', strokeWidth: 1.5 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#10B981" 
                  strokeWidth={3.5} 
                  fillOpacity={1} 
                  fill="url(#totalAreaGrad)" 
                  name="Total Users" 
                  dot={{ r: 3.5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bottom Row: Recent Activity + Top Providers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          
          {/* Recent Activity Card */}
          <motion.div
            className="neu-flat rounded-3xl overflow-hidden p-5 sm:p-6 flex flex-col justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/60 dark:border-white/5">
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">Recent Service Requests</h3>
              <span className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Latest 5</span>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-slate-200/50 dark:divide-white/5 mt-2">
              {recentActivity.length > 0 ? recentActivity.map((act, idx) => (
                <div key={idx} className="py-3.5 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">{act.user}</p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold truncate">{act.action}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider shrink-0 ${
                      act.status === 'Completed' ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400' :
                      act.status === 'Accepted' ? 'neu-flat-sm text-blue-600 dark:text-blue-400' :
                      act.status === 'Pending' ? 'neu-flat-sm text-amber-600 dark:text-amber-400' :
                      'neu-flat-sm text-rose-600 dark:text-rose-400'
                    }`}>
                      {act.status}
                    </span>
                  </div>
                  <p className="text-3xs text-slate-400 font-mono font-medium">{act.date}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-400 text-center py-8">No recent activity.</p>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-white/5 text-slate-400 dark:text-slate-500 text-3xs font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-2">Patient</th>
                    <th className="py-3 px-2">Action</th>
                    <th className="py-3 px-2">Date & Time</th>
                    <th className="py-3 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                  {recentActivity.length > 0 ? recentActivity.map((act, idx) => (
                    <tr key={idx} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">{act.user}</td>
                      <td className="py-3 px-2 font-medium text-slate-600 dark:text-slate-300">{act.action}</td>
                      <td className="py-3 px-2 font-mono text-3xs text-slate-400">{act.date}</td>
                      <td className="py-3 px-2 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider ${
                          act.status === 'Completed' ? 'neu-flat-sm text-emerald-600 dark:text-emerald-400' :
                          act.status === 'Accepted' ? 'neu-flat-sm text-blue-600 dark:text-blue-400' :
                          act.status === 'Pending' ? 'neu-flat-sm text-amber-600 dark:text-amber-400' :
                          'neu-flat-sm text-rose-600 dark:text-rose-400'
                        }`}>
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400">No recent activity.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Top Providers Card */}
          <motion.div
            className="neu-flat rounded-3xl overflow-hidden p-5 sm:p-6 flex flex-col justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/60 dark:border-white/5">
              <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Top Rated Providers
              </h3>
              <span className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Top 5</span>
            </div>

            {/* Mobile View */}
            <div className="block md:hidden divide-y divide-slate-200/50 dark:divide-white/5 mt-2">
              {topProviders.length > 0 ? topProviders.map((p, idx) => (
                <div key={idx} className="py-3.5 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-2xs text-slate-500 dark:text-slate-400 font-semibold">{p.services.slice(0, 2).join(', ')}</p>
                    </div>
                    <span className="neu-flat-sm px-2 py-0.5 rounded-lg flex items-center gap-1 text-amber-500 font-black text-2xs">
                      ★ {Number(p.rating).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="neu-inset flex-1 h-2 rounded-full overflow-hidden p-0.5">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.trust_score}%` }} />
                    </div>
                    <span className="text-3xs font-bold font-mono text-slate-500 dark:text-slate-400">{p.trust_score}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 text-center py-8">No providers yet.</p>
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto mt-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/60 dark:border-white/5 text-slate-400 dark:text-slate-500 text-3xs font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-2">Provider</th>
                    <th className="py-3 px-2">Specialties</th>
                    <th className="py-3 px-2">Rating</th>
                    <th className="py-3 px-2 text-right">Trust Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-white/5">
                  {topProviders.length > 0 ? topProviders.map((p, idx) => (
                    <tr key={idx} className="hover:bg-primary/5 transition-colors">
                      <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-300 font-medium text-2xs">{p.services.slice(0, 2).join(', ')}</td>
                      <td className="py-3 px-2">
                        <span className="neu-flat-sm px-2 py-0.5 rounded-lg inline-flex items-center gap-1 text-amber-500 font-black text-2xs">
                          ★ {Number(p.rating).toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="inline-flex items-center gap-2 justify-end w-28">
                          <div className="neu-inset flex-1 h-2 rounded-full overflow-hidden p-0.5">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${p.trust_score}%` }} />
                          </div>
                          <span className="text-3xs font-mono font-bold text-slate-500 dark:text-slate-400">{p.trust_score}%</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400">No providers yet.</td>
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
