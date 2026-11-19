import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import { MotionConfig } from 'framer-motion';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { SkeletonPage } from '@/shared/ui';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/ui/sheet';
import useSort from '@/hooks/useSort';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';
import { parseLocalDate, toLocalDateKey } from '@/lib/localDate';

const PAGE_SIZE = 10;

const STATUS_FILTER_KEYS = [
  { id: 'All', labelKey: 'admin.patients.filterAll' },
  { id: 'Active', labelKey: 'admin.patients.filterActive' },
  { id: 'Banned', labelKey: 'admin.patients.filterBanned' },
];

function shiftDaysKey(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toLocalDateKey(date);
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'PT';
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getStatusBadgeClasses(status) {
  return status === 'Active'
    ? 'text-success dark:text-success-dark'
    : 'text-danger dark:text-danger-dark';
}

function getRequestStatusClasses(status) {
  switch (status) {
    case 'Completed':
      return 'text-success dark:text-success-dark';
    case 'Accepted':
      return 'text-link dark:text-primary-300';
    case 'Pending':
      return 'text-warning dark:text-warning-dark';
    default:
      return 'text-danger dark:text-danger-dark';
  }
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event) => setMatches(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

function getVisiblePages(currentPage, totalPages) {
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis-start');
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
  }

  return pages;
}

const TextPagination = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => {
  const { t } = useLanguage();
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);
  const visiblePages = totalPages > 1 ? getVisiblePages(currentPage, totalPages) : [];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-surface-border">
      <p className="text-xs font-semibold text-tertiary dark:text-tertiary tabular-nums">
        {t('admin.patients.showingRange', { start: startItem, end: endItem, total: totalItems })}
      </p>

      {totalPages > 1 && (
        <nav aria-label={t('admin.patients.paginationAria')} className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('admin.patients.previous')}
          </button>

          {visiblePages.map((page) =>
            typeof page === 'string' ? (
              <span key={page} className="px-2 text-xs font-bold text-tertiary">
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                aria-current={currentPage === page ? 'page' : undefined}
                onClick={() => onPageChange(page)}
                className={`min-w-[2.75rem] min-h-[2.75rem] px-3 rounded-xl text-xs font-bold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  currentPage === page
                    ? 'neu-btn-primary text-white dark:text-neu-fg'
                    : 'neu-btn text-ink dark:text-txt-darkPrimary'
                }`}
              >
                {page}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('admin.patients.next')}
          </button>
        </nav>
      )}
    </div>
  );
};

