import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  MagnifyingGlass,
  ShieldCheck,
  ShieldWarning,
  Star,
  X,
  Clock,
  DownloadSimple,
  ArrowsDownUp,
  SlidersHorizontal,
} from '@phosphor-icons/react';
import { MotionConfig } from 'framer-motion';
import { DateRangePicker, Pagination, SkeletonPage, EmptyState } from '@/shared/ui';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';
import { parseLocalDate } from '@/lib/localDate';
import { canApproveProvider } from '@/features/admin/utils/providerEligibility';
import ProviderVerificationModal from '@/features/admin/components/ProviderVerificationModal';
import ProviderFilterDrawer from '@/features/admin/components/ProviderFilterDrawer';
import {
  getIdStatusMeta,
  getProviderInitials,
  getProviderStatusClasses,
  needsProviderAction,
} from '@/features/admin/components/providerDisplay';

const PAGE_SIZE = 10;

const STATUS_TAB_KEYS = [
  { value: 'All', labelKey: 'admin.providers.tabAll' },
  { value: 'Pending Approval', labelKey: 'admin.providers.tabPending' },
  { value: 'Approved', labelKey: 'admin.providers.tabApproved' },
  { value: 'Incomplete', labelKey: 'admin.providers.tabIncomplete' },
  { value: 'Banned', labelKey: 'admin.providers.tabBanned' },
];

