import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  MagnifyingGlass,
  DownloadSimple,
  ArrowsDownUp,
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  CaretRight,
} from '@phosphor-icons/react';
import { MotionConfig } from 'framer-motion';
import { CustomSelect, DateRangePicker, Pagination, SkeletonPage, EmptyState } from '@/shared/ui';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/shared/ui/sheet';
import useSort from '@/hooks/useSort';
import useSearchQueryParam from '@/hooks/useSearchQueryParam';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { exportToCSV, formatDataForExport } from '@/lib/exportUtils';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isDesktop;
}

const AdminRequests = () => {
  const { t, formatDate, formatTime, translateService, translateStatus } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  useSearchQueryParam(['q'], ({ q }) => {
    if (q) {
      setSearchTerm(q);
      setFilter('All');
    }
  });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const isDesktop = useIsDesktop();
  const [inspectedId, setInspectedId] = useState(null);
  const [mobileSheetRequestId, setMobileSheetRequestId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalTriggerRef = useRef(null);
  const deleteCancelRef = useRef(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(requests);

  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          id,
          service,
          status,
          date,
          time,
          notes,
          created_at,
          patient:patient_id(id, full_name, email, avatar_url),
          provider:provider_id(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false })
        // Pagination here is client-side, so the table must not be pulled whole.
        .limit(500);

      if (error) throw error;

      const formatted = (data || []).map(r => {
        let timeLabel = '';
        try {
          if (r.time) {
            timeLabel = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch {
          timeLabel = r.time || '';
        }

        return {
          id: r.id,
          patientId: r.patient?.id || null,
          patient: r.patient?.full_name || tRef.current('admin.requests.unknownPatient'),
          patientEmail: r.patient?.email || '',
          patientAvatar: r.patient?.avatar_url || '',
          providerId: r.provider?.id || null,
          provider: r.provider?.full_name || tRef.current('admin.requests.unassignedProvider'),
          providerEmail: r.provider?.email || '',
          providerAvatar: r.provider?.avatar_url || '',
          service: r.service || 'General Healthcare',
          status: r.status || 'Pending',
          notes: r.notes || '',
          rawDate: r.date || '',
          rawTime: r.time || '',
          date: r.date ? new Date(r.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
          time: timeLabel,
          scheduledTimestamp: r.date ? new Date(`${r.date}T${r.time || '00:00'}`).getTime() : 0,
          timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
          created_at: r.created_at,
        };
      });

      setRequests(formatted);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const formatScheduledDate = (req) => {
    if (!req?.rawDate) return 'N/A';
    return formatDate(req.rawDate.replace(/-/g, '/'), { month: 'short', day: 'numeric', year: 'numeric' }) || 'N/A';
  };

  const formatScheduledTime = (req) => {
    if (!req?.rawTime) return '';
    try {
      return formatTime(`2000-01-01T${req.rawTime}`, { hour: 'numeric', minute: '2-digit' }) || req.rawTime;
    } catch {
      return req.rawTime;
    }
  };

  const handleExport = () => {
    if (filteredRequests.length === 0) {
      toast.error(t('admin.requests.toastNoExport'));
      return;
    }
    const fields = [
      { key: 'id', label: t('admin.requests.csvRequestId') },
      { key: 'patient', label: t('admin.requests.csvPatient') },
      { key: 'patientEmail', label: t('admin.requests.csvPatientEmail') },
      { key: 'provider', label: t('admin.requests.csvProvider') },
      { key: 'providerEmail', label: t('admin.requests.csvProviderEmail') },
      { key: 'service', label: t('admin.requests.csvService'), transform: (v) => translateService(v) },
      { key: 'status', label: t('admin.requests.csvStatus'), transform: (v) => translateStatus(v) },
      { key: 'date', label: t('admin.requests.csvScheduledDate') },
      { key: 'time', label: t('admin.requests.csvScheduledTime') },
      { key: 'notes', label: t('admin.requests.csvNotes') },
      { key: 'created_at', label: t('admin.requests.csvCreatedAt') },
    ];
    const exportRows = filteredRequests.map((r) => ({
      ...r,
      date: formatScheduledDate(r),
      time: formatScheduledTime(r),
    }));
    const exportable = formatDataForExport(exportRows, fields);
    exportToCSV(exportable, 'platform_requests_export');
    toast.success(t('admin.requests.toastExported'));
  };

  // Status updates
  const handleUpdateStatus = async (requestId, newStatus) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(t('admin.requests.toastStatusUpdated', { status: translateStatus(newStatus) }));
      await fetchRequests();
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error(t('admin.requests.toastStatusError'));
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    setConfirmDelete(false);
  }, [inspectedId, mobileSheetRequestId]);

  useEffect(() => {
    if (confirmDelete && deleteCancelRef.current) {
      deleteCancelRef.current.focus();
    }
  }, [confirmDelete]);

  const handleDeleteRequest = async (requestId) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success(t('admin.requests.toastDeleted'));
      setConfirmDelete(false);
      setInspectedId(null);
      setMobileSheetRequestId(null);
      await fetchRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      toast.error(t('admin.requests.toastDeleteError'));
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering
  const filteredRequests = sorted.filter(r => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = 
      r.patient.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q) ||
      r.service.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.patientEmail.toLowerCase().includes(q) ||
      r.providerEmail.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q);

    const matchesFilter = filter === 'All' || r.status.toLowerCase() === filter.toLowerCase();

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(r.timestamp) >= new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(r.timestamp) <= end;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, startDate, endDate, sortKey]);

  const inspectedRequest = useMemo(() => {
    if (isDesktop) {
      return (
        filteredRequests.find((r) => r.id === inspectedId) ||
        filteredRequests[0] ||
        null
      );
    }
    return filteredRequests.find((r) => r.id === mobileSheetRequestId) || null;
  }, [isDesktop, filteredRequests, inspectedId, mobileSheetRequestId]);

  const openInspector = (request, triggerEl = null) => {
    setInspectedId(request.id);
    if (!isDesktop) {
      modalTriggerRef.current = triggerEl;
      setMobileSheetRequestId(request.id);
    }
  };

  const getStatusLabel = (status) => {
    const label = translateStatus(status);
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark">
            {label}
          </span>
        );
      case 'Accepted':
      case 'On The Way':
      case 'Arrived':
        return (
          <span className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-link dark:text-primary-300">
            {label}
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-warning dark:text-warning-dark">
            {label}
          </span>
        );
      case 'Cancelled':
      case 'Rejected':
        return (
          <span className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-danger dark:text-danger-dark">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-tertiary">
            {label}
          </span>
        );
    }
  };

  const SortableHeader = ({ label, sortKey: sk, className = '' }) => {
    const isSorted = sortKey === sk;
    return (
      <th scope="col" aria-sort={isSorted ? 'ascending' : undefined} className={`p-0 ${className}`}>
        <button
          type="button"
          onClick={() => {
            handleSort(sk);
            setCurrentPage(1);
          }}
          className={`w-full min-h-[2.75rem] px-3 py-2 text-left text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isSorted
              ? 'text-link dark:text-primary-300'
              : 'text-tertiary dark:text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
          }`}
        >
          <span>{label}</span>
          <ArrowsDownUp className={`w-3.5 h-3.5 shrink-0 ${isSorted ? 'text-link' : 'opacity-40'}`} aria-hidden="true" />
          {getSortIndicator(sk)}
        </button>
      </th>
    );
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  const renderRequestInspectorBody = (request) => {
    if (!request) {
      return (
        <div className="py-10 text-center space-y-1.5">
          <p className="text-sm font-bold text-ink dark:text-txt-darkPrimary">
            {t('admin.requests.noneSelected')}
          </p>
          <p className="text-xs text-tertiary">
            {t('admin.requests.noneSelectedHint')}
          </p>
        </div>
      );
    }

    const scheduledDateLabel = formatScheduledDate(request);
    const scheduledTimeLabel = formatScheduledTime(request);

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-surface-border pb-3.5">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-tertiary">{t('admin.requests.serviceProgram')}</p>
            <p className="text-base font-black text-link mt-0.5 truncate">{translateService(request.service)}</p>
            <p className="text-xs font-mono text-tertiary mt-0.5">ID: {request.id.substring(0, 13)}...</p>
          </div>
          {getStatusLabel(request.status)}
        </div>

        {/* Patient & Provider Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
          <Link
            to="/admin/patients"
            className="rounded-xl border border-surface-border bg-surface-subtle/40 p-3 space-y-1.5 block hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-link" aria-hidden="true" />
                {t('admin.requests.residentPatient')}
              </span>
              <CaretRight className="w-3.5 h-3.5 text-link" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link overflow-hidden shrink-0">
                {request.patientAvatar ? (
                  <img src={request.patientAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  request.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-ink dark:text-txt-darkPrimary truncate">{request.patient}</p>
                <p className="text-xs text-tertiary truncate">{request.patientEmail || t('admin.requests.noEmail')}</p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/providers"
            className="rounded-xl border border-surface-border bg-surface-subtle/40 p-3 space-y-1.5 block hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-link" aria-hidden="true" />
                {t('admin.requests.healthcareProvider')}
              </span>
              <CaretRight className="w-3.5 h-3.5 text-link" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 flex items-center justify-center text-xs font-extrabold text-link overflow-hidden shrink-0">
                {request.providerAvatar ? (
                  <img src={request.providerAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  request.provider.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-ink dark:text-txt-darkPrimary truncate">{request.provider}</p>
                <p className="text-xs text-tertiary truncate">{request.providerEmail || t('admin.requests.noEmail')}</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Schedule & Timing Info */}
        <div className="rounded-xl border border-surface-border bg-surface-subtle/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="inline-flex items-center gap-2 text-txt-secondary dark:text-txt-darkSecondary">
              <Calendar className="w-3.5 h-3.5 text-link shrink-0" aria-hidden="true" />
              {t('admin.requests.appointmentDate')}
            </span>
            <span className="font-bold text-ink dark:text-txt-darkPrimary font-mono tabular-nums">{scheduledDateLabel}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="inline-flex items-center gap-2 text-txt-secondary dark:text-txt-darkSecondary">
              <Clock className="w-3.5 h-3.5 text-link shrink-0" aria-hidden="true" />
              {t('admin.requests.timeSlot')}
            </span>
            <span className="font-bold text-ink dark:text-txt-darkPrimary font-mono tabular-nums">{scheduledTimeLabel || t('admin.requests.notSpecified')}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-surface-border">
            <span className="inline-flex items-center gap-2 text-tertiary">
              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {t('admin.requests.requestedAt')}
            </span>
            <span className="text-xs text-tertiary font-mono tabular-nums">
              {formatDate(request.created_at, {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        {/* Patient Request Notes */}
        {request.notes && (
          <div className="space-y-1.5">
            <p className="text-xs text-tertiary font-extrabold uppercase tracking-wider">
              {t('admin.requests.symptomsTitle')}
            </p>
            <div className="rounded-xl border border-surface-border bg-surface-subtle/40 p-3 text-xs font-medium text-txt-secondary dark:text-txt-darkSecondary leading-relaxed">
              {request.notes}
            </div>
          </div>
        )}

        {/* Administrative Override Actions */}
        <div className="space-y-2 pt-2 border-t border-surface-border">
          <p className="text-xs text-tertiary font-extrabold uppercase tracking-wider">
            {t('admin.requests.overrideActions')}
          </p>
          {confirmDelete ? (
            <div
              role="alertdialog"
              aria-label={t('admin.requests.confirmDeleteAria')}
              className="rounded-xl border border-danger/30 bg-danger-soft/60 dark:bg-danger-darkSoft/50 p-3 space-y-2.5"
            >
              <p className="text-xs font-bold text-ink dark:text-txt-darkPrimary">
                {t('admin.requests.confirmDeleteMsg')}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  ref={deleteCancelRef}
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setConfirmDelete(false)}
                  className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary disabled:opacity-50"
                >
                  {t('admin.requests.cancel')}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDeleteRequest(request.id)}
                  className="min-h-[2.75rem] px-3.5 rounded-xl text-xs font-black text-white bg-danger hover:bg-danger/90 disabled:opacity-50"
                >
                  {actionLoading ? t('admin.requests.deleting') : t('admin.requests.confirmDelete')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleUpdateStatus(request.id, 'Accepted')}
                disabled={actionLoading || request.status === 'Accepted'}
                className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-link dark:text-primary-300 transition-all disabled:opacity-40"
              >
                {t('admin.requests.setAccepted')}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(request.id, 'Completed')}
                disabled={actionLoading || request.status === 'Completed'}
                className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-success dark:text-success-dark transition-all disabled:opacity-40"
              >
                {t('admin.requests.setCompleted')}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(request.id, 'Cancelled')}
                disabled={actionLoading || request.status === 'Cancelled'}
                className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-warning dark:text-warning-dark transition-all disabled:opacity-40"
              >
                {t('admin.requests.cancelRequest')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={actionLoading}
                className="neu-btn min-h-[2.75rem] px-3 rounded-xl text-xs font-bold text-danger dark:text-danger-dark transition-all disabled:opacity-40"
              >
                {t('admin.requests.deleteRecord')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="admin">
      <MotionConfig reducedMotion="user">
        <div className="space-y-5 sm:space-y-6 pb-8">
          {/* Page Header & Global Actions (matching Patients.jsx) */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl text-ink dark:text-txt-darkPrimary">
                {t('admin.requests.title')}
              </h1>
              <p className="text-sm text-tertiary dark:text-tertiary mt-1">
                {t('admin.requests.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="w-full sm:w-[10.3125rem]">
                <CustomSelect
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'All', label: t('admin.requests.allStatus') },
                    { value: 'Pending', label: translateStatus('Pending') },
                    { value: 'Accepted', label: translateStatus('Accepted') },
                    { value: 'On The Way', label: translateStatus('On The Way') },
                    { value: 'Arrived', label: translateStatus('Arrived') },
                    { value: 'Completed', label: translateStatus('Completed') },
                    { value: 'Cancelled', label: translateStatus('Cancelled') },
                    { value: 'Rejected', label: translateStatus('Rejected') },
                  ]}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 sm:inline-flex gap-2 w-full sm:w-auto">
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
                  <span>{t('admin.requests.exportCsv')}</span>
                </button>
              </div>
            </div>
          </header>

          {/* Desktop Clinical Split (col-span-8 Directory + col-span-4 Sticky Inspector) */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-5 items-start">
            <section
              className="col-span-8 neu-flat rounded-3xl p-5 space-y-4"
              aria-label={t('admin.requests.directoryAria')}
            >
              <div className="relative">
                <MagnifyingGlass className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  aria-label={t('admin.requests.searchAria')}
                  placeholder={t('admin.requests.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-[2.75rem] pl-10 pr-4 rounded-xl border border-surface-border bg-surface-subtle/50 text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              {paginatedRequests.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon="inbox" title={t('admin.requests.emptyTitle')} message={t('admin.requests.emptyMsg')} variant="compact" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <caption className="sr-only">{t('admin.requests.tableCaption')}</caption>
                    <thead>
                      <tr className="border-b border-surface-border">
                        <SortableHeader label={t('admin.requests.colPatient')} sortKey="patient" />
                        <SortableHeader label={t('admin.requests.colService')} sortKey="service" />
                        <SortableHeader label={t('admin.requests.colScheduled')} sortKey="scheduledTimestamp" />
                        <SortableHeader label={t('admin.requests.colStatus')} sortKey="status" />
                        <th scope="col" className="py-2 px-3 text-right text-xs font-extrabold uppercase tracking-wider text-tertiary">
                          {t('admin.requests.colInspector')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/70">
                      {paginatedRequests.map((r) => {
                        const isInspected = inspectedRequest?.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => openInspector(r)}
                            className={`cursor-pointer transition-colors ${
                              isInspected
                                ? 'bg-primary-soft/55 dark:bg-primary-800/40'
                                : 'hover:bg-surface-subtle/60'
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link flex items-center justify-center text-xs font-extrabold shrink-0 overflow-hidden">
                                  {r.patientAvatar ? (
                                    <img src={r.patientAvatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    r.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-ink dark:text-txt-darkPrimary truncate">
                                    {r.patient}
                                  </p>
                                  <p className="text-xs text-tertiary font-medium truncate">
                                    {r.provider}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-xs font-semibold text-ink dark:text-txt-darkPrimary">
                              {translateService(r.service)}
                            </td>

                            <td className="py-2.5 px-3 text-xs font-mono text-tertiary whitespace-nowrap tabular-nums">
                              {formatScheduledDate(r)}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {getStatusLabel(r.status)}
                            </td>

                            <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openInspector(r)}
                                className={`min-h-[2.75rem] px-3 rounded-xl text-xs font-bold transition-colors ${
                                  isInspected
                                    ? 'text-link dark:text-primary-300'
                                    : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                                }`}
                              >
                                {isInspected ? t('admin.requests.inspecting') : t('admin.requests.inspect')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2 border-t border-surface-border flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-tertiary tabular-nums">
                  {filteredRequests.length === 0
                    ? t('admin.requests.zeroRequests')
                    : t('admin.requests.showingRange', {
                        start: (currentPage - 1) * PAGE_SIZE + 1,
                        end: Math.min(currentPage * PAGE_SIZE, filteredRequests.length),
                        total: filteredRequests.length,
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
              aria-label={t('admin.requests.inspectorAria')}
            >
              <div className="pb-3.5 mb-4 border-b border-surface-border">
                <h2 className="font-display font-black text-base text-ink dark:text-txt-darkPrimary">
                  {t('admin.requests.dossierTitle')}
                </h2>
                <p className="text-xs text-tertiary mt-0.5">
                  {t('admin.requests.dossierSubtitle')}
                </p>
              </div>
              {renderRequestInspectorBody(inspectedRequest)}
            </aside>
          </div>

          {/* Mobile / Tablet View (< lg) */}
          <div className="block lg:hidden space-y-3.5">
            <div className="neu-flat rounded-2xl p-3.5">
              <div className="relative">
                <MagnifyingGlass className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  aria-label={t('admin.requests.searchAria')}
                  placeholder={t('admin.requests.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-[2.75rem] pl-10 pr-4 rounded-xl border border-surface-border bg-surface-subtle/50 text-base sm:text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </div>

            {paginatedRequests.length === 0 ? (
              <div className="neu-flat p-6 rounded-2xl">
                <EmptyState icon="inbox" title={t('admin.requests.emptyTitle')} message={t('admin.requests.emptyMsg')} variant="compact" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {paginatedRequests.map((r) => {
                  const dateLabel = formatScheduledDate(r);
                  const timeLabel = formatScheduledTime(r);
                  return (
                    <article
                      key={r.id}
                      className="neu-flat p-4 rounded-2xl space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2.5">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-primary-soft dark:bg-primary-800/70 text-link flex items-center justify-center text-xs font-extrabold shrink-0 overflow-hidden">
                              {r.patientAvatar ? (
                                <img src={r.patientAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                r.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-link truncate">{translateService(r.service)}</p>
                              <p className="font-bold text-sm text-ink dark:text-txt-darkPrimary truncate">{r.patient}</p>
                              <p className="text-xs text-tertiary truncate">{r.provider}</p>
                            </div>
                          </div>

                          {getStatusLabel(r.status)}
                        </div>

                        <div className="rounded-xl border border-surface-border bg-surface-subtle/40 px-3 py-2 text-xs flex items-center justify-between gap-2">
                          <span className="text-tertiary font-bold uppercase tracking-wider">{t('admin.requests.colScheduled')}</span>
                          <span className="font-mono tabular-nums text-ink dark:text-txt-darkPrimary">
                            {timeLabel ? t('admin.requests.scheduledAt', { date: dateLabel, time: timeLabel }) : dateLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={(event) => openInspector(r, event.currentTarget)}
                          className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-extrabold text-link hover:text-primary-focus transition-colors"
                        >
                          {t('admin.requests.inspect')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="neu-flat rounded-2xl p-3">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Slide-Up Request Dossier Sheet */}
        <Sheet
          open={!isDesktop && Boolean(inspectedRequest)}
          onOpenChange={(open) => {
            if (!open) setMobileSheetRequestId(null);
          }}
        >
          {!isDesktop && inspectedRequest && (
            <SheetContent
              side="bottom"
              onCloseAutoFocus={(event) => {
                if (!modalTriggerRef.current) return;
                event.preventDefault();
                modalTriggerRef.current.focus();
              }}
              className="px-4 sm:px-5 pt-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:max-w-lg sm:mx-auto sm:rounded-[2rem] bg-surface dark:bg-surface-dark border-t sm:border border-white/70 dark:border-white/10 shadow-2xl"
            >
              <div
                className="mx-auto mt-3 mb-1.5 h-1.5 w-11 rounded-full bg-slate-300/90 dark:bg-slate-600/80 sm:hidden shrink-0"
                aria-hidden="true"
              />
              <SheetHeader className="px-1 pt-3 pb-3.5 text-left ring-0 border-b border-surface-border">
                <SheetTitle className="text-lg font-display font-black text-ink dark:text-txt-darkPrimary">
                  {t('admin.requests.dossierTitle')}
                </SheetTitle>
                <SheetDescription className="text-xs font-semibold text-tertiary">
                  {t('admin.requests.dossierSubtitle')}
                </SheetDescription>
              </SheetHeader>

              <div className="px-1 pt-4">
                {renderRequestInspectorBody(inspectedRequest)}
              </div>
            </SheetContent>
          )}
        </Sheet>
      </MotionConfig>
    </DashboardLayout>
  );
};

export default AdminRequests;
