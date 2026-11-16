import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { MotionConfig, motion } from 'framer-motion';
import {
  SlidersHorizontal,
  CaretRight,
  Star,
  WarningCircle,
  ArrowCounterClockwise,
  CheckCircle,
} from '@phosphor-icons/react';
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
import { DateRangePicker, SkeletonPage, EmptyState } from '@/shared/ui';
import { useOptionalTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';
import BentoStatCard from '../components/BentoStatCard';
import DashboardDetailSheet from '../components/DashboardDetailSheet';
import StatusBadge from '../components/StatusBadge';
import {
  getInitials,
  computeUserShares,
  buildSparklinePoints,
  computeBookingMomentum,
  getPeakBookingMonth,
  formatRangeSubtitle,
  formatScheduledSlot,
} from '../utils/dashboardMetrics';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PRESET_BUTTON_KEYS = [
  { key: '30D', labelKey: 'admin.dashboard.preset30d' },
  { key: '6M', labelKey: 'admin.dashboard.preset6m' },
  { key: 'ALL', labelKey: 'admin.dashboard.presetAll' },
];

const SERIES_OPTION_KEYS = [
  { key: 'total', labelKey: 'admin.dashboard.seriesTotal', color: 'var(--chart-5)' },
  { key: 'patients', labelKey: 'admin.dashboard.seriesPatients', color: 'var(--chart-1)' },
  { key: 'providers', labelKey: 'admin.dashboard.seriesProviders', color: 'var(--chart-4)' },
];

const EASE_FLUID = [0.32, 0.72, 0, 1];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_FLUID } },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="neu-flat px-3.5 py-2.5 rounded-2xl border border-surface-border shadow-card bg-surface-shell z-popover">
      <p className="text-xs font-extrabold text-ink dark:text-txt-darkPrimary uppercase tracking-wider mb-1">
        {label}
      </p>
      {payload.map((entry, idx) => (
        <div
          key={`${entry.name || entry.dataKey}-${idx}`}
          className="flex items-center gap-2 text-xs font-bold text-txt-secondary dark:text-txt-darkSecondary"
        >
          <span
            className="w-3 h-0.5 shrink-0"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          />
          <span>
            {entry.name}:{' '}
            <span className="font-mono font-extrabold tabular-nums" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const theme = useOptionalTheme();
  const { t, language, formatDate, translateService } = useLanguage();
  const uiScale = theme?.uiScale ?? 1;
  const chartTickFontSize = Number((12 * uiScale).toFixed(1));
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
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
      setFetchError(null);
      try {
        const [
          { count: patientCount, error: patientErr },
          { count: providerCount, error: providerErr },
          { count: requestCount, error: requestErr },
          { count: pendingApprovalCount, error: pendingErr },
          { data: requests, error: requestsErr },
          { data: allUsers, error: usersErr },
          { data: providersData, error: providersErr },
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

        const queryError =
          patientErr ||
          providerErr ||
          requestErr ||
          pendingErr ||
          requestsErr ||
          usersErr ||
          providersErr;
        if (queryError) {
          throw queryError;
        }

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
        if (startBoundary || endBoundary) {
          const rangeEnd = endBoundary
            ? new Date(endBoundary.getFullYear(), endBoundary.getMonth(), 1)
            : new Date(now.getFullYear(), now.getMonth(), 1);
          const minAllowedStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - 11, 1);
          const rawStart = startBoundary
            ? new Date(startBoundary.getFullYear(), startBoundary.getMonth(), 1)
            : new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - 5, 1);
          const cursor = rawStart < minAllowedStart ? minAllowedStart : rawStart;

          while (cursor <= rangeEnd) {
            monthlyCounts[`${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`] = 0;
            cursor.setMonth(cursor.getMonth() + 1);
          }
        } else {
          for (let i = 5; i >= 0; i -= 1) {
            const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthlyCounts[`${MONTH_NAMES[d2.getMonth()]} ${d2.getFullYear()}`] = 0;
          }
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

        const activity = filteredRequests.slice(0, 5).map((req, idx) => ({
          id: req.id || `req-${idx}`,
          user: req.patient?.full_name || t('admin.providers.unknownName'),
          service: req.service || '',
          created_at: req.created_at,
          rawDate: req.date,
          rawTime: req.time,
          action: `Requested ${req.service || 'Healthcare Visit'}`,
          date: new Date(req.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          scheduledLabel: formatScheduledSlot(req.date, req.time),
          providerName: req.provider?.full_name || null,
          notes: req.notes || '',
          status: req.status || 'Pending',
        }));
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
        if (active) {
          setFetchError(err?.message || 'Unable to load platform analytics right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      active = false;
    };
  }, [startDate, endDate, reloadKey, t]);

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

  const bookingMomentum = useMemo(() => computeBookingMomentum(barChartData, language), [barChartData, language]);
  const peakBookingLabel = useMemo(() => getPeakBookingMonth(barChartData, language), [barChartData, language]);
  const rangeSubtitle = useMemo(
    () => formatRangeSubtitle(startDate, endDate, activePreset, language),
    [startDate, endDate, activePreset, language]
  );

  const localizedRecentActivity = useMemo(
    () =>
      recentActivity.map((act) => {
        const localizedService = act.service
          ? translateService(act.service)
          : t('admin.dashboard.healthcareVisit');
        const localizedDate = act.created_at
          ? formatDate(act.created_at, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : act.date;
        const localizedScheduled = act.rawDate
          ? formatScheduledSlot(act.rawDate, act.rawTime, language)
          : act.scheduledLabel;
        return {
          ...act,
          action: t('admin.dashboard.requestedAction', { service: localizedService }),
          date: localizedDate,
          scheduledLabel: localizedScheduled,
        };
      }),
    [recentActivity, t, formatDate, translateService, language]
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

  if (fetchError) {
    return (
      <DashboardLayout role="admin">
        <div className="neu-flat rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-danger-soft dark:bg-danger-darkSoft text-danger dark:text-danger-dark flex items-center justify-center">
            <WarningCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display font-bold text-xl text-ink dark:text-txt-darkPrimary">
            {t('admin.dashboard.title')}
          </h1>
          <p className="text-sm text-txt-secondary dark:text-txt-darkSecondary max-w-sm">
            {fetchError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            className="neu-btn-primary min-h-[2.75rem] px-5 rounded-2xl inline-flex items-center gap-2 text-xs font-extrabold cursor-pointer"
          >
            <ArrowCounterClockwise className="w-4 h-4" aria-hidden="true" />
            {t('admin.dashboard.retry')}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <MotionConfig reducedMotion="user">
        <div className="space-y-5 sm:space-y-6 pb-10">
          {/* Compact Header Strip */}
          <header className="flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display font-black tracking-tight text-xl sm:text-2xl md:text-3xl text-ink dark:text-txt-darkPrimary truncate">
                {t('admin.dashboard.title')}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-tertiary mt-1 truncate">
                <span>{rangeSubtitle}</span>
                {activePreset !== 'ALL' && (
                  <span className="font-medium">{t('admin.dashboard.bookingsFilteredNote')}</span>
                )}
              </p>
            </div>

            {/* Mobile Compact Filter Trigger */}
            <button
              type="button"
              onClick={() => setActiveSheet({ type: 'filter' })}
              className={`lg:hidden neu-btn min-h-[2.75rem] px-3.5 rounded-2xl inline-flex items-center gap-2 text-xs font-extrabold shrink-0 cursor-pointer relative ${
                hasCustomFilter
                  ? 'border-primary/40 text-link'
                  : 'text-ink dark:text-txt-darkPrimary'
              }`}
              aria-label={hasCustomFilter ? t('admin.dashboard.filterActiveAria') : t('admin.dashboard.filterAria')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-link" aria-hidden="true" />
              <span>{t('admin.dashboard.filterBtn')}</span>
            </button>

            {/* Desktop Unified Timeframe Bar */}
            <div
              className="hidden lg:inline-flex items-center gap-1 rounded-2xl border border-surface-border bg-surface-subtle/70 p-1 shrink-0"
              role="group"
              aria-label={t('admin.dashboard.presetsAria')}
            >
              {PRESET_BUTTON_KEYS.map((preset) => {
                const isActive = activePreset === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset.key)}
                    aria-pressed={isActive}
                    className={`min-h-[2.75rem] px-3.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      isActive
                        ? 'neu-btn-primary text-white dark:text-neu-fg'
                        : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                    }`}
                  >
                    {t(preset.labelKey)}
                  </button>
                );
              })}

              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleRangeChange}
                idleLabel={t('admin.dashboard.customRange')}
                showSelectedRange={activePreset === 'CUSTOM'}
                isActive={activePreset === 'CUSTOM'}
                showClearButton={activePreset === 'CUSTOM'}
                triggerClassName={`min-h-[2.75rem] px-3.5 rounded-xl inline-flex items-center gap-2 text-xs font-extrabold transition-all cursor-pointer ${
                  activePreset === 'CUSTOM'
                    ? 'neu-btn-primary text-white dark:text-neu-fg'
                    : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                }`}
              />
            </div>
          </header>

          {/* 4 Bento Sparkline KPI Tiles */}
          <motion.section
            aria-label={t('admin.dashboard.keyMetricsAria')}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <BentoStatCard
              label={t('admin.dashboard.kpiPatients')}
              value={stats.totalPatients}
              tag={patientShare}
              tagClass="text-link"
              sparkPoints={patientSpark}
              sparkColor="var(--chart-1)"
              to="/admin/patients"
              variants={staggerItem}
            />
            <BentoStatCard
              label={t('admin.dashboard.kpiProviders')}
              value={stats.totalProviders}
              tag={providerShare}
              tagClass="text-primary-700 dark:text-primary-300"
              sparkPoints={providerSpark}
              sparkColor="var(--chart-4)"
              to="/admin/providers"
              variants={staggerItem}
            />
            <BentoStatCard
              label={t('admin.dashboard.kpiBookings')}
              value={stats.totalRequests}
              tag={bookingMomentum}
              tagClass="text-warning dark:text-warning-dark"
              sparkPoints={requestSpark}
              sparkColor="var(--chart-2)"
              to="/admin/requests"
              variants={staggerItem}
            />
            <BentoStatCard
              label={t('admin.dashboard.kpiApprovals')}
              value={stats.pendingApprovals}
              tag={stats.pendingApprovals === 0 ? t('admin.dashboard.approvalsClearTag') : t('admin.dashboard.approvalsActionTag')}
              tagClass={
                stats.pendingApprovals === 0
                  ? 'text-success dark:text-success-dark'
                  : 'text-danger dark:text-danger-dark'
              }
              to="/admin/providers"
              trailing={
                stats.pendingApprovals === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-success dark:text-success-dark text-xs font-extrabold shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {t('admin.dashboard.approvalsClear')}
                  </span>
                ) : (
                  <span className="min-h-[2.25rem] px-3 rounded-xl inline-flex items-center neu-btn-primary text-white dark:text-neu-fg text-xs font-extrabold shrink-0">
                    {t('admin.dashboard.approvalsReview')}
                  </span>
                )
              }
              variants={staggerItem}
            />
          </motion.section>

          {/* Bento Charts Row: Requests Per Month (5 cols) + User Growth (7 cols) */}
          <motion.section
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08, ease: EASE_FLUID }}
          >
            {/* Requests Per Month BarChart */}
            <div className="lg:col-span-5 neu-flat rounded-3xl p-4 sm:p-6 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-display font-bold text-sm sm:text-base text-ink dark:text-txt-darkPrimary">
                    {t('admin.dashboard.requestsPerMonth')}
                  </h2>
                  <p className="text-xs text-tertiary font-semibold mt-0.5">
                    {activePreset === '30D'
                      ? t('admin.dashboard.bookingsLast30')
                      : activePreset === '6M'
                        ? t('admin.dashboard.bookingsLast6m')
                        : activePreset === 'CUSTOM'
                          ? t('admin.dashboard.bookingsSelectedRange')
                          : t('admin.dashboard.bookingVolume')}
                  </p>
                </div>
                <span className="text-xs font-extrabold text-link whitespace-nowrap shrink-0 tabular-nums">
                  {peakBookingLabel}
                </span>
              </div>

              <div className="h-56 sm:h-60 min-h-[14rem] pt-1">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={Math.round(196 * uiScale)}>
                  <BarChart data={barChartData} barSize={Math.round(28 * uiScale)} margin={{ top: 24, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border) / 0.7)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: chartTickFontSize, fontWeight: 700 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: chartTickFontSize, fontWeight: 700 }}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgb(var(--primary-rgb) / 0.08)', radius: 10 }}
                    />
                    <Bar dataKey="requests" name={t('admin.dashboard.barRequestsName')} fill="var(--chart-1)" radius={[8, 8, 4, 4]}>
                      <LabelList
                        dataKey="requests"
                        position="top"
                        formatter={(val) => (val > 0 ? val : '')}
                        style={{ fill: 'var(--text-link)', fontSize: chartTickFontSize, fontWeight: 800 }}
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
                  <h2 className="font-display font-bold text-sm sm:text-base text-ink dark:text-txt-darkPrimary">
                    {t('admin.dashboard.userGrowthTitle', {
                      window: growthWindow === '6M' ? t('admin.dashboard.sixMonths') : t('admin.dashboard.twelveMonths'),
                    })}
                  </h2>
                  <p className="text-xs text-tertiary font-semibold mt-0.5">
                    {t('admin.dashboard.userGrowthSubtitle')}
                  </p>
                </div>

                <div
                  className="inline-flex items-center gap-1 rounded-2xl border border-surface-border bg-surface-subtle/70 p-1 shrink-0"
                  role="group"
                  aria-label={t('admin.dashboard.userGrowthWindowAria')}
                >
                  {[
                    { key: '6M', label: t('admin.dashboard.sixMonths') },
                    { key: '12M', label: t('admin.dashboard.twelveMonths') },
                  ].map((option) => {
                    const isActive = growthWindow === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setGrowthWindow(option.key)}
                        aria-pressed={isActive}
                        className={`min-h-[2.75rem] px-3.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-surface dark:bg-surface-dark text-ink dark:text-txt-darkPrimary border border-surface-border'
                            : 'border border-transparent text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Series Filter Toggles */}
              <div className="flex flex-wrap items-center gap-4 border-b border-surface-border/70 mb-3">
                {SERIES_OPTION_KEYS.map((series) => {
                  const isSelected = visibleSeries[series.key];
                  return (
                    <button
                      key={series.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSeries(series.key)}
                      className={`min-h-[2.75rem] px-1 inline-flex items-center gap-2 text-xs font-extrabold border-b-2 -mb-px transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-primary dark:border-primary-400 text-ink dark:text-txt-darkPrimary'
                          : 'border-transparent text-tertiary opacity-65 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-3 h-0.5 shrink-0"
                        style={{ backgroundColor: series.color }}
                        aria-hidden="true"
                      />
                      <span>{t(series.labelKey)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="h-52 sm:h-56 min-h-[13rem] pt-1">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={Math.round(184 * uiScale)}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border) / 0.7)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: chartTickFontSize, fontWeight: 700 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--text-tertiary)', fontSize: chartTickFontSize, fontWeight: 700 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {visibleSeries.patients && (
                      <Area
                        type="monotone"
                        dataKey="patients"
                        name={t('admin.dashboard.seriesPatients')}
                        stroke="var(--chart-1)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#bentoPatientAreaGrad)"
                        dot={false}
                      />
                    )}
                    {visibleSeries.providers && (
                      <Area
                        type="monotone"
                        dataKey="providers"
                        name={t('admin.dashboard.seriesProviders')}
                        stroke="var(--chart-4)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#bentoProviderAreaGrad)"
                        dot={false}
                      />
                    )}
                    {visibleSeries.total && (
                      <Area
                        type="monotone"
                        dataKey="total"
                        name={t('admin.dashboard.seriesTotalUsers')}
                        stroke="var(--chart-5)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#bentoTotalAreaGrad)"
                        dot={false}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.14, ease: EASE_FLUID }}
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-surface-border">
                <h2 className="font-display font-bold text-sm sm:text-base text-ink dark:text-txt-darkPrimary">
                  {t('admin.dashboard.topProviders')}
                </h2>
                <Link
                  to="/admin/providers"
                  className="inline-flex items-center gap-1 min-h-[2.75rem] px-2 -mr-2 text-xs font-extrabold text-link hover:underline shrink-0"
                >
                  <span>{t('admin.dashboard.viewAll')}</span>
                  <CaretRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
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
                        className="snap-start shrink-0 w-[14.75rem] text-left border border-surface-border bg-surface-subtle/55 rounded-2xl p-3.5 space-y-2.5 transition-colors hover:bg-surface-subtle active:scale-[0.98] cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                              {getInitials(provider.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs text-ink dark:text-txt-darkPrimary truncate">
                                {provider.name}
                              </p>
                              <p className="text-xs text-tertiary font-semibold truncate">
                                {provider.services.slice(0, 2).map((s) => translateService(s)).join(', ') || t('admin.dashboard.generalCare')}
                              </p>
                            </div>
                          </div>
                          {Number(provider.rating) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-warning dark:text-warning-dark font-extrabold text-xs shrink-0 tabular-nums">
                              <Star weight="fill" className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                              {Number(provider.rating).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-tertiary shrink-0">
                              {t('admin.dashboard.noReviews')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-border/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary dark:bg-primary-400"
                              style={{ width: `${Math.min(100, Math.max(0, Number(provider.trust_score) || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-tertiary tabular-nums">
                            {provider.trust_score}/100
                          </span>
                          <CaretRight className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Desktop Divided List */}
                  <div className="hidden lg:flex lg:flex-col divide-y divide-surface-border/70 pt-1">
                    {topProviders.map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setActiveSheet({ type: 'provider', item: provider })}
                        className="w-full text-left py-3 px-2 -mx-2 hover:bg-surface-subtle/60 space-y-2 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                              {getInitials(provider.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-extrabold text-xs sm:text-sm text-ink dark:text-txt-darkPrimary truncate group-hover:text-link transition-colors">
                                {provider.name}
                              </p>
                              <p className="text-xs text-tertiary font-semibold truncate">
                                {provider.services.slice(0, 2).map((s) => translateService(s)).join(', ') || t('admin.dashboard.generalCare')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {Number(provider.rating) > 0 ? (
                              <span className="inline-flex items-center gap-1 text-warning dark:text-warning-dark font-extrabold text-xs tabular-nums">
                                <Star weight="fill" className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                                {Number(provider.rating).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-tertiary">
                                {t('admin.dashboard.noReviews')}
                              </span>
                            )}
                            <CaretRight
                              className="w-4 h-4 text-tertiary group-hover:text-link transition-colors"
                              aria-hidden="true"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2 rounded-full bg-surface-border/60 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary dark:bg-primary-400"
                              style={{ width: `${Math.min(100, Math.max(0, Number(provider.trust_score) || 0))}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-tertiary tabular-nums">
                            {provider.trust_score}/100
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  variant="compact"
                  icon="users"
                  title={t('admin.dashboard.noProvidersTitle')}
                  message={t('admin.dashboard.noProvidersMsg')}
                />
              )}
            </motion.div>

            {/* Recent Service Requests — Tap/Click Interactive Rows */}
            <motion.div
              className="lg:col-span-7 neu-flat rounded-3xl p-4 sm:p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18, ease: EASE_FLUID }}
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-surface-border">
                <h2 className="font-display font-bold text-sm sm:text-base text-ink dark:text-txt-darkPrimary">
                  {t('admin.dashboard.recentRequests')}
                </h2>
                <Link
                  to="/admin/requests"
                  className="inline-flex items-center gap-1 min-h-[2.75rem] px-2 -mr-2 text-xs font-extrabold text-link hover:underline shrink-0"
                >
                  <span>{t('admin.dashboard.viewAll')}</span>
                  <CaretRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>

              {localizedRecentActivity.length > 0 ? (
                <div className="divide-y divide-surface-border/70 pt-1">
                  {localizedRecentActivity.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActiveSheet({ type: 'request', item: act })}
                      className="w-full text-left py-3 px-2 -mx-2 hover:bg-surface-subtle/60 flex items-center justify-between gap-3 transition-colors cursor-pointer active:scale-[0.99] group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link font-extrabold text-xs flex items-center justify-center shrink-0">
                          {getInitials(act.user)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-extrabold text-xs sm:text-sm text-ink dark:text-txt-darkPrimary truncate group-hover:text-link transition-colors">
                            {act.user}
                          </p>
                          <p className="text-xs text-tertiary font-medium truncate">
                            {t('admin.dashboard.actionOnDate', { action: act.action })}
                            <span className="font-mono tabular-nums">{act.date}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={act.status} />
                        <CaretRight
                          className="w-4 h-4 text-tertiary group-hover:text-link transition-colors hidden sm:block"
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  variant="compact"
                  icon="activity"
                  title={t('admin.dashboard.noRecentRequestsTitle')}
                  message={t('admin.dashboard.noRecentRequestsMsg')}
                />
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
      </MotionConfig>
    </DashboardLayout>
  );
};

export default AdminDashboard;