const SORT_LABEL_KEYS = {
  name: 'admin.providers.colProfessional',
  services: 'admin.providers.colSpecialization',
  rating: 'admin.providers.colRating',
  joinTimestamp: 'admin.providers.colJoined',
  status: 'admin.providers.colStatus',
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const getProfessionalIdUrl = (filePath) => {
  if (!filePath) return null;
  const { data } = supabase.storage.from('provider-docs').getPublicUrl(filePath);
  return data?.publicUrl || null;
};

function IdStatusBadge({ status }) {
  const { language } = useLanguage();
  const meta = getIdStatusMeta(status, language);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold ${meta.toneClass}`}>
      {status === 'verified' ? (
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : status === 'pending' ? (
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : status === 'rejected' ? (
        <X className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ShieldWarning className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{meta.label}</span>
    </span>
  );
}

function ProviderAvatar({ provider }) {
  return (
    <div className="w-11 h-11 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link overflow-hidden shrink-0">
      {provider.avatar_url ? (
        <img src={provider.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{getProviderInitials(provider.name)}</span>
      )}
    </div>
  );
}

function SortableHeader({ label, sortKey, activeSortKey, activeSortDir, onSort, className = '' }) {
  const isSorted = activeSortKey === sortKey;
  return (
    <th
      scope="col"
      aria-sort={isSorted ? (activeSortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`px-4 lg:px-5 py-3 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-tertiary hover:text-link transition-colors py-1.5 px-1 -mx-1 rounded-lg min-h-[2.75rem]"
      >
        <span>{label}</span>
        <ArrowsDownUp
          aria-hidden="true"
          className={`w-3.5 h-3.5 shrink-0 ${isSorted ? 'text-link' : 'opacity-40'}`}
        />
        {isSorted && (
          <span aria-hidden="true" className="text-link">
            {activeSortDir === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </button>
    </th>
  );
}

const AdminProviders = () => {
  const { t, formatDate, translateService, translateStatus } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [professionalIdPreviews, setProfessionalIdPreviews] = useState([]);
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [inspectedId, setInspectedId] = useState(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const fetchProviders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*, user:user_id(id, full_name, email, avatar_url, is_banned, created_at)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map((p) => {
        let status = 'Incomplete';
        if (p.user?.is_banned) {
          status = 'Banned';
        } else if (p.is_approved) {
          status = 'Approved';
        } else if (p.is_profile_complete) {
          status = 'Pending Approval';
        }

        return {
          id: p.id,
          userId: p.user_id,
          name: p.user?.full_name || 'Unknown',
          email: p.user?.email || '',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          phone: p.phone || '',
          bio: p.bio || '',
          is_profile_complete: p.is_profile_complete,
          is_approved: p.is_approved,
          is_banned: p.user?.is_banned || false,
          professional_id_path: p.professional_id_path || null,
          professional_id_paths: p.professional_id_paths || [],
          professional_id_status: p.professional_id_status || 'none',
          trust_score: p.trust_score || 0,
          avatar_url: p.user?.avatar_url || '',
          joinDate: p.user?.created_at
            ? new Date(p.user.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A',
          joinTimestamp: p.user?.created_at ? new Date(p.user.created_at).getTime() : 0,
          status,
        };
      });

      setProviders(shaped);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const paths =
      selectedProvider?.professional_id_paths && selectedProvider.professional_id_paths.length > 0
        ? selectedProvider.professional_id_paths
        : selectedProvider?.professional_id_path
          ? [selectedProvider.professional_id_path]
          : [];
    setProfessionalIdPreviews(paths.map((p) => getProfessionalIdUrl(p)).filter(Boolean));
  }, [selectedProvider]);

  const needsActionCount = useMemo(
    () => providers.filter((p) => needsProviderAction(p)).length,
    [providers]
  );

  useEffect(() => {
    if (needsActionCount === 0 && showPendingOnly) {
      setShowPendingOnly(false);
    }
  }, [needsActionCount, showPendingOnly]);

  const handleSort = (key) => {
    if (!key) {
      setSortKey('');
      setSortDir('asc');
      setCurrentPage(1);
      return;
    }
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const sortedProviders = useMemo(() => {
    if (!sortKey) {
      return [...providers].sort(
        (a, b) => Number(needsProviderAction(b)) - Number(needsProviderAction(a))
      );
    }

    return [...providers].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (Array.isArray(aVal)) aVal = aVal.join(', ');
      if (Array.isArray(bVal)) bVal = bVal.join(', ');

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = collator.compare(String(aVal), String(bVal));
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [providers, sortKey, sortDir]);

  const filteredProviders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const startBound = startDate ? parseLocalDate(startDate) : null;
    const endBound = endDate ? parseLocalDate(endDate) : null;
    if (endBound) {
      endBound.setHours(23, 59, 59, 999);
    }

    return sortedProviders.filter((p) => {
      const matchesSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query) ||
        p.services.some((s) => s.toLowerCase().includes(query));
      const matchesFilter = filter === 'All' || p.status === filter;
      const matchesPendingOnly = !showPendingOnly || needsProviderAction(p);

      let matchesDate = true;
      if (startBound) {
        matchesDate = matchesDate && p.joinTimestamp >= startBound.getTime();
      }
      if (endBound) {
        matchesDate = matchesDate && p.joinTimestamp <= endBound.getTime();
      }

      return matchesSearch && matchesFilter && matchesPendingOnly && matchesDate;
    });
  }, [sortedProviders, searchTerm, filter, showPendingOnly, startDate, endDate]);

  const totalPages = Math.ceil(filteredProviders.length / PAGE_SIZE);
  const paginatedProviders = filteredProviders.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const inspectedProvider = useMemo(
    () =>
      filteredProviders.find((p) => p.id === inspectedId) ||
      filteredProviders[0] ||
      null,
    [filteredProviders, inspectedId]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, showPendingOnly, startDate, endDate, sortKey, sortDir]);

  const activeFilterCount =
    (filter !== 'All' ? 1 : 0) + (startDate || endDate ? 1 : 0) + (sortKey ? 1 : 0);

  const sortAnnouncement = sortKey
    ? t('admin.providers.sortAnnouncement', {
        field: t(SORT_LABEL_KEYS[sortKey] || sortKey),
        direction: sortDir === 'asc' ? t('admin.providers.ascending') : t('admin.providers.descending'),
        count: filteredProviders.length,
      })
    : '';

  const formatJoinDate = (p) =>
    p?.joinTimestamp
      ? formatDate(p.joinTimestamp, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A';

  // Backend / Supabase mutations (untouched business logic)
  const handleApprove = async (provider) => {
    if (!canApproveProvider(provider)) {
      toast.error(t('admin.providers.toastIncompleteApprove'));
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: true })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(t('admin.providers.toastApproved', { name: provider.name }));
    } catch (err) {
      toast.error(t('admin.providers.toastApproveError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (provider) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: false })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(t('admin.providers.toastRevoked', { name: provider.name }));
    } catch (err) {
      toast.error(t('admin.providers.toastRevokeError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async (provider) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !provider.is_banned })
        .eq('id', provider.userId);
      if (error) throw error;

      if (!provider.is_banned) {
        await supabase.from('providers').update({ is_approved: false }).eq('user_id', provider.userId);
      }

      setSelectedProvider(null);
      await fetchProviders();
      toast.success(
        provider.is_banned
          ? t('admin.providers.toastUnbanned', { name: provider.name })
          : t('admin.providers.toastBanned', { name: provider.name })
      );
    } catch (err) {
      toast.error(
        provider.is_banned
          ? t('admin.providers.toastUnbanError')
          : t('admin.providers.toastBanError')
      );
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProfessionalIdFiles = async (provider) => {
    const paths =
      provider.professional_id_paths?.length > 0
        ? provider.professional_id_paths
        : provider.professional_id_path
          ? [provider.professional_id_path]
          : [];
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from('provider-docs').remove(paths);
    if (error) console.error('Error deleting ID files:', error);
  };

  const handleVerifyDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      await deleteProfessionalIdFiles(provider);

      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({
          professional_id_status: 'verified',
          professional_id_paths: [],
          professional_id_path: null,
          trust_score: newScore,
        })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(t('admin.providers.toastDocVerified'));
    } catch (err) {
      toast.error(t('admin.providers.toastDocVerifyError'));
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRejectDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      await deleteProfessionalIdFiles(provider);

      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({
          professional_id_status: 'rejected',
          professional_id_paths: [],
          professional_id_path: null,
          trust_score: newScore,
        })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(t('admin.providers.toastDocRejected'));
    } catch (err) {
      toast.error(t('admin.providers.toastDocRejectError'));
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRemove = async (provider) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('users').delete().eq('id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
      toast.success(t('admin.providers.toastRemoved', { name: provider.name }));
    } catch (err) {
      toast.error(t('admin.providers.toastRemoveError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    if (!filteredProviders.length) {
      toast.error(t('admin.providers.toastNoExport'));
      return;
    }
    const fields = [
      { key: 'name', label: t('admin.providers.csvFullName') },
      { key: 'email', label: t('admin.providers.csvEmail') },
      { key: 'status', label: t('admin.providers.csvStatus'), transform: (v) => translateStatus(v) },
      {
        key: 'services',
        label: t('admin.providers.csvServices'),
        transform: (v) => (Array.isArray(v) ? v.map((s) => translateService(s)).join('; ') : v),
      },
      { key: 'rating', label: t('admin.providers.csvRating') },
      { key: 'trust_score', label: t('admin.providers.csvTrustScore') },
      { key: 'joinDate', label: t('admin.providers.csvJoined') },
    ];
    const exportRows = filteredProviders.map((p) => ({
      ...p,
      joinDate: formatJoinDate(p),
    }));
    const exportable = formatDataForExport(exportRows, fields);
    exportToCSV(exportable, 'providers_export');
    toast.success(t('admin.providers.toastExported'));
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilter('All');
    setShowPendingOnly(false);
    setStartDate('');
    setEndDate('');
    setSortKey('');
    setSortDir('asc');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <MotionConfig reducedMotion="user">
        <div className="space-y-5 sm:space-y-6 pb-8">
          {/* Page Header & Global Actions */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl text-ink dark:text-txt-darkPrimary">
                {t('admin.providers.title')}
              </h1>
              <p className="text-sm text-tertiary dark:text-tertiary mt-1">
                {t('admin.providers.subtitle')}
              </p>
            </div>

            <div className="hidden lg:flex items-center gap-2.5 flex-wrap shrink-0">
              {/* Desktop 1-Click Status Filters */}
              <div
                role="group"
                aria-label={t('admin.providers.statusAria')}
                className="inline-flex items-center gap-1 h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/70 p-1 shrink-0"
              >
                {STATUS_TAB_KEYS.map((tab) => {
                  const isActive = filter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setFilter(tab.value)}
                      className={`h-full px-3.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                        isActive
                          ? 'neu-btn-primary text-white dark:text-neu-fg'
                          : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                      }`}
                    >
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
              </div>

              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={({ start, end }) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                triggerClassName={`w-full neu-btn flex items-center justify-center gap-2 px-4 h-[2.75rem] rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all ${
                  startDate || endDate
                    ? 'text-link ring-2 ring-primary/20 bg-primary/5'
                    : 'text-ink dark:text-txt-darkPrimary hover:text-link'
                }`}
              />

              <button
                type="button"
                onClick={handleExport}
                className="neu-btn px-4 h-[2.75rem] rounded-xl text-link dark:text-primary-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0"
              >
                <DownloadSimple className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('admin.providers.exportCsv')}</span>
              </button>
            </div>
          </header>

          {/* Needs Action First Smart Banner */}
          {needsActionCount > 0 && (
            <div
              role="region"
              aria-label={t('admin.providers.needsActionAria')}
              className="rounded-2xl border border-warning/30 bg-warning-soft/75 dark:bg-warning-darkSoft/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock
                  className="w-4 h-4 text-warning dark:text-warning-dark shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs sm:text-sm font-bold text-ink dark:text-txt-darkPrimary">
                  <span className="tabular-nums">{needsActionCount}</span>{' '}
                  {needsActionCount === 1 ? t('admin.providers.needsReviewSingle') : t('admin.providers.needsReviewPlural')}
                  <span className="font-medium text-tertiary dark:text-tertiary ml-1.5">
                    {t('admin.providers.needsReviewHint')}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-pressed={showPendingOnly}
                onClick={() => {
                  setShowPendingOnly((prev) => !prev);
                  setCurrentPage(1);
                }}
                className={`min-h-[2.75rem] px-4 rounded-xl text-xs font-extrabold shrink-0 transition-all ${
                  showPendingOnly
                    ? 'neu-btn-primary text-white dark:text-neu-fg'
                    : 'neu-btn text-warning dark:text-warning-dark'
                }`}
              >
                {showPendingOnly ? t('admin.providers.showAll') : t('admin.providers.showPending')}
              </button>
            </div>
          )}

          {/* Mobile / Tablet Search & Filters Bar (< lg) */}
          <div className="lg:hidden neu-flat p-4 rounded-2xl flex items-center gap-2.5">
            <div className="relative flex-1 min-w-0">
              <MagnifyingGlass
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label={t('admin.providers.searchAria')}
                placeholder={t('admin.providers.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 pl-10 pr-4 text-base sm:text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`neu-btn h-[2.75rem] px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                activeFilterCount > 0 ? 'text-link border-primary/40' : 'text-ink dark:text-txt-darkPrimary'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              <span>{activeFilterCount > 0 ? t('admin.providers.filtersCount', { count: activeFilterCount }) : t('admin.providers.filters')}</span>
            </button>
          </div>

        {/* Mobile / Tablet View (< lg): 1/2-Col Safe Cards + Pagination */}
        <div className="block lg:hidden space-y-3.5">
          {paginatedProviders.length === 0 ? (
            <div className="neu-flat p-6 rounded-2xl">
              <EmptyState
                icon="users"
                title={t('admin.providers.emptyTitle')}
                message={t('admin.providers.emptyMsg')}
                variant="compact"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {paginatedProviders.map((p) => {
                return (
                  <article
                    key={p.id}
                    className="neu-flat p-4 rounded-2xl space-y-3.5 transition-all flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start gap-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link overflow-hidden shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{getProviderInitials(p.name)}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h2 className="font-bold text-sm text-ink dark:text-txt-darkPrimary truncate">
                            {p.name}
                          </h2>
                          <p className="text-xs text-tertiary dark:text-tertiary font-medium truncate mt-0.5">
                            {p.email}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider shrink-0 ${getProviderStatusClasses(
                          p.status
                        )}`}
                      >
                        {translateStatus(p.status)}
                      </span>
                    </div>

                    {/* Specializations */}
                    {p.services.length > 0 ? (
                      <p className="text-xs font-medium text-txt-secondary dark:text-txt-darkSecondary leading-relaxed">
                        {p.services.map((s) => translateService(s)).join(', ')}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-tertiary">{t('admin.providers.generalHealthcare')}</p>
                    )}

                    {/* Calm flat credentials, rating, and trust score */}
                    <div className="border-t border-surface-border/70 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <IdStatusBadge status={p.professional_id_status} />

                      <div className="flex items-center gap-3 tabular-nums">
                        {Number(p.rating) > 0 ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-ink dark:text-txt-darkPrimary">
                            <Star weight="fill" className="w-3.5 h-3.5 text-warning fill-current" aria-hidden="true" />
                            <span>{Number(p.rating).toFixed(1)}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-tertiary">
                            {t('admin.providers.noReviews')}
                          </span>
                        )}
                        <span className="font-bold text-link">
                          {t('admin.providers.trustPct', { score: p.trust_score })}
                        </span>
                      </div>
                    </div>

                    {/* Safe Card Bottom Row (No Ban button on scroll surface) */}
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(p)}
                        className="w-full neu-btn min-h-[2.75rem] py-2.5 px-4 rounded-xl text-xs font-extrabold text-link hover:text-primary-focus transition-all text-center"
                      >
                        {t('admin.providers.reviewFullDetails')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="neu-flat rounded-2xl p-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Desktop Clinical Split (col-span-8 Directory + col-span-4 Sticky Inspector) */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 items-start">
          <section
            className="col-span-8 neu-flat rounded-3xl p-5 space-y-4"
            aria-label={t('admin.providers.directoryAria')}
          >
            {/* Live Sort Status Region for Screen Readers */}
            <div role="status" className="sr-only">
              {sortAnnouncement}
            </div>

            <div className="relative">
              <MagnifyingGlass
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label={t('admin.providers.searchAria')}
                placeholder={t('admin.providers.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 pl-10 pr-4 text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
              />
            </div>

            <div
              role="region"
              aria-label={t('admin.providers.tableAria')}
              tabIndex={0}
              className="overflow-x-auto focus-visible:outline-none"
            >
              <table className="w-full text-left border-collapse text-sm">
                <caption className="sr-only">{t('admin.providers.tableCaption')}</caption>
                <thead>
                  <tr className="border-b border-surface-border">
                    <SortableHeader
                      label={t('admin.providers.colProfessional')}
                      sortKey="name"
                      activeSortKey={sortKey}
                      activeSortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th scope="col" className="py-2 px-3 font-extrabold text-xs uppercase tracking-wider text-tertiary">
                      {t('admin.providers.colCredentials')}
                    </th>
                    <SortableHeader
                      label={t('admin.providers.colJoined')}
                      sortKey="joinTimestamp"
                      activeSortKey={sortKey}
                      activeSortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label={t('admin.providers.colStatus')}
                      sortKey="status"
                      activeSortKey={sortKey}
                      activeSortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th
                      scope="col"
                      className="py-2 px-3 font-extrabold text-xs uppercase tracking-wider text-tertiary text-right"
                    >
                      {t('admin.providers.colInspector')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/70">
                  {paginatedProviders.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <EmptyState
                          icon="users"
                          title={t('admin.providers.emptyTitle')}
                          message={t('admin.providers.emptyMsg')}
                          variant="compact"
                        />
                      </td>
                    </tr>
                  ) : (
                    paginatedProviders.map((p) => {
                      const isInspected = inspectedProvider?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          className={`group transition-colors cursor-pointer ${
                            isInspected
                              ? 'bg-primary-soft/55 dark:bg-primary-800/40'
                              : 'hover:bg-surface-subtle/60'
                          }`}
                          onClick={() => setInspectedId(p.id)}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <ProviderAvatar provider={p} />
                              <div className="min-w-0">
                                <span className="font-bold text-ink dark:text-txt-darkPrimary block truncate group-hover:text-link transition-colors">
                                  {p.name}
                                </span>
                                <span className="text-xs text-tertiary font-medium truncate block">
                                  {p.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-0.5">
                              <IdStatusBadge status={p.professional_id_status} />
                              <span className="text-xs font-bold text-tertiary tabular-nums">
                                {t('admin.providers.trustScorePct', { score: p.trust_score })}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-tertiary font-mono text-xs whitespace-nowrap tabular-nums">
                            {formatJoinDate(p)}
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider ${getProviderStatusClasses(
                                p.status
                              )}`}
                            >
                              {translateStatus(p.status)}
                            </span>
                          </td>

                          <td
                            className="py-2.5 px-3 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className={`min-h-[2.75rem] px-3 rounded-xl text-xs font-bold transition-colors ${
                                isInspected
                                  ? 'text-link dark:text-primary-300'
                                  : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                              }`}
                              onClick={() => setInspectedId(p.id)}
                            >
                              {isInspected ? t('admin.providers.inspecting') : t('admin.providers.inspect')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-tertiary tabular-nums">
                {filteredProviders.length === 0
                  ? t('admin.providers.zeroProviders')
                  : t('admin.providers.showingRange', {
                      start: (currentPage - 1) * PAGE_SIZE + 1,
                      end: Math.min(currentPage * PAGE_SIZE, filteredProviders.length),
                      total: filteredProviders.length,
                    })}
              </p>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>

          <aside
            className="col-span-4 neu-flat rounded-3xl p-5 sticky top-6"
            aria-label={t('admin.providers.inspectorAria')}
          >
            <div className="pb-3.5 mb-4 border-b border-surface-border">
              <h2 className="font-display font-black text-base text-ink dark:text-txt-darkPrimary">
                {t('admin.providers.recordTitle')}
              </h2>
              <p className="text-xs text-tertiary mt-0.5">
                {t('admin.providers.recordSubtitle')}
              </p>
            </div>

            {!inspectedProvider ? (
              <div className="py-10 text-center space-y-1.5">
                <p className="text-sm font-bold text-ink dark:text-txt-darkPrimary">
                  {t('admin.providers.noneSelected')}
                </p>
                <p className="text-xs text-tertiary">
                  {t('admin.providers.noneSelectedHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProviderAvatar provider={inspectedProvider} />
                    <div className="min-w-0">
                      <h3 className="font-display font-black text-base text-ink dark:text-txt-darkPrimary truncate">
                        {inspectedProvider.name}
                      </h3>
                      <p className="text-xs text-tertiary font-medium truncate">
                        {inspectedProvider.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider shrink-0 ${getProviderStatusClasses(
                      inspectedProvider.status
                    )}`}
                  >
                    {translateStatus(inspectedProvider.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-surface-border bg-surface-subtle/40 p-3.5 text-xs">
                  <div>
                    <p className="text-tertiary font-semibold">{t('admin.providers.joinedLabel')}</p>
                    <p className="font-bold text-ink dark:text-txt-darkPrimary mt-0.5 font-mono tabular-nums">
                      {formatJoinDate(inspectedProvider)}
                    </p>
                  </div>
                  <div>
                    <p className="text-tertiary font-semibold">{t('admin.providers.trustScoreLabel')}</p>
                    <p className="font-bold text-link mt-0.5 tabular-nums">
                      {inspectedProvider.trust_score}%
                    </p>
                  </div>
                  <div>
                    <p className="text-tertiary font-semibold">{t('admin.providers.ratingLabel')}</p>
                    <p className="font-bold text-ink dark:text-txt-darkPrimary mt-0.5 tabular-nums">
                      {Number(inspectedProvider.rating) > 0
                        ? `${Number(inspectedProvider.rating).toFixed(1)} / 5.0`
                        : t('admin.providers.noReviews')}
                    </p>
                  </div>
                  <div>
                    <p className="text-tertiary font-semibold">{t('admin.providers.idStatusLabel')}</p>
                    <div className="mt-0.5">
                      <IdStatusBadge status={inspectedProvider.professional_id_status} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-tertiary">
                    {t('admin.providers.specializationsLabel')}
                  </p>
                  <p className="text-xs font-medium text-txt-secondary dark:text-txt-darkSecondary leading-relaxed">
                    {inspectedProvider.services.length > 0
                      ? inspectedProvider.services.map((s) => translateService(s)).join(', ')
                      : t('admin.providers.generalHealthcare')}
                  </p>
                </div>

                <div className="pt-2 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider(inspectedProvider)}
                    className="w-full neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] px-4 rounded-xl text-xs font-extrabold transition-all"
                  >
                    {t('admin.providers.reviewAndVerify')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Choice 5B: Mobile Filter & Sort Bottom Drawer */}
      <ProviderFilterDrawer
        open={isFilterDrawerOpen}
        onOpenChange={setIsFilterDrawerOpen}
        filter={filter}
        onFilterChange={setFilter}
        startDate={startDate}
        endDate={endDate}
        onDateChange={({ start, end }) => {
          setStartDate(start);
          setEndDate(end);
        }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={(nextKey) => {
          setSortKey(nextKey);
          if (!nextKey) setSortDir('asc');
          setCurrentPage(1);
        }}
        onSortDirChange={(nextDir) => {
          setSortDir(nextDir);
          setCurrentPage(1);
        }}
        onResetAll={handleResetFilters}
        onExport={handleExport}
      />

      {/* Choice 4B: Centered 2-Tab Accessible Provider Verification Modal */}
      <ProviderVerificationModal
        provider={selectedProvider}
        professionalIdPreviews={professionalIdPreviews}
        actionLoading={actionLoading}
        docActionLoading={docActionLoading}
        onClose={() => setSelectedProvider(null)}
        onApprove={handleApprove}
        onRevokeApproval={handleReject}
        onBanToggle={handleBan}
        onVerifyDocument={handleVerifyDocument}
        onRejectDocument={handleRejectDocument}
        onRemove={handleRemove}
      />
      </MotionConfig>
    </DashboardLayout>
  );
};

export default AdminProviders;
