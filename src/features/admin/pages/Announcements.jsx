import { useState, useEffect, useCallback, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  PaperPlaneRight,
  Trash,
  Users,
  Briefcase,
  Database,
  Check,
  MagnifyingGlass,
  X,
  CalendarPlus,
  Megaphone,
  UploadSimple,
  Image,
  SpinnerGap,
  LinkSimple,
  ArrowSquareOut,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { MotionConfig } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import useSearchQueryParam from '@/hooks/useSearchQueryParam';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import {
  normalizeEventLink,
  isExternalEventLink,
  formatEventDateLabel,
  compressEventImage,
  encodeRecentEventMessage,
  parseAnnouncementRecord,
  isWithinLastSevenDays,
} from '@/features/admin/utils/recentEvents';
import toast from 'react-hot-toast';

const TARGET_OPTION_SPECS = [
  { value: 'all', labelKey: 'admin.announcements.audienceAllLabel', icon: Users, descKey: 'admin.announcements.audienceAllDesc' },
  { value: 'patients', labelKey: 'admin.announcements.audiencePatientsLabel', icon: Users, descKey: 'admin.announcements.audiencePatientsDesc' },
  { value: 'providers', labelKey: 'admin.announcements.audienceProvidersLabel', icon: Briefcase, descKey: 'admin.announcements.audienceProvidersDesc' },
];

const AUDIENCE_LABEL_KEYS = {
  all: 'admin.announcements.audienceAllLabel',
  patients: 'admin.announcements.audiencePatientsLabel',
  providers: 'admin.announcements.audienceProvidersLabel',
};

const MAX_EVENT_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 120;
const MAX_EVENT_TAG_LENGTH = 50;
const MAX_EVENT_DESC_LENGTH = 240;
const MAX_BROADCAST_LENGTH = 2000;

const EVENT_TAG_SUGGESTIONS = [
  'Barangay Health Caravan',
  'Medical Mission',
  'Vaccination Drive',
  'Mobile Health Clinic',
  'Senior Care & Wellness',
  'Health Advisory',
];

const AdminAnnouncements = () => {
  const { user } = useAuth();
  const { t, language, formatDate, formatTime } = useLanguage();
  const tRef = useRef(t);
  tRef.current = t;
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  // Composer Mode: 'broadcast' | 'event'
  const [composerMode, setComposerMode] = useState('broadcast');
  const [eventTag, setEventTag] = useState('Barangay Health Event');
  const [eventImage, setEventImage] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [tableMissing, setTableMissing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  useSearchQueryParam(['q'], ({ q }) => {
    if (q) {
      setHistorySearch(q);
      setHistoryFilter('all');
    }
  });
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const modalTriggerRef = useRef(null);
  const sendCancelRef = useRef(null);
  const deleteCancelRef = useRef(null);

  const fetchAnnouncements = useCallback(async () => {
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
        setTableMissing(true);
        return;
      }
      if (error) throw error;

      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setFetchError(tRef.current('admin.announcements.loadErrorMsg'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (confirmSend && sendCancelRef.current) {
      sendCancelRef.current.focus();
    }
  }, [confirmSend]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [selectedAnnouncement?.id]);

  useEffect(() => {
    if (confirmDelete && deleteCancelRef.current) {
      deleteCancelRef.current.focus();
    }
  }, [confirmDelete]);

  const handleEventImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.announcements.toastInvalidImage'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_EVENT_IMAGE_BYTES) {
      toast.error(t('admin.announcements.toastImageTooLarge'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const { blob, dataUrl, ext, contentType } = await compressEventImage(file);
      const fileName = `event-${Date.now()}.${ext}`;
      const ownerId = user?.id || 'admin';
      const storagePath = `avatars/${ownerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(storagePath, blob, { contentType, upsert: false });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(storagePath);

        if (publicUrlData?.publicUrl) {
          setEventImage(publicUrlData.publicUrl);
          if (confirmSend) setConfirmSend(false);
          toast.success(t('admin.announcements.toastPhotoUploaded'));
          return;
        }
      }

      // If storage bucket/policy isn't configured yet, use compressed data URL so event publishing still works
      if (dataUrl) {
        setEventImage(dataUrl);
        if (confirmSend) setConfirmSend(false);
        toast.success(t('admin.announcements.toastPhotoReady'));
        return;
      }

      throw uploadError || new Error('Could not process uploaded image');
    } catch (err) {
      console.error('Event image upload failed:', err);
      toast.error(t('admin.announcements.toastPhotoError'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadingImage(false);
    }
  };

  const handleRequestSend = () => {
    if (!title.trim() || !message.trim()) {
      toast.error(t('admin.announcements.toastFillFields'));
      return;
    }
    if (composerMode === 'event' && !eventImage.trim()) {
      toast.error(t('admin.announcements.toastNeedCoverPhoto'));
      return;
    }
    if (composerMode === 'event' && eventLink.trim() && !normalizeEventLink(eventLink)) {
      toast.error(t('admin.announcements.toastInvalidUrl'));
      return;
    }
    setConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      const payloadMessage =
        composerMode === 'event'
          ? encodeRecentEventMessage({
              tag: eventTag,
              image: eventImage,
              link: eventLink,
              eventDate,
              description: message,
            })
          : message.trim();

      const { data, error } = await supabase
        .from('announcements')
        .insert([
          {
            title: title.trim(),
            message: payloadMessage,
            target_audience: target,
            created_by: user?.id,
          },
        ])
        .select();

      if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
        setTableMissing(true);
        setConfirmSend(false);
        toast.error(t('admin.announcements.toastTableMissing'));
        return;
      }
      if (error) throw error;

      if (data) {
        toast.success(
          composerMode === 'event'
            ? t('admin.announcements.toastEventAdded')
            : t('admin.announcements.toastPublished')
        );
        setAnnouncements((prev) => [...data, ...prev]);
      }

      setTitle('');
      setMessage('');
      setEventImage('');
      setEventLink('');
      setEventDate('');
      setEventTag('Barangay Health Event');
      setTarget('all');
      setConfirmSend(false);
    } catch {
      toast.error(t('admin.announcements.toastPublishError'));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setConfirmDelete(false);
      if (selectedAnnouncement?.id === id) setSelectedAnnouncement(null);
      toast.success(t('admin.announcements.toastDeleted'));
    } catch {
      toast.error(t('admin.announcements.toastDeleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const parsedAnnouncements = announcements.map(parseAnnouncementRecord).filter(Boolean);

  const filteredHistory = parsedAnnouncements.filter((a) => {
    const q = historySearch.toLowerCase();
    const matchesSearch =
      a.title?.toLowerCase().includes(q) ||
      a.cleanMessage?.toLowerCase().includes(q) ||
      a.eventTag?.toLowerCase().includes(q);
    const matchesTarget =
      historyFilter === 'all' ||
      (a.target_audience || 'all').toLowerCase() === historyFilter.toLowerCase();
    return matchesSearch && matchesTarget;
  });

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const selectedAudienceLabel = t(AUDIENCE_LABEL_KEYS[target] || 'admin.announcements.audienceAllLabel');
  const hasActiveFilters = Boolean(historySearch.trim()) || historyFilter !== 'all';
  const parsedSelected = selectedAnnouncement
    ? parseAnnouncementRecord(selectedAnnouncement)
    : null;
  const isSubmitDisabled =
    sending ||
    uploadingImage ||
    tableMissing ||
    !title.trim() ||
    !message.trim() ||
    (composerMode === 'event' &&
      (!eventImage.trim() || (Boolean(eventLink.trim()) && !normalizeEventLink(eventLink))));

  return (
    <DashboardLayout role="admin">
      <MotionConfig reducedMotion="user">
        <div className="space-y-5 sm:space-y-6 pb-8">
          {/* Page Header on Canvas */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display font-black tracking-tight text-2xl sm:text-3xl text-ink dark:text-txt-darkPrimary">
                {t('admin.announcements.title')}
              </h1>
              <p className="text-sm text-tertiary dark:text-tertiary mt-1">
                {t('admin.announcements.subtitle')}
              </p>
            </div>

            <div
              role="group"
              aria-label={t('admin.announcements.audienceFilterAria')}
              className="hidden lg:inline-flex items-center gap-1 h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/70 p-1 shrink-0"
            >
              {[
                { value: 'all', label: t('admin.announcements.tabAll') },
                { value: 'patients', label: t('admin.announcements.tabPatients') },
                { value: 'providers', label: t('admin.announcements.tabProviders') },
              ].map((tab) => {
                const isActive = historyFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setHistoryFilter(tab.value)}
                    className={`h-full px-3.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'neu-btn-primary text-white dark:text-neu-fg'
                        : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* Database notice if table missing */}
          {tableMissing && (
            <div
              role="status"
              className="rounded-2xl border border-warning/30 bg-warning-soft/75 dark:bg-warning-darkSoft/70 p-4 flex items-start gap-3"
            >
              <Database className="w-5 h-5 text-warning dark:text-warning-dark shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink dark:text-txt-darkPrimary text-sm">
                  {t('admin.announcements.tableMissingTitle')}
                </p>
                <p className="text-txt-secondary dark:text-txt-darkSecondary text-xs mt-1">
                  {t('admin.announcements.tableMissingPrefix')}{' '}
                  <code className="px-1.5 py-0.5 rounded border border-surface-border bg-surface-subtle/60 text-link font-mono text-xs">
                    supabase-migration.sql
                  </code>{' '}
                  {t('admin.announcements.tableMissingSuffix')}
                </p>
              </div>
            </div>
          )}

          {/* Fetch Error State */}
          {fetchError && (
            <section
              role="alert"
              className="neu-flat rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-surface-border"
            >
              <div className="space-y-1">
                <h2 className="font-display font-bold text-base text-ink dark:text-txt-darkPrimary">
                  {t('admin.announcements.loadErrorTitle')}
                </h2>
                <p className="text-sm text-txt-secondary dark:text-txt-darkSecondary">{fetchError}</p>
              </div>
              <button
                type="button"
                onClick={fetchAnnouncements}
                className="neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] px-5 rounded-xl text-xs font-bold shrink-0"
              >
                {t('admin.announcements.retry')}
              </button>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Compose Broadcast or Add Recent Event (7 cols) */}
            <section
              aria-label={t('admin.announcements.composeAria')}
              className="lg:col-span-7 neu-flat p-5 sm:p-6 rounded-3xl space-y-5"
            >
              <div className="border-b border-surface-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-display font-black text-ink dark:text-txt-darkPrimary">
                    {composerMode === 'event' ? t('admin.announcements.addEventTitle') : t('admin.announcements.composeTitle')}
                  </h2>
                  <p className="text-xs text-tertiary mt-0.5">
                    {composerMode === 'event'
                      ? t('admin.announcements.addEventSubtitle')
                      : t('admin.announcements.composeSubtitle')}
                  </p>
                </div>

                {/* Simple Mode Switcher: Broadcast vs Add Recent Event */}
                <div
                  role="group"
                  aria-label={t('admin.announcements.typeAria')}
                  className="neu-inset p-1 rounded-xl inline-flex items-center gap-1 self-start sm:self-auto shrink-0"
                >
                  <button
                    type="button"
                    aria-pressed={composerMode === 'broadcast'}
                    onClick={() => {
                      setComposerMode('broadcast');
                      setConfirmSend(false);
                    }}
                    className={`min-h-[2.375rem] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      composerMode === 'broadcast'
                        ? 'neu-btn-primary text-white dark:text-neu-fg shadow-sm'
                        : 'text-tertiary hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    <Megaphone className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('admin.announcements.modeBroadcast')}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={composerMode === 'event'}
                    onClick={() => {
                      setComposerMode('event');
                      if (message.length > MAX_EVENT_DESC_LENGTH) {
                        setMessage((prev) => prev.slice(0, MAX_EVENT_DESC_LENGTH));
                      }
                      setConfirmSend(false);
                    }}
                    className={`min-h-[2.375rem] px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                      composerMode === 'event'
                        ? 'neu-btn-primary text-white dark:text-neu-fg shadow-sm'
                        : 'text-tertiary hover:text-ink dark:hover:text-white'
                    }`}
                  >
                    <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('admin.announcements.modeEvent')}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Target Audience Selector */}
                <div className="space-y-2">
                  <span
                    id="audience-group-label"
                    className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                  >
                    {t('admin.announcements.targetAudience')}
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="audience-group-label"
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                  >
                    {TARGET_OPTION_SPECS.map((opt) => {
                      const isSelected = target === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => {
                            setTarget(opt.value);
                            setConfirmSend(false);
                          }}
                          className={`min-h-[2.75rem] p-3.5 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            isSelected
                              ? 'border-primary bg-primary-soft/55 dark:bg-primary-800/35 text-link'
                              : 'border-surface-border bg-surface-subtle/40 text-txt-secondary dark:text-txt-darkSecondary hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-link' : 'text-tertiary'}`} aria-hidden="true" />
                            {isSelected && <Check className="w-4 h-4 text-link stroke-[2.5]" aria-hidden="true" />}
                          </div>
                          <p className="font-bold text-xs mt-2 text-ink dark:text-txt-darkPrimary">
                            {t(opt.labelKey)}
                          </p>
                          <p className="text-xs text-tertiary mt-0.5 leading-snug">
                            {t(opt.descKey)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Event Cover Photo Upload + Category Tag */}
                {composerMode === 'event' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-extrabold uppercase tracking-wider text-tertiary">
                        {t('admin.announcements.coverPhotoLabel')}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleEventImageUpload}
                        className="sr-only"
                        id="event-photo-upload"
                      />
                      <div className="rounded-2xl border border-dashed border-surface-border bg-surface-subtle/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="neu-flat-sm w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 text-link">
                            {eventImage ? (
                              <img
                                src={eventImage}
                                alt={t('admin.announcements.coverPhotoAlt')}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Image className="w-5 h-5 text-tertiary" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-ink dark:text-txt-darkPrimary truncate">
                              {uploadingImage
                                ? t('admin.announcements.uploadingPhoto')
                                : eventImage
                                ? t('admin.announcements.coverPhotoReady')
                                : t('admin.announcements.uploadBannerHint')}
                            </p>
                            <p className="text-xs text-tertiary mt-0.5">
                              {t('admin.announcements.fileHint')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {eventImage && !uploadingImage && (
                            <button
                              type="button"
                              onClick={() => {
                                setEventImage('');
                                if (confirmSend) setConfirmSend(false);
                              }}
                              className="neu-btn min-h-[2.75rem] px-3.5 rounded-xl text-xs font-bold text-danger dark:text-danger-dark cursor-pointer"
                            >
                              {t('admin.announcements.removePhoto')}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={uploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                            className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-link inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {uploadingImage ? (
                              <SpinnerGap className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <UploadSimple className="w-4 h-4" aria-hidden="true" />
                            )}
                            <span>{eventImage ? t('admin.announcements.changePhoto') : t('admin.announcements.uploadPhoto')}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="event-tag-input"
                        className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                      >
                        {t('admin.announcements.eventTagLabel')}
                      </label>
                      <input
                        id="event-tag-input"
                        type="text"
                        maxLength={MAX_EVENT_TAG_LENGTH}
                        value={eventTag}
                        onChange={(e) => setEventTag(e.target.value)}
                        placeholder={t('admin.announcements.eventTagPlaceholder')}
                        className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 px-3.5 text-sm font-semibold text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[0.6875rem] font-semibold text-tertiary mr-1">
                          {t('admin.announcements.suggestions')}
                        </span>
                        {EVENT_TAG_SUGGESTIONS.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setEventTag(tag);
                              if (confirmSend) setConfirmSend(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold transition-colors cursor-pointer ${
                              eventTag.trim() === tag
                                ? 'bg-primary text-white'
                                : 'neu-btn text-txt-secondary dark:text-txt-darkSecondary hover:text-link'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="event-date-input"
                          className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                        >
                          {t('admin.announcements.eventDateLabel')}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="event-date-input"
                            type="date"
                            value={eventDate}
                            onChange={(e) => {
                              setEventDate(e.target.value);
                              if (confirmSend) setConfirmSend(false);
                            }}
                            className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 px-3.5 text-sm font-semibold text-ink dark:text-txt-darkPrimary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          {eventDate && (
                            <button
                              type="button"
                              onClick={() => setEventDate('')}
                              aria-label={t('admin.announcements.clearEventDateAria')}
                              className="neu-btn h-[2.75rem] px-3 rounded-xl text-xs font-bold text-tertiary hover:text-ink dark:hover:text-white shrink-0 cursor-pointer"
                            >
                              {t('admin.announcements.clearBtn')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="event-link-input"
                          className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                        >
                          {t('admin.announcements.goToLinkLabel')}
                        </label>
                        <div className="relative">
                          <LinkSimple
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            id="event-link-input"
                            type="text"
                            value={eventLink}
                            onChange={(e) => {
                              setEventLink(e.target.value);
                              if (confirmSend) setConfirmSend(false);
                            }}
                            placeholder="https://... or /patient/providers"
                            className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 pl-10 pr-9 text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                          {eventLink && (
                            <button
                              type="button"
                              onClick={() => setEventLink('')}
                              aria-label={t('admin.announcements.clearEventLinkAria')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tertiary hover:text-ink dark:hover:text-white p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {eventLink.trim() && !normalizeEventLink(eventLink) && (
                      <p className="text-xs font-semibold text-danger dark:text-danger-dark">
                        {t('admin.announcements.invalidLinkHint')}
                      </p>
                    )}
                  </div>
                )}

                {/* Title Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="announcement-title"
                      className="block text-xs font-extrabold uppercase tracking-wider text-tertiary"
                    >
                      {composerMode === 'event' ? t('admin.announcements.eventHeadlineLabel') : t('admin.announcements.announcementTitleLabel')}
                    </label>
                    <span className="text-xs font-mono text-tertiary tabular-nums">
                      {title.length}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                  <input
                    id="announcement-title"
                    type="text"
                    maxLength={MAX_TITLE_LENGTH}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (confirmSend) setConfirmSend(false);
                    }}
                    placeholder={t('admin.announcements.titlePlaceholder')}
                    className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 px-4 text-base sm:text-sm font-semibold text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
                  />
                </div>

                {/* Message Body Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="announcement-message"
                      className="text-xs font-extrabold uppercase tracking-wider text-tertiary"
                    >
                      {composerMode === 'event' ? t('admin.announcements.eventDescLabel') : t('admin.announcements.broadcastDescLabel')}
                    </label>
                    <span className="text-xs font-mono text-tertiary tabular-nums">
                      {message.length}/
                      {composerMode === 'event' ? MAX_EVENT_DESC_LENGTH : MAX_BROADCAST_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="announcement-message"
                    maxLength={
                      composerMode === 'event' ? MAX_EVENT_DESC_LENGTH : MAX_BROADCAST_LENGTH
                    }
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (confirmSend) setConfirmSend(false);
                    }}
                    placeholder={
                      composerMode === 'event'
                        ? t('admin.announcements.eventDescPlaceholder')
                        : t('admin.announcements.broadcastDescPlaceholder')
                    }
                    rows={composerMode === 'event' ? 3 : 5}
                    className="w-full rounded-xl border border-surface-border bg-surface-subtle/50 p-3.5 text-base sm:text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all resize-none leading-relaxed"
                  />
                </div>

                {/* Live Carousel Preview when in Event mode */}
                {composerMode === 'event' && (
                  <div className="space-y-2">
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-tertiary">
                      {t('admin.announcements.previewLabel')}
                    </span>
                    <div className="relative h-48 sm:h-56 w-full rounded-2xl overflow-hidden border border-surface-border shadow-md bg-slate-900">
                      {eventImage ? (
                        <img
                          src={eventImage}
                          alt={t('admin.announcements.previewAlt')}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Image className="w-8 h-8 opacity-50" aria-hidden="true" />
                          <span className="text-xs font-semibold">
                            {t('admin.announcements.previewUploadHint')}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/88 via-50% to-slate-950/10 pointer-events-none" />
                      <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end pointer-events-none">
                        <div className="space-y-1.5 max-w-2xl min-w-0">
                          <h3 className="text-lg sm:text-xl font-display font-black tracking-tight text-white line-clamp-2 leading-[1.18] [overflow-wrap:anywhere]">
                            {title.trim() || t('admin.announcements.previewDefaultTitle')}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-200/95 line-clamp-2 leading-relaxed font-medium [overflow-wrap:anywhere]">
                            {message.trim() || t('admin.announcements.previewDefaultDesc')}
                          </p>
                          {(eventDate || normalizeEventLink(eventLink)) && (
                            <div className="pt-1 flex flex-wrap items-center gap-3 text-xs font-bold">
                              {eventDate && (
                                <span className="text-slate-200">
                                  {formatEventDateLabel(eventDate, language)}
                                </span>
                              )}
                              {normalizeEventLink(eventLink) && (
                                <span className="inline-flex items-center gap-1 text-primary-400">
                                  <span>
                                    {isExternalEventLink(normalizeEventLink(eventLink))
                                      ? t('admin.announcements.opensExternal')
                                      : t('admin.announcements.opensRoute', { route: normalizeEventLink(eventLink) })}
                                  </span>
                                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pre-send Confirmation or Primary CTA */}
                {confirmSend ? (
                  <div
                    role="alertdialog"
                    aria-label={t('admin.announcements.confirmAria')}
                    className="rounded-xl border border-primary/35 bg-primary-soft/45 dark:bg-primary-800/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <p className="text-xs font-bold text-ink dark:text-txt-darkPrimary">
                      {composerMode === 'event' ? t('admin.announcements.confirmActionEvent') : t('admin.announcements.confirmActionPublish')}{' '}
                      <span className="text-link">&ldquo;{title.trim()}&rdquo;</span> {t('admin.announcements.confirmTo')}{' '}
                      <span className="font-extrabold">{selectedAudienceLabel}</span>?
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        ref={sendCancelRef}
                        type="button"
                        disabled={sending}
                        onClick={() => setConfirmSend(false)}
                        className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary disabled:opacity-50"
                      >
                        {t('admin.announcements.cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={sending}
                        onClick={handleConfirmSend}
                        className="neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] px-4 rounded-xl text-xs font-extrabold disabled:opacity-50"
                      >
                        {sending ? t('admin.announcements.publishing') : t('admin.announcements.confirmPublish')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestSend}
                    disabled={isSubmitDisabled}
                    className="w-full neu-btn-primary text-white dark:text-neu-fg min-h-[2.75rem] flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all disabled:opacity-40"
                  >
                    {composerMode === 'event' ? (
                      <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <PaperPlaneRight className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>
                      {composerMode === 'event' ? t('admin.announcements.modeEvent') : t('admin.announcements.publishBtn')}
                    </span>
                  </button>
                )}
              </div>
            </section>

            {/* Right Column: Sent Announcements Archive (5 cols) */}
            <aside
              aria-label={t('admin.announcements.historyAria')}
              className="lg:col-span-5 neu-flat p-5 rounded-3xl space-y-4"
            >
              <div className="border-b border-surface-border pb-3.5">
                <h2 className="text-base font-display font-black text-ink dark:text-txt-darkPrimary">
                  {t('admin.announcements.historyTitle')}
                </h2>
                <p className="text-xs text-tertiary mt-0.5 tabular-nums">
                  {filteredHistory.length === 1
                    ? t('admin.announcements.countSingular', { count: filteredHistory.length })
                    : t('admin.announcements.countPlural', { count: filteredHistory.length })}
                </p>
              </div>

              <div className="relative">
                <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  aria-label={t('admin.announcements.searchAria')}
                  placeholder={t('admin.announcements.searchPlaceholder')}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/50 pl-10 pr-4 text-base sm:text-sm font-medium text-ink dark:text-txt-darkPrimary placeholder:text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
                />
              </div>

              {/* Mobile / Tablet Audience Filter (< lg) */}
              <div
                role="group"
                aria-label={t('admin.announcements.audienceFilterAria')}
                className="lg:hidden grid grid-cols-3 gap-1 h-[2.75rem] rounded-xl border border-surface-border bg-surface-subtle/70 p-1"
              >
                {[
                  { value: 'all', label: t('admin.announcements.tabAll') },
                  { value: 'patients', label: t('admin.announcements.tabPatients') },
                  { value: 'providers', label: t('admin.announcements.tabProviders') },
                ].map((tab) => {
                  const isActive = historyFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setHistoryFilter(tab.value)}
                      className={`h-full rounded-lg text-xs font-bold transition-colors ${
                        isActive
                          ? 'neu-btn-primary text-white dark:text-neu-fg'
                          : 'text-tertiary hover:text-ink dark:hover:text-txt-darkPrimary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Announcements List */}
              {filteredHistory.length === 0 ? (
                <div className="py-6 text-center space-y-3">
                  <EmptyState
                    icon="bell"
                    title={hasActiveFilters ? t('admin.announcements.emptyMatchTitle') : t('admin.announcements.emptyYetTitle')}
                    message={
                      hasActiveFilters
                        ? t('admin.announcements.emptyMatchMsg')
                        : t('admin.announcements.emptyYetMsg')
                    }
                    variant="compact"
                  />
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryFilter('all');
                      }}
                      className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-link"
                    >
                      {t('admin.announcements.resetFilters')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-surface-border/70">
                  {filteredHistory.map((a) => {
                    const audienceKey = (a.target_audience || 'all').toLowerCase();
                    const audienceLabel = t(AUDIENCE_LABEL_KEYS[audienceKey] || 'admin.announcements.audienceAllLabel');
                    const isActive7d = isWithinLastSevenDays(a.created_at);
                    return (
                      <article key={a.id} className="py-3.5 first:pt-1 last:pb-1 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-link">
                              {audienceLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[0.625rem] font-extrabold uppercase tracking-wider bg-primary/10 text-link">
                              {a.isEvent ? t('admin.announcements.badgeEvent') : t('admin.announcements.badgeAnnouncement')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[0.625rem] font-extrabold uppercase tracking-wider ${
                                isActive7d
                                  ? 'bg-emerald-500/10 text-success dark:text-success-dark'
                                  : 'bg-slate-200/70 dark:bg-white/10 text-tertiary'
                              }`}
                            >
                              {isActive7d ? t('admin.announcements.badgeLive') : t('admin.announcements.badgeExpired')}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-tertiary tabular-nums">
                            {formatDate(a.created_at, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm text-ink dark:text-txt-darkPrimary leading-snug line-clamp-2 [overflow-wrap:anywhere]">
                          {a.title}
                        </h3>

                        <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary line-clamp-2 leading-relaxed [overflow-wrap:anywhere]">
                          {a.cleanMessage}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-tertiary font-mono tabular-nums">
                            {formatTime(a.created_at, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              modalTriggerRef.current = event.currentTarget;
                              setSelectedAnnouncement(a);
                            }}
                            className="min-h-[2.75rem] px-3 -mr-3 rounded-xl text-xs font-extrabold text-link hover:bg-primary-soft/50 transition-colors"
                          >
                            {t('admin.announcements.viewDetails')}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Accessible Announcement Record Dialog */}
        <DialogPrimitive.Root
          open={Boolean(parsedSelected)}
          onOpenChange={(open) => {
            if (!open) setSelectedAnnouncement(null);
          }}
        >
          {parsedSelected && (
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay
                onClick={() => {
                  if (!deleting) {
                    setConfirmDelete(false);
                    setSelectedAnnouncement(null);
                  }
                }}
                className="fixed inset-0 z-overlay bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
              />
              <DialogPrimitive.Content
                aria-modal="true"
                onCloseAutoFocus={(event) => {
                  if (!modalTriggerRef.current) return;
                  event.preventDefault();
                  modalTriggerRef.current.focus();
                }}
                onInteractOutside={(event) => {
                  if (deleting) event.preventDefault();
                }}
                onClick={() => {
                  if (!deleting) {
                    setConfirmDelete(false);
                    setSelectedAnnouncement(null);
                  }
                }}
                className="fixed inset-0 z-overlay flex items-center justify-center p-3 sm:p-4 md:p-6"
              >
                <div
                  className="neu-flat rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden border border-surface-border shadow-2xl bg-surface-shell pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="p-4 sm:p-6 border-b border-surface-border flex items-center justify-between gap-3 sticky top-0 bg-surface-shell z-10">
                    <div className="min-w-0">
                      <DialogPrimitive.Title asChild>
                        <h2 className="text-lg font-display font-black text-ink dark:text-txt-darkPrimary">
                          {parsedSelected.isEvent ? t('admin.announcements.modalEventRecord') : t('admin.announcements.modalAnnouncementRecord')}
                        </h2>
                      </DialogPrimitive.Title>
                      <p className="text-xs text-tertiary mt-0.5">
                        {t(AUDIENCE_LABEL_KEYS[(parsedSelected.target_audience || 'all').toLowerCase()] || 'admin.announcements.audienceAllLabel')}
                      </p>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                    {parsedSelected.isEvent && parsedSelected.eventImage && (
                      <div className="relative h-40 w-full rounded-2xl overflow-hidden border border-surface-border">
                        <img
                          src={parsedSelected.eventImage}
                          alt={parsedSelected.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                        {parsedSelected.eventTag && (
                          <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-lg text-[0.625rem] font-extrabold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                            {parsedSelected.eventTag}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-ink dark:text-txt-darkPrimary [overflow-wrap:anywhere]">
                        {parsedSelected.title}
                      </h3>
                      <p className="text-xs font-mono text-tertiary mt-1 tabular-nums">
                        {parsedSelected.eventDate
                          ? t('admin.announcements.modalEventDate', { date: formatEventDateLabel(parsedSelected.eventDate, language) })
                          : ''}
                        {t('admin.announcements.modalDispatchedOn')}
                        {formatDate(parsedSelected.created_at, {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        {formatTime(parsedSelected.created_at, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="rounded-xl border border-surface-border bg-surface-subtle/40 p-4 text-xs sm:text-sm font-medium text-txt-secondary dark:text-txt-darkSecondary leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {parsedSelected.cleanMessage}
                    </div>

                    {parsedSelected.eventLink && (
                      <div className="rounded-xl border border-surface-border bg-surface-subtle/40 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-tertiary">
                            {t('admin.announcements.goToLinkLabel')}
                          </p>
                          <p className="text-xs font-semibold text-link truncate mt-0.5">
                            {parsedSelected.eventLink}
                          </p>
                        </div>
                        {isExternalEventLink(parsedSelected.eventLink) && (
                          <a
                            href={parsedSelected.eventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="neu-btn min-h-[2.25rem] px-3 rounded-lg text-xs font-bold text-link inline-flex items-center gap-1 shrink-0"
                          >
                            <span>{t('admin.announcements.modalTestLink')}</span>
                            <ArrowSquareOut className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer with Inline Delete Confirmation */}
                  <div className="p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-surface-border bg-surface-shell/60">
                    {confirmDelete ? (
                      <div
                        role="alertdialog"
                        aria-label={t('admin.announcements.confirmDeleteAria')}
                        className="rounded-xl border border-danger/30 bg-danger-soft/60 dark:bg-danger-darkSoft/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <p className="text-xs font-bold text-ink dark:text-txt-darkPrimary">
                          {t('admin.announcements.confirmDeleteMsg')}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            ref={deleteCancelRef}
                            type="button"
                            disabled={deleting}
                            onClick={() => setConfirmDelete(false)}
                            className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-ink dark:text-txt-darkPrimary disabled:opacity-50"
                          >
                            {t('admin.announcements.cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => handleDelete(parsedSelected.id)}
                            className="min-h-[2.75rem] px-4 rounded-xl text-xs font-black text-white bg-danger hover:bg-danger/90 disabled:opacity-50"
                          >
                            {deleting ? t('admin.announcements.deleting') : t('admin.announcements.confirmDelete')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="neu-btn min-h-[2.75rem] px-4 rounded-xl text-xs font-bold text-danger dark:text-danger-dark transition-all flex items-center justify-center gap-1.5"
                        >
                          <Trash className="w-4 h-4" aria-hidden="true" />
                          <span>{t('admin.announcements.deleteBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAnnouncement(null)}
                          className="flex-1 neu-btn min-h-[2.75rem] rounded-xl text-xs sm:text-sm font-bold text-ink dark:text-txt-darkPrimary hover:text-link transition-all flex items-center justify-center"
                        >
                          {t('admin.announcements.closeBtn')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </DialogPrimitive.Root>
      </MotionConfig>
    </DashboardLayout>
  );
};

export default AdminAnnouncements;