const PatientInspectorBody = ({
  patient,
  patientHistory,
  historyLoading,
  historyError,
  isEditing,
  editName,
  editEmail,
  modalSaving,
  actionLoading,
  onStartEdit,
  onCancelEdit,
  onChangeName,
  onChangeEmail,
  onSaveEdit,
  onRequestBanToggle,
  onRequestRemove,
}) => {
  const { t, formatDate, translateStatus, translateService } = useLanguage();
  if (!patient) {
    return (
      <div className="py-6 text-center space-y-1">
        <p className="font-display font-bold text-base text-ink dark:text-txt-darkPrimary">
          {t('admin.patients.noResidentSelected')}
        </p>
        <p className="text-sm text-tertiary dark:text-tertiary">
          {t('admin.patients.noResidentHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isEditing ? (
        <div className="py-2 space-y-3 border-b border-surface-border/70 pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-link dark:text-primary-300">
              {t('admin.patients.editProfile')}
            </span>
            <span className="text-xs text-tertiary font-medium">{t('admin.patients.updatesImmediately')}</span>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="inspector-patient-name"
              className="block text-xs font-bold uppercase tracking-wider text-tertiary"
            >
              {t('admin.patients.fullNameLabel')}
            </label>
            <input
              id="inspector-patient-name"
              type="text"
              value={editName}
              onChange={(event) => onChangeName(event.target.value)}
              placeholder={t('admin.patients.fullNamePlaceholder')}
              className="w-full rounded-xl border border-surface-border bg-surface-subtle/50 min-h-[2.75rem] px-3.5 text-base sm:text-sm font-semibold text-ink dark:text-txt-darkPrimary outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="inspector-patient-email"
              className="block text-xs font-bold uppercase tracking-wider text-tertiary"
            >
              {t('admin.patients.emailLabel')}
            </label>
            <input
              id="inspector-patient-email"
              type="email"
              value={editEmail}
              onChange={(event) => onChangeEmail(event.target.value)}
              placeholder={t('admin.patients.emailPlaceholder')}
              className="w-full rounded-xl border border-surface-border bg-surface-subtle/50 min-h-[2.75rem] px-3.5 text-base sm:text-sm font-semibold text-ink dark:text-txt-darkPrimary outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={modalSaving}
              className="neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] px-4 rounded-xl text-xs font-bold transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {modalSaving ? t('admin.patients.saving') : t('admin.patients.saveChanges')}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="border border-surface-border bg-surface-subtle/50 hover:bg-surface-subtle min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('admin.patients.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link dark:text-primary-300 overflow-hidden shrink-0">
              {patient.avatar_url ? (
                <img src={patient.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(patient.name)
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-black text-base sm:text-lg text-ink dark:text-txt-darkPrimary truncate">
                {patient.name}
              </h3>
              <p className="text-xs text-tertiary dark:text-tertiary font-medium break-all">
                {patient.email || t('admin.patients.noEmailOnFile')}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider shrink-0 ${getStatusBadgeClasses(
              patient.status
            )}`}
          >
            {translateStatus(patient.status)}
          </span>
        </div>
      )}

      <div className="border-y border-surface-border/70 py-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-tertiary font-semibold">{t('admin.patients.colJoined')}</p>
          <p className="font-bold text-ink dark:text-txt-darkPrimary font-mono tabular-nums mt-0.5">
            {patient.joinTimestamp ? formatDate(patient.joinTimestamp, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-tertiary font-semibold">{t('admin.patients.bookingsLabel')}</p>
          <p className="font-bold text-ink dark:text-txt-darkPrimary tabular-nums mt-0.5">
            {historyLoading ? t('admin.patients.loadingHistory') : t('admin.patients.recordedCount', { count: patientHistory.length })}
          </p>
        </div>
      </div>

      {/* Clear Labeled Profile & Moderation Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onStartEdit}
          disabled={isEditing || actionLoading}
          className="min-h-[2.75rem] px-2.5 rounded-xl border border-surface-border bg-surface-subtle/50 hover:bg-surface-subtle text-xs font-bold text-link dark:text-primary-300 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          {t('admin.patients.editInfo')}
        </button>
        <button
          type="button"
          onClick={() => onRequestBanToggle(patient)}
          disabled={actionLoading}
          className={`min-h-[2.75rem] px-2.5 rounded-xl border border-surface-border bg-surface-subtle/50 hover:bg-surface-subtle text-xs font-bold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors ${
            patient.is_banned
              ? 'text-success dark:text-success-dark'
              : 'text-warning dark:text-warning-dark'
          }`}
        >
          {patient.is_banned ? t('admin.patients.unbanResident') : t('admin.patients.banResident')}
        </button>
        <button
          type="button"
          onClick={() => onRequestRemove(patient)}
          disabled={actionLoading}
          className="col-span-2 sm:col-span-1 min-h-[2.75rem] px-2.5 rounded-xl border border-surface-border bg-surface-subtle/50 hover:bg-surface-subtle text-xs font-bold text-danger dark:text-danger-dark disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
        >
          {t('admin.patients.removeResident')}
        </button>
      </div>

      {/* Service History */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-tertiary">
            {t('admin.patients.serviceHistory')}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-tertiary tabular-nums">
              {t('admin.patients.totalCount', { count: patientHistory.length })}
            </span>
            <Link
              to="/admin/requests"
              className="text-xs font-extrabold text-link hover:underline"
            >
              {t('admin.patients.manageRequests')}
            </Link>
          </div>
        </div>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-12 bg-surface-subtle rounded-xl animate-pulse" />
            ))}
          </div>
        ) : historyError ? (
          <div className="py-4 text-center">
            <p className="text-xs font-semibold text-danger dark:text-danger-dark">
              {historyError}
            </p>
          </div>
        ) : patientHistory.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-sm text-tertiary">{t('admin.patients.noHistory')}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border/70 max-h-60 overflow-y-auto pr-0.5">
            {patientHistory.map((req) => {
              const parsed = new Date(req.date || req.created_at);
              const dateLabel = !Number.isNaN(parsed.getTime())
                ? formatDate(parsed, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A';

              return (
                <div
                  key={req.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-ink dark:text-txt-darkPrimary truncate">
                      {req.service ? translateService(req.service) : t('admin.patients.careService')}
                    </p>
                    <p className="text-xs text-tertiary dark:text-tertiary font-medium mt-0.5 truncate">
                      {req.provider?.full_name || t('admin.patients.assignedProvider')}, {dateLabel}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider shrink-0 ${getRequestStatusClasses(
                      req.status
                    )}`}
                  >
                    {translateStatus(req.status)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPatients = () => {
  const { t, formatDate, translateStatus } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [inspectedId, setInspectedId] = useState(null);
  const [mobileSheetPatientId, setMobileSheetPatientId] = useState(null);
  const mobileModalTriggerRef = useRef(null);
  const confirmCancelRef = useRef(null);
  const historyRequestIdRef = useRef(0);

  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [isEditingInspector, setIsEditingInspector] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState(null);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { sorted, sortKey, sortDir, handleSort } = useSort(patients);

  const fetchPatients = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url, is_banned, created_at')
        .eq('role', 'patient')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map((patient) => {
        const createdDate = new Date(patient.created_at);
        const validTimestamp = Number.isNaN(createdDate.getTime()) ? 0 : createdDate.getTime();
        return {
          id: patient.id,
          name: patient.full_name || tRef.current('admin.patients.unknownResident'),
          email: patient.email || '',
          avatar_url: patient.avatar_url || '',
          joinDate: validTimestamp
            ? createdDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A',
          joinTimestamp: validTimestamp,
          is_banned: Boolean(patient.is_banned),
          status: patient.is_banned ? 'Banned' : 'Active',
        };
      });

      setPatients(shaped);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setFetchError(tRef.current('admin.patients.loadErrorMsg'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const fetchPatientHistory = useCallback(async (patientId) => {
    if (!patientId) {
      setPatientHistory([]);
      setHistoryError(null);
      return;
    }

    const requestId = ++historyRequestIdRef.current;
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const { data, error } = await supabase
        .from('requests')
        .select('id, service, status, date, time, created_at, provider:provider_id(full_name)')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (requestId !== historyRequestIdRef.current) return;
      if (error) throw error;
      setPatientHistory(data || []);
    } catch (err) {
      if (requestId !== historyRequestIdRef.current) return;
      console.error('Error fetching patient history:', err);
      setPatientHistory([]);
      setHistoryError(tRef.current('admin.patients.historyError'));
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  const [effectiveStartDate, effectiveEndDate] = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return [endDate, startDate];
    }
    return [startDate, endDate];
  }, [startDate, endDate]);

  const searchAndDateFiltered = useMemo(() => {
    const startBound = effectiveStartDate ? parseLocalDate(effectiveStartDate) : null;
    if (startBound) startBound.setHours(0, 0, 0, 0);

    const endBound = effectiveEndDate ? parseLocalDate(effectiveEndDate) : null;
    if (endBound) endBound.setHours(23, 59, 59, 999);

    const query = searchTerm.trim().toLowerCase();

    return sorted.filter((patient) => {
      const matchesSearch =
        !query ||
        patient.name.toLowerCase().includes(query) ||
        patient.email.toLowerCase().includes(query);

      let matchesDate = true;
      if (startBound) {
        matchesDate = matchesDate && patient.joinTimestamp >= startBound.getTime();
      }
      if (endBound) {
        matchesDate = matchesDate && patient.joinTimestamp <= endBound.getTime();
      }
      return matchesSearch && matchesDate;
    });
  }, [sorted, searchTerm, effectiveStartDate, effectiveEndDate]);

  const statusCounts = useMemo(
    () => ({
      All: searchAndDateFiltered.length,
      Active: searchAndDateFiltered.filter((p) => p.status === 'Active').length,
      Banned: searchAndDateFiltered.filter((p) => p.status === 'Banned').length,
    }),
    [searchAndDateFiltered]
  );

  const filteredPatients = useMemo(() => {
    if (filter === 'All') return searchAndDateFiltered;
    return searchAndDateFiltered.filter((patient) => patient.status === filter);
  }, [searchAndDateFiltered, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, effectiveStartDate, effectiveEndDate, sortKey, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedPatients = useMemo(
    () =>
      filteredPatients.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
      ),
    [filteredPatients, currentPage]
  );

  // Desktop inspects explicit selection or falls back to the first visible resident
  const inspectedPatient = useMemo(() => {
    if (isDesktop) {
      return (
        filteredPatients.find((patient) => patient.id === inspectedId) ||
        paginatedPatients[0] ||
        null
      );
    }
    if (!mobileSheetPatientId) return null;
    return patients.find((patient) => patient.id === mobileSheetPatientId) || null;
  }, [isDesktop, filteredPatients, inspectedId, paginatedPatients, mobileSheetPatientId, patients]);

  useEffect(() => {
    if (isDesktop) {
      setMobileSheetPatientId(null);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!inspectedPatient) {
      setPatientHistory([]);
      setHistoryError(null);
      setIsEditingInspector(false);
      return;
    }
    setIsEditingInspector(false);
    setEditName(inspectedPatient.name);
    setEditEmail(inspectedPatient.email);
    fetchPatientHistory(inspectedPatient.id);
  }, [inspectedPatient?.id, fetchPatientHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const openInspector = (patient, triggerEl = null) => {
    setInspectedId(patient.id);
    if (!isDesktop) {
      mobileModalTriggerRef.current = triggerEl;
      setMobileSheetPatientId(patient.id);
    }
  };

  const handleSaveEdit = async () => {
    if (!inspectedPatient) return;
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();
    if (!trimmedName || !trimmedEmail) {
      toast.error(t('admin.patients.toastEmptyFields'));
      return;
    }

    setModalSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: trimmedName,
          email: trimmedEmail,
        })
        .eq('id', inspectedPatient.id);

      if (error) throw error;
      toast.success(t('admin.patients.toastUpdated'));
      setIsEditingInspector(false);
      await fetchPatients({ silent: true });
    } catch (err) {
      toast.error(err.message || t('admin.patients.toastUpdateError'));
    } finally {
      setModalSaving(false);
    }
  };

  const requestBanToggleConfirm = (patient) => {
    setConfirmDialog({
      title: patient.is_banned
        ? t('admin.patients.confirmUnbanTitle', { name: patient.name })
        : t('admin.patients.confirmBanTitle', { name: patient.name }),
      message: patient.is_banned
        ? t('admin.patients.confirmUnbanMsg')
        : t('admin.patients.confirmBanMsg'),
      confirmLabel: patient.is_banned
        ? t('admin.patients.confirmUnbanBtn')
        : t('admin.patients.confirmBanBtn'),
      isDestructive: !patient.is_banned,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const { error } = await supabase
            .from('users')
            .update({ is_banned: !patient.is_banned })
            .eq('id', patient.id);
          if (error) throw error;
          await fetchPatients({ silent: true });
          toast.success(
            patient.is_banned
              ? t('admin.patients.toastUnbanned', { name: patient.name })
              : t('admin.patients.toastBanned', { name: patient.name })
          );
        } catch {
          toast.error(
            patient.is_banned
              ? t('admin.patients.toastUnbanError')
              : t('admin.patients.toastBanError')
          );
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const requestRemoveConfirm = (patient) => {
    setConfirmDialog({
      title: t('admin.patients.confirmRemoveTitle', { name: patient.name }),
      message: t('admin.patients.confirmRemoveMsg'),
      confirmLabel: t('admin.patients.confirmRemoveBtn'),
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', patient.id);
          if (error) throw error;
          if (mobileSheetPatientId === patient.id) {
            setMobileSheetPatientId(null);
          }
          if (inspectedId === patient.id) {
            setInspectedId(null);
          }
          await fetchPatients({ silent: true });
          toast.success(t('admin.patients.toastRemoved', { name: patient.name }));
        } catch {
          toast.error(t('admin.patients.toastRemoveError'));
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleConfirmExecute = async () => {
    if (!confirmDialog) return;
    const { onConfirm } = confirmDialog;
    setConfirmDialog(null);
    await onConfirm();
  };

  const handleExport = () => {
    if (!filteredPatients.length) {
      toast.error(t('admin.patients.toastNoExport'));
      return;
    }
    const fields = [
      { key: 'name', label: t('admin.patients.csvFullName') },
      { key: 'email', label: t('admin.patients.csvEmail') },
      { key: 'status', label: t('admin.patients.csvStatus'), transform: (val) => translateStatus(val) },
      { key: 'joinDate', label: t('admin.patients.csvJoined') },
    ];
    const exportRows = filteredPatients.map((p) => ({
      ...p,
      joinDate: p.joinTimestamp
        ? formatDate(p.joinTimestamp, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'N/A',
    }));
    const exportable = formatDataForExport(exportRows, fields);
    exportToCSV(exportable, 'patients_export');
    toast.success(t('admin.patients.toastExported'));
  };

  const renderSortableHeader = (label, key) => {
    const isSorted = sortKey === key;
    const ariaSort = isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined;

    return (
      <th scope="col" aria-sort={ariaSort} className="p-0">
        <button
          type="button"
          onClick={() => handleSort(key)}
          className={`w-full min-h-[2.75rem] px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isSorted
              ? 'text-link dark:text-primary-300'
              : 'text-tertiary dark:text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
          }`}
        >
          <span>{label}</span>
          {isSorted && (
            <span className="text-xs font-bold lowercase">
              ({sortDir})
            </span>
          )}
        </button>
      </th>
    );
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
          {/* Page Header & Action Controls */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl text-ink dark:text-txt-darkPrimary">
                {t('admin.patients.title')}
              </h1>
              <p className="text-sm text-tertiary dark:text-tertiary mt-1">
                {t('admin.patients.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="rounded-2xl border border-surface-border bg-surface-subtle/70 p-1 grid grid-cols-3 sm:inline-flex gap-1 w-full sm:w-auto"
                role="group"
                aria-label={t('admin.patients.filterAria')}
              >
                {STATUS_FILTER_KEYS.map((item) => {
                  const isActive = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setFilter(item.id)}
                      className={`min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? 'neu-btn-primary text-white dark:text-neu-fg'
                          : 'text-txt-secondary dark:text-txt-darkSecondary hover:text-ink dark:hover:text-txt-darkPrimary'
                      }`}
                    >
                      {t(item.labelKey)} ({statusCounts[item.id]})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:inline-flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  aria-expanded={showFiltersPanel}
                  onClick={() => setShowFiltersPanel((prev) => !prev)}
                  className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {showFiltersPanel ? t('admin.patients.hideDates') : t('admin.patients.dateRange')}
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-link dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('admin.patients.exportCsv')}
                </button>
              </div>
            </div>
          </header>

          {/* Expandable Join Date Range Filter */}
          {showFiltersPanel && (
            <section
              className="rounded-2xl border border-surface-border bg-surface-subtle/40 p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-end gap-3"
              aria-label={t('admin.patients.dateFilterAria')}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex sm:items-end gap-3 flex-1">
                <div className="flex-1 min-w-0 space-y-1">
                  <label
                    htmlFor="patients-start-date"
                    className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                  >
                    {t('admin.patients.joinedFrom')}
                  </label>
                  <input
                    id="patients-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full min-h-[2.75rem] px-3 rounded-xl border border-surface-border bg-surface dark:bg-surface-dark text-base sm:text-xs font-semibold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <label
                    htmlFor="patients-end-date"
                    className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                  >
                    {t('admin.patients.joinedTo')}
                  </label>
                  <input
                    id="patients-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full min-h-[2.75rem] px-3 rounded-xl border border-surface-border bg-surface dark:bg-surface-dark text-base sm:text-xs font-semibold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full lg:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(shiftDaysKey(29));
                    setEndDate(toLocalDateKey(new Date()));
                  }}
                  className="neu-btn min-h-[2.75rem] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('admin.patients.last30Days')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(shiftDaysKey(6));
                    setEndDate(toLocalDateKey(new Date()));
                  }}
                  className="neu-btn min-h-[2.75rem] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('admin.patients.last7Days')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="neu-btn min-h-[2.75rem] px-2.5 sm:px-3.5 rounded-xl text-xs font-bold text-link dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('admin.patients.resetDates')}
                </button>
              </div>
            </section>
          )}

          {fetchError ? (
            <section
              role="alert"
              className="neu-flat rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-surface-border"
            >
              <div className="space-y-1">
                <h2 className="font-display font-bold text-base sm:text-lg text-ink dark:text-txt-darkPrimary">
                  {t('admin.patients.loadErrorTitle')}
                </h2>
                <p className="text-sm text-txt-secondary dark:text-txt-darkSecondary">{fetchError}</p>
              </div>
              <button
                type="button"
                onClick={fetchPatients}
                className="neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] px-5 rounded-xl text-xs font-bold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {t('admin.patients.retry')}
              </button>
            </section>
          ) : isDesktop ? (
            /* Desktop 8/4 Split: Raised Directory Table + Sticky Right Inspector */
            <div className="grid grid-cols-12 gap-5 items-start">
              <section className="col-span-8 neu-flat rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <MagnifyingGlass
                      className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label={t('admin.patients.searchAria')}
                      placeholder={t('admin.patients.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="w-full min-h-[2.75rem] pl-10 pr-4 rounded-xl border border-surface-border bg-surface-subtle/50 text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {t('admin.patients.clear')}
                    </button>
                  )}
                </div>

                {paginatedPatients.length === 0 ? (
                  <div className="rounded-2xl border border-surface-border/70 p-8 text-center space-y-1">
                    <h2 className="font-display font-bold text-base text-ink dark:text-txt-darkPrimary">
                      {t('admin.patients.emptyTitle')}
                    </h2>
                    <p className="text-sm text-tertiary dark:text-tertiary">
                      {t('admin.patients.emptyMsg')}
                    </p>
                  </div>
                ) : (
                  <div
                    role="region"
                    aria-labelledby="patients-directory-caption"
                    tabIndex={0}
                    className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
                  >
                    <table className="w-full text-left border-collapse text-sm">
                      <caption id="patients-directory-caption" className="sr-only">
                        {t('admin.patients.directoryCaption')}
                      </caption>
                      <thead>
                        <tr className="border-b border-surface-border">
                          {renderSortableHeader(t('admin.patients.colResident'), 'name')}
                          {renderSortableHeader(t('admin.patients.colJoined'), 'joinTimestamp')}
                          {renderSortableHeader(t('admin.patients.colStatus'), 'status')}
                          <th
                            scope="col"
                            className="py-2 px-3 text-right text-xs font-extrabold uppercase tracking-wider text-tertiary"
                          >
                            {t('admin.patients.colInspector')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border/70">
                        {paginatedPatients.map((patient) => {
                          const isInspected = inspectedPatient?.id === patient.id;
                          const displayJoinDate = patient.joinTimestamp
                            ? formatDate(patient.joinTimestamp, { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'N/A';

                          return (
                            <tr
                              key={patient.id}
                              onClick={() => openInspector(patient)}
                              className={`cursor-pointer transition-colors ${
                                isInspected
                                  ? 'bg-primary-soft/55 dark:bg-primary-800/40'
                                  : 'hover:bg-surface-subtle/60'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link dark:text-primary-300 overflow-hidden shrink-0">
                                    {patient.avatar_url ? (
                                      <img
                                        src={patient.avatar_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      getInitials(patient.name)
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-ink dark:text-txt-darkPrimary truncate">
                                      {patient.name}
                                    </p>
                                    <p className="text-xs text-tertiary dark:text-tertiary font-medium truncate">
                                      {patient.email}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-tertiary dark:text-tertiary whitespace-nowrap">
                                {displayJoinDate}
                              </td>

                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider ${getStatusBadgeClasses(
                                    patient.status
                                  )}`}
                                >
                                  {translateStatus(patient.status)}
                                </span>
                              </td>

                              <td
                                className="py-2.5 px-3 text-right"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  aria-pressed={isInspected}
                                  onClick={() => openInspector(patient)}
                                  className={`min-h-[2.75rem] px-3 rounded-xl text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                    isInspected
                                      ? 'font-extrabold text-link dark:text-primary-300'
                                      : 'font-bold text-tertiary hover:text-link'
                                  }`}
                                >
                                  {isInspected ? t('admin.patients.inspecting') : t('admin.patients.inspect')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <TextPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredPatients.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </section>

              <aside
                aria-label={t('admin.patients.inspectorAria')}
                className="col-span-4 neu-flat rounded-3xl p-5 space-y-4 sticky top-6"
              >
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <div>
                    <h2 className="font-display font-bold text-base text-ink dark:text-txt-darkPrimary">
                      {t('admin.patients.recordTitle')}
                    </h2>
                    <p className="text-xs text-tertiary font-semibold">{t('admin.patients.recordSubtitle')}</p>
                  </div>
                </div>

                <PatientInspectorBody
                  patient={inspectedPatient}
                  patientHistory={patientHistory}
                  historyLoading={historyLoading}
                  historyError={historyError}
                  isEditing={isEditingInspector}
                  editName={editName}
                  editEmail={editEmail}
                  modalSaving={modalSaving}
                  actionLoading={actionLoading}
                  onStartEdit={() => setIsEditingInspector(true)}
                  onCancelEdit={() => {
                    setIsEditingInspector(false);
                    if (inspectedPatient) {
                      setEditName(inspectedPatient.name);
                      setEditEmail(inspectedPatient.email);
                    }
                  }}
                  onChangeName={setEditName}
                  onChangeEmail={setEditEmail}
                  onSaveEdit={handleSaveEdit}
                  onRequestBanToggle={requestBanToggleConfirm}
                  onRequestRemove={requestRemoveConfirm}
                />
              </aside>
            </div>
          ) : (
            /* Mobile / Tablet (< 1024px) Compact Card Feed + Slide-Up Record Modal */
            <div className="space-y-3.5">
              <div className="neu-flat rounded-2xl p-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <MagnifyingGlass
                    className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label={t('admin.patients.searchAria')}
                    placeholder={t('admin.patients.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full min-h-[2.75rem] pl-10 pr-4 rounded-xl border border-surface-border bg-surface-subtle/50 text-base sm:text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t('admin.patients.clear')}
                  </button>
                )}
              </div>

              {filteredPatients.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-tertiary tabular-nums mr-1">
                      {t('admin.patients.pageOf', { current: currentPage, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className={`min-h-[2.75rem] px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        sortKey === 'name'
                          ? 'text-link dark:text-primary-300 font-extrabold'
                          : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                      }`}
                    >
                      {t('admin.patients.sortName')} {sortKey === 'name' ? `(${sortDir})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSort('joinTimestamp')}
                      className={`min-h-[2.75rem] px-2.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        sortKey === 'joinTimestamp'
                          ? 'text-link dark:text-primary-300 font-extrabold'
                          : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                      }`}
                    >
                      {t('admin.patients.sortJoined')} {sortKey === 'joinTimestamp' ? `(${sortDir})` : ''}
                    </button>
                  </div>
                </div>
              )}

              {paginatedPatients.length === 0 ? (
                <section className="neu-flat rounded-2xl p-6 text-center space-y-1">
                  <h2 className="font-display font-bold text-base text-ink dark:text-txt-darkPrimary">
                    {t('admin.patients.emptyTitle')}
                  </h2>
                  <p className="text-sm text-tertiary dark:text-tertiary">
                    {t('admin.patients.emptyMsg')}
                  </p>
                </section>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {paginatedPatients.map((patient) => {
                    const displayJoinDate = patient.joinTimestamp
                      ? formatDate(patient.joinTimestamp, { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'N/A';
                    return (
                      <article
                        key={patient.id}
                        className="neu-flat rounded-2xl p-3.5 space-y-2.5 transition-colors flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(event) => openInspector(patient, event.currentTarget)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl py-0.5"
                            >
                              <div className="w-10 h-10 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link dark:text-primary-300 overflow-hidden shrink-0">
                                {patient.avatar_url ? (
                                  <img
                                    src={patient.avatar_url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  getInitials(patient.name)
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="font-extrabold text-sm text-ink dark:text-txt-darkPrimary truncate">
                                  {patient.name}
                                </p>
                                <p className="text-xs text-tertiary dark:text-tertiary font-medium truncate">
                                  {patient.email}
                                </p>
                              </div>
                            </button>
                          </div>

                          <span
                            className={`inline-flex items-center text-xs font-extrabold uppercase tracking-wider shrink-0 pt-1 ${getStatusBadgeClasses(
                              patient.status
                            )}`}
                          >
                            {translateStatus(patient.status)}
                          </span>
                        </div>

                        <div className="border-t border-surface-border/70 pt-2.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-tertiary font-semibold font-mono tabular-nums">
                            {t('admin.patients.joinedPrefix', { date: displayJoinDate })}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => openInspector(patient, event.currentTarget)}
                            className="min-h-[2.75rem] px-2.5 inline-flex items-center text-xs font-bold text-link dark:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                          >
                            {t('admin.patients.openRecord')}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="neu-flat rounded-2xl px-4 pb-4">
                <TextPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredPatients.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mobile / Tablet Slide-Up Patient Record Sheet */}
        <Sheet
          open={!isDesktop && Boolean(inspectedPatient)}
          onOpenChange={(open) => {
            if (!open) setMobileSheetPatientId(null);
          }}
        >
          {!isDesktop && inspectedPatient && (
            <SheetContent
              side="bottom"
              onCloseAutoFocus={(event) => {
                if (!mobileModalTriggerRef.current) return;
                event.preventDefault();
                mobileModalTriggerRef.current.focus();
              }}
              className="px-4 sm:px-5 pt-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:max-w-lg sm:mx-auto sm:rounded-[2rem] bg-surface dark:bg-surface-dark border-t sm:border border-white/70 dark:border-white/10 shadow-2xl"
            >
              <div
                className="mx-auto mt-3 mb-1.5 h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 sm:hidden shrink-0"
                aria-hidden="true"
              />
              <SheetHeader className="px-1 pt-3 pb-3.5 text-left ring-0 border-b border-surface-border">
                <SheetTitle className="text-lg font-display font-black text-ink dark:text-txt-darkPrimary">
                  {t('admin.patients.recordTitle')}
                </SheetTitle>
                <SheetDescription className="text-xs font-semibold text-tertiary">
                  {t('admin.patients.sheetSubtitle')}
                </SheetDescription>
              </SheetHeader>

              <div className="px-1 pt-4">
                <PatientInspectorBody
                  patient={inspectedPatient}
                  patientHistory={patientHistory}
                  historyLoading={historyLoading}
                  historyError={historyError}
                  isEditing={isEditingInspector}
                  editName={editName}
                  editEmail={editEmail}
                  modalSaving={modalSaving}
                  actionLoading={actionLoading}
                  onStartEdit={() => setIsEditingInspector(true)}
                  onCancelEdit={() => {
                    setIsEditingInspector(false);
                    setEditName(inspectedPatient.name);
                    setEditEmail(inspectedPatient.email);
                  }}
                  onChangeName={setEditName}
                  onChangeEmail={setEditEmail}
                  onSaveEdit={handleSaveEdit}
                  onRequestBanToggle={requestBanToggleConfirm}
                  onRequestRemove={requestRemoveConfirm}
                />
              </div>
            </SheetContent>
          )}
        </Sheet>

        {/* Accessible In-App Confirmation Dialog (Replaces window.confirm) */}
        <DialogPrimitive.Root
          open={Boolean(confirmDialog)}
          onOpenChange={(open) => {
            if (!open) setConfirmDialog(null);
          }}
        >
          {confirmDialog && (
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay
                onClick={() => {
                  if (!actionLoading) setConfirmDialog(null);
                }}
                className="fixed inset-0 z-overlay pointer-events-auto bg-black/40 dark:bg-black/70"
              />
              <DialogPrimitive.Content
                aria-modal="true"
                onOpenAutoFocus={(event) => {
                  if (confirmCancelRef.current) {
                    event.preventDefault();
                    confirmCancelRef.current.focus();
                  }
                }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-overlay w-[calc(100vw-2rem)] max-w-md neu-flat rounded-3xl p-5 sm:p-6 border border-surface-border shadow-card bg-surface dark:bg-surface-dark space-y-4 focus:outline-none"
              >
                <div className="space-y-1.5">
                  <DialogPrimitive.Title className="font-display font-black text-lg text-ink dark:text-txt-darkPrimary">
                    {confirmDialog.title}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-sm text-txt-secondary dark:text-txt-darkSecondary">
                    {confirmDialog.message}
                  </DialogPrimitive.Description>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <button
                    ref={confirmCancelRef}
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {t('admin.patients.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmExecute}
                    className={`min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      confirmDialog.isDestructive ? 'bg-danger' : 'bg-primary'
                    }`}
                  >
                    {confirmDialog.confirmLabel}
                  </button>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </DialogPrimitive.Root>
      </MotionConfig>
    </DashboardLayout>
  );
};

export default AdminPatients;
