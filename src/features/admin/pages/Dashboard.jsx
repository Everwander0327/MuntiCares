import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { motion } from 'framer-motion';
import { SlidersHorizontal, ChevronRight, Star } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LabelList,
} from 'recharts';
import { DateRangePicker, SkeletonPage } from '@/shared/ui';
import { supabase } from '@/lib/supabase';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';
import BentoStatCard from '../components/BentoStatCard';
import DashboardDetailSheet from '../components/DashboardDetailSheet';
import {
  getInitials,
  computeUserShares,
  buildSparklinePoints,
  computeBookingMomentum,
  getPeakBookingMonth,
  getStatusBadgeClass,
  formatRangeSubtitle,
} from '../utils/dashboardMetrics';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PRESET_BUTTONS = [
  { key: '30D', label: '30D' },
  { key: '6M', label: '6M' },
  { key: 'ALL', label: 'ALL' },
];

const SERIES_OPTIONS = [
  { key: 'total', label: 'Total', color: 'var(--chart-5)' },
  { key: 'patients', label: 'Patients', color: 'var(--chart-1)' },
  { key: 'providers', label: 'Pros', color: 'var(--chart-4)' },
];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="neu-flat px-3.5 py-2.5 rounded-2xl border border-white/80 dark:border-white/10 shadow-xl bg-surface-shell/95 backdrop-blur-md z-popover">
      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider mb-1">
        {label}
      </p>
      {payload.map((entry, idx) => (
        <div
          key={`${entry.name || entry.dataKey}-${idx}`}
          className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>
            {entry.name}:{' '}
            <span className="font-mono font-black" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalProviders: 0,
    totalRequests: 0,
    pendingApprovals: 0,
  });
  const [barChartData, setBarChartData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [growthChartData, setGrowthChartData] = useState([]);
  const [topProviders, setTopProviders] = useState([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('ALL');
  const [growthWindow, setGrowthWindow] = useState('6M');
  const [visibleSeries, setVisibleSeries] = useState({
    total: true,
    patients: true,
    providers: true,
  });
  const [activeSheet, setActiveSheet] = useState(null);

  const applyPreset = useCallback((presetKey) => {
    const now = new Date();
    if (presetKey === '30D') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setStartDate(toLocalDateKey(start));
      setEndDate(toLocalDateKey(now));
      setActivePreset('30D');
      return;
    }

    if (presetKey === '6M') {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      setStartDate(toLocalDateKey(start));
      setEndDate(toLocalDateKey(now));
      setActivePreset('6M');
      return;
    }

    setStartDate('');
    setEndDate('');
    setActivePreset('ALL');
  }, []);

  const handleRangeChange = useCallback(({ start, end }) => {
    setStartDate(start || '');
    setEndDate(end || '');
    setActivePreset(start || end ? 'CUSTOM' : 'ALL');
  }, []);

  const handleResetRange = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setActivePreset('ALL');
  }, []);

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const [
          { count: patientCount },
          { count: providerCount },
          { count: requestCount },
          { count: pendingApprovalCount },
          { data: requests },
          { data: allUsers },
          { data: providersData },
        ] = await Promise.all([
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'patient'),
          supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'provider'),
          supabase
            .from('requests')
            .select('*', { count: 'exact', head: true }),
          supabase
            .from('providers')
            .select('*', { count: 'exact', head: true })
            .eq('is_profile_complete', true)
            .eq('is_approved', false),
          supabase
            .from('requests')
            .select('id, created_at, date, time, notes, service, status, patient:patient_id(full_name), provider:provider_id(full_name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('users')
            .select('role, created_at'),
          supabase
            .from('providers')
            .select('*, user:user_id(full_name)')
            .eq('is_approved', true)
            .order('rating', { ascending: false })
            .limit(5),
        ]);

        if (!active) return;

        const startBoundary = startDate ? parseLocalDate(startDate) : null;
        if (startBoundary) startBoundary.setHours(0, 0, 0, 0);
        const endBoundary = endDate ? parseLocalDate(endDate) : null;
        if (endBoundary) endBoundary.setHours(23, 59, 59, 999);

        const filteredRequests = (requests || []).filter((req) => {
          const ts = new Date(req.created_at).getTime();
          if (startBoundary && ts < startBoundary.getTime()) return false;
          if (endBoundary && ts > endBoundary.getTime()) return false;
          return true;
        });

        setStats({
          totalPatients: patientCount || 0,
          totalProviders: providerCount || 0,
          totalRequests: startDate || endDate ? filteredRequests.length : requestCount || 0,
          pendingApprovals: pendingApprovalCount || 0,
        });

        const now = new Date();
        const monthlyCounts = {};
        for (let i = 5; i >= 0; i -= 1) {
          const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthlyCounts[`${MONTH_NAMES[d2.getMonth()]} ${d2.getFullYear()}`] = 0;
        }

        filteredRequests.forEach((req) => {
          const rd = new Date(req.created_at);
          const key = `${MONTH_NAMES[rd.getMonth()]} ${rd.getFullYear()}`;
          if (monthlyCounts[key] !== undefined) {
            monthlyCounts[key] += 1;
          }
        });

        setBarChartData(
          Object.keys(monthlyCounts).map((key) => ({
            month: key.split(' ')[0],
            requests: monthlyCounts[key],
          }))
        );

        const activity = filteredRequests.slice(0, 5).map((req, idx) => {
          const scheduledParts = [req.date, req.time].filter(Boolean);
          return {
            id: req.id || `req-${idx}`,
            user: req.patient?.full_name || 'Unknown',
            service: req.service || 'Healthcare Visit',
            action: `Requested ${req.service || 'Healthcare Visit'}`,
            date: new Date(req.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            scheduledLabel: scheduledParts.length > 0 ? scheduledParts.join(' • ') : null,
            providerName: req.provider?.full_name || null,
            notes: req.notes || '',
            status: req.status || 'Pending',
          };
        });
        setRecentActivity(activity);

        const growthMap = {};
        for (let i = 11; i >= 0; i -= 1) {
          const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${MONTH_NAMES[d2.getMonth()]} ${d2.getFullYear()}`;
          growthMap[key] = {
            month: MONTH_NAMES[d2.getMonth()],
            patients: 0,
            providers: 0,
            total: 0,
          };
        }

        (allUsers || []).forEach((u) => {
          const ud = new Date(u.created_at);
          const key = `${MONTH_NAMES[ud.getMonth()]} ${ud.getFullYear()}`;
          if (growthMap[key]) {
            growthMap[key].total += 1;
            if (u.role === 'patient') growthMap[key].patients += 1;
            if (u.role === 'provider') growthMap[key].providers += 1;
          }
        });

        setGrowthChartData(Object.values(growthMap));

        const top = (providersData || []).map((p, index) => ({
          id: p.id || p.user_id || `prov-${index}`,
          name: p.user?.full_name || 'Unknown',
          rating: p.rating || 0,
          trust_score: p.trust_score || 0,
          services: Array.isArray(p.services) ? p.services : [],
        }));
        setTopProviders(top);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  const { patientShare, providerShare } = useMemo(
    () => computeUserShares(stats.totalPatients, stats.totalProviders),
    [stats.totalPatients, stats.totalProviders]
  );

  const patientSpark = useMemo(
    () => buildSparklinePoints(growthChartData.slice(-6).map((d) => d.patients)),
    [growthChartData]
  );

  const providerSpark = useMemo(
    () => buildSparklinePoints(growthChartData.slice(-6).map((d) => d.providers)),
    [growthChartData]
  );

  const requestSpark = useMemo(
    () => buildSparklinePoints(barChartData.map((d) => d.requests)),
    [barChartData]
  );

  const bookingMomentum = useMemo(() => computeBookingMomentum(barChartData), [barChartData]);
  const peakBookingLabel = useMemo(() => getPeakBookingMonth(barChartData), [barChartData]);
  const rangeSubtitle = useMemo(
    () => formatRangeSubtitle(startDate, endDate, activePreset),
    [startDate, endDate, activePreset]
  );

  const visibleGrowthData = useMemo(
    () => (growthWindow === '6M' ? growthChartData.slice(-6) : growthChartData),
    [growthChartData, growthWindow]
  );

  const toggleSeries = useCallback((seriesKey) => {
    setVisibleSeries((prev) => ({
      ...prev,
      [seriesKey]: !prev[seriesKey],
    }));
  }, []);

  const hasCustomFilter = Boolean(startDate || endDate);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-5 sm:space-y-6 pb-10">
        {/* Compact Header Strip */}
        <header className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-black tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white truncate">
              Platform Analytics
            </h1>
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-tertiary mt-1">
              <span className="w-2 h-2 rounded-full bg-success dark:bg-success-dark shrink-0" aria-hidden="true" />
              <span className="truncate">{rangeSubtitle}</span>
            </p>
          </div>

          {/* Mobile Compact Filter Trigger */}
          <button
            type="button"
            onClick={() => setActiveSheet({ type: 'filter' })}
            className="lg:hidden neu-btn min-h-[44px] px-3.5 rounded-xl inline-flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100 shrink-0 cursor-pointer relative"
            aria-label="Open date range filter"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-link" />
            <span>Filter</span>
            {hasCustomFilter && (
              <span
                className="w-2 h-2 rounded-full bg-link"
                aria-label="Date filter active"
              />
            )}
          </button>

          {/* Desktop Preset Segmented Control + Date Picker */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <div className="neu-inset p-1 rounded-xl inline-flex items-center gap-1" role="group" aria-label="Timeframe presets">
              {PRESET_BUTTONS.map((preset) => {
                const isActive = activePreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key)}
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      isActive
                        ? 'neu-btn-primary text-white dark:text-[#08182A]'
                        : 'text-tertiary hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleRangeChange}
            />
          </div>
        </header>

        {/* 4 Bento Sparkline KPI Tiles */}
        <motion.section
          aria-label="Key metrics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <BentoStatCard
            label="Patients"
            value={stats.totalPatients}
            tag={patientShare}
            tagClass="text-link"
            sparkPoints={patientSpark}
            sparkColor="var(--chart-1)"
            variants={staggerItem}
          />
          <BentoStatCard
            label="Providers"
            value={stats.totalProviders}
            tag={providerShare}
            tagClass="text-primary-700 dark:text-primary-300"
            sparkPoints={providerSpark}
            sparkColor="var(--chart-4)"
            variants={staggerItem}
          />
          <BentoStatCard
            label="Bookings"
            value={stats.totalRequests}
            tag={bookingMomentum}
            tagClass="text-warning dark:text-warning-dark"
            sparkPoints={requestSpark}
            sparkColor="var(--chart-2)"
            variants={staggerItem}
          />
          <BentoStatCard
            label="Approvals"
            value={stats.pendingApprovals}
            tag={stats.pendingApprovals === 0 ? 'Verified' : 'Action Req'}
            tagClass={
              stats.pendingApprovals === 0
                ? 'text-success dark:text-success-dark'
                : 'text-danger dark:text-danger-dark'
            }
            trailing={
              stats.pendingApprovals === 0 ? (
                <span className="px-2.5 py-1 rounded-lg bg-success-soft/80 dark:bg-success-darkSoft text-success dark:text-success-dark text-[11px] font-extrabold shrink-0">
                  Clear
                </span>
              ) : (
                <Link
                  to="/admin/providers"
                  className="px-2.5 py-1 rounded-lg neu-btn-primary text-white dark:text-[#08182A] text-[11px] font-extrabold shrink-0"
                >
                  Review
                </Link>
              )
            }
            variants={staggerItem}
          />
        </motion.section>

        {/* Bento Charts Row: Requests Per Month (5 cols) + User Growth (7 cols) */}
        <motion.section
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          {/* Requests Per Month BarChart */}
          <div className="lg:col-span-5 neu-flat rounded-3xl p-4 sm:p-6 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Requests Per Month
                </h2>
                <p className="text-xs text-tertiary font-semibold mt-0.5">
                  Service booking volume
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-primary-soft/85 dark:bg-primary-800/80 text-link text-[11px] font-extrabold whitespace-nowrap shrink-0">
                {peakBookingLabel}
              </span>
            </div>

            <div className="neu-inset rounded-2xl p-3 h-56 sm:h-60 min-h-[224px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={196}>
                <BarChart data={barChartData} barSize={24} margin={{ top: 20, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bentoBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.95} />
                      <stop offset="60%" stopColor="var(--chart-1)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--chart-deep)" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'rgba(30, 111, 191, 0.06)', radius: 10 }}
                  />
                  <Bar dataKey="requests" name="Requests" fill="url(#bentoBarGrad)" radius={[10, 10, 4, 4]}>
                    <LabelList
                      dataKey="requests"
                      position="top"
                      formatter={(val) => (val > 0 ? val : '')}
                      style={{ fill: 'var(--chart-4)', fontSize: 11, fontWeight: 800 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Growth AreaChart */}
          <div className="lg:col-span-7 neu-flat rounded-3xl p-4 sm:p-6 flex flex-col justify-between">
            <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  User Growth ({growthWindow === '6M' ? '6 Months' : '12 Months'})
                </h2>
                <p className="text-xs text-tertiary font-semibold mt-0.5">
                  Community onboarding trajectory
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGrowthWindow((prev) => (prev === '6M' ? '12M' : '6M'))}
                className="neu-btn min-h-[34px] px-3 rounded-lg text-[11px] font-extrabold text-link cursor-pointer shrink-0"
              >
                Switch to {growthWindow === '6M' ? '12M' : '6M'}
              </button>
            </div>

            {/* Interactive Series Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {SERIES_OPTIONS.map((series) => {
                const isSelected = visibleSeries[series.key];
                return (
                  <button
                    key={series.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSeries(series.key)}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 text-[11px] font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'neu-flat-sm text-slate-900 dark:text-white'
                        : 'neu-inset text-tertiary opacity-65'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: series.color }}
                    />
                    <span>{series.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="neu-inset rounded-2xl p-3 h-52 sm:h-56 min-h-[208px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={184}>
                <AreaChart data={visibleGrowthData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bentoPatientAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="bentoProviderAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="bentoTotalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {visibleSeries.patients && (
                    <Area
                      type="monotone"
                      dataKey="patients"
                      name="Patients"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#bentoPatientAreaGrad)"
                      dot={{ r: 3, fill: 'var(--chart-1)', stroke: '#fff', strokeWidth: 1.5 }}
                    />
                  )}
                  {visibleSeries.providers && (
                    <Area
                      type="monotone"
                      dataKey="providers"
                      name="Providers"
                      stroke="var(--chart-4)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#bentoProviderAreaGrad)"
                      dot={{ r: 3, fill: 'var(--chart-4)', stroke: '#fff', strokeWidth: 1.5 }}
                    />
                  )}
                  {visibleSeries.total && (
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Users"
                      stroke="var(--chart-5)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#bentoTotalAreaGrad)"
                      dot={{ r: 3.5, fill: 'var(--chart-5)', stroke: '#fff', strokeWidth: 1.5 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.section>

        {/* Bottom Bento Row: Top Rated Providers (5 cols, snap rail on mobile) + Recent Requests (7 cols) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {/* Top Rated Providers — Content-Hugging */}
          <motion.div
            className="lg:col-span-5 neu-flat rounded-3xl p-4 sm:p-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-white/60 dark:border-white/5">
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Top Rated Providers
              </h2>
              <span className="text-2xs font-extrabold uppercase tracking-widest text-tertiary">
                Top {topProviders.length > 0 ? topProviders.length : 5}
              </span>
            </div>

            {topProviders.length > 0 ? (
              <>
                {/* Mobile Horizontal Snap Rail */}
                <div className="flex lg:hidden gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pt-3.5 pb-1 -mx-1 px-1">
                  {topProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setActiveSheet({ type: 'provider', item: provider })}
                      className="snap-start shrink-0 w-[236px] text-left neu-inset rounded-2xl p-3.5 space-y-2.5 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-link font-extrabold text-[11px] flex items-center justify-center shrink-0">
                            {getInitials(provider.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                              {provider.name}
                            </p>
                            <p className="text-[11px] text-tertiary font-semibold truncate">
                              {provider.services.slice(0, 2).join(', ') || 'General Care'}
                            </p>
                          </div>
                        </div>
                        <span className="neu-flat-sm px-2 py-0.5 rounded-lg inline-flex items-center gap-1 text-warning dark:text-warning-dark font-black text-[11px] shrink-0">
                          <Star className="w-3 h-3 fill-current" />
                          {Number(provider.rating).toFixed(1)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="neu-flat-sm flex-1 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary dark:bg-primary-400"
                            style={{ width: `${Math.min(100, Math.max(0, Number(provider.trust_score) || 0))}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-tertiary tabular-nums">
                          {provider.trust_score}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Desktop Content-Hugging Card Stack */}
                <div className="hidden lg:flex lg:flex-col gap-2.5 pt-3.5">
                  {topProviders.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setActiveSheet({ type: 'provider', item: provider })}
                      className="w-full text-left neu-inset hover:bg-primary/5 rounded-2xl p-3.5 space-y-2.5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-sky-500/15 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                            {getInitials(provider.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-link transition-colors">
                              {provider.name}
                            </p>
                            <p className="text-xs text-tertiary font-semibold truncate">
                              {provider.services.slice(0, 2).join(', ') || 'General Care'}
                            </p>
                          </div>
                        </div>

                        <span className="neu-flat-sm px-2 py-0.5 rounded-lg inline-flex items-center gap-1 text-warning dark:text-warning-dark font-black text-xs shrink-0">
                          <Star className="w-3 h-3 fill-current" />
                          {Number(provider.rating).toFixed(1)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="neu-flat-sm flex-1 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary dark:bg-primary-400"
                            style={{ width: `${Math.min(100, Math.max(0, Number(provider.trust_score) || 0))}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-tertiary tabular-nums">
                          {provider.trust_score}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-tertiary text-center py-8">No approved providers yet.</p>
            )}
          </motion.div>

          {/* Recent Service Requests — Tap/Click Interactive Cards */}
          <motion.div
            className="lg:col-span-7 neu-flat rounded-3xl p-4 sm:p-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-white/60 dark:border-white/5">
              <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Recent Service Requests
              </h2>
              <span className="text-2xs font-extrabold uppercase tracking-widest text-tertiary">
                Latest 5
              </span>
            </div>

            {recentActivity.length > 0 ? (
              <div className="space-y-2.5 pt-3.5">
                {recentActivity.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActiveSheet({ type: 'request', item: act })}
                    className="w-full text-left neu-inset hover:bg-primary/5 rounded-2xl px-3.5 py-3 flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-primary/15 dark:bg-primary-400/20 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                        {getInitials(act.user)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-link transition-colors">
                          {act.user}
                        </p>
                        <p className="text-xs text-tertiary font-medium truncate">
                          {act.action} &bull; <span className="font-mono">{act.date}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getStatusBadgeClass(act.status)}`}
                      >
                        {act.status}
                      </span>
                      <ChevronRight
                        className="w-4 h-4 text-tertiary group-hover:text-link transition-colors hidden sm:block"
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-tertiary text-center py-8">No recent service requests.</p>
            )}
          </motion.div>
        </section>

        {/* Swipe-Down Filter / Detail Bottom Sheet */}
        <DashboardDetailSheet
          sheet={activeSheet}
          onClose={() => setActiveSheet(null)}
          startDate={startDate}
          endDate={endDate}
          activePreset={activePreset}
          onApplyPreset={applyPreset}
          onChangeRange={handleRangeChange}
          onResetRange={handleResetRange}
        />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
