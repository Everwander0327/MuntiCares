import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { X, RefreshCw, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { normalizePermissions } from '@/features/patient/utils/consent';
import toast from 'react-hot-toast';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';

const PERMISSION_CONFIG = [
  {
    key: 'medical_history',
    label: 'Medical History',
    desc: 'Diagnoses, allergies, blood type, and conditions',
  },
  {
    key: 'documents',
    label: 'Clinical Documents',
    desc: 'Uploaded test results, lab clearances, and imaging',
  },
  {
    key: 'visit_notes',
    label: 'Visit & Session Notes',
    desc: 'Past consultation logs and provider encounter notes',
  },
];

const PERMISSION_LABELS = {
  medical_history: 'Medical History',
  documents: 'Documents',
  visit_notes: 'Visit Notes',
};

const EXPIRY_CHOICES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'No expiry', days: null },
];

const DEFAULT_GRANT_DAYS = 90;

const getExpirySummary = (expiresAt, isEnabled) => {
  if (!isEnabled) return 'Paused';
  if (!expiresAt) return 'No expiry set';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'No expiry set';
  if (date <= new Date()) {
    return `Expired ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  return `Ends ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

const getActiveExpiryDays = (consent) => {
  if (!consent) return undefined;
  if (Object.prototype.hasOwnProperty.call(consent, 'selectedExpiryDays')) {
    return consent.selectedExpiryDays;
  }
  if (!consent.expiresAt) return null;
  const diffDays = Math.round((new Date(consent.expiresAt).getTime() - Date.now()) / 86400000);
  if (diffDays <= 0) return undefined;
  if (diffDays <= 45) return 30;
  if (diffDays <= 180) return 90;
  return 365;
};

/* Clean dot-free switch with >= 44px accessible touch zone */
const ConsentSwitch = ({ checked, onToggle, disabled, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
    className={`min-h-[44px] min-w-[52px] inline-flex items-center justify-center cursor-pointer select-none ${
      disabled ? 'opacity-50 pointer-events-none' : ''
    }`}
  >
    <span
      className={`w-12 h-7 rounded-full p-1 flex items-center transition-colors ${
        checked ? 'bg-primary dark:bg-primary-400' : 'neu-inset'
      }`}
    >
      <motion.span
        className="w-5 h-5 rounded-full bg-white shadow-sm block shrink-0"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      />
    </span>
  </button>
);

/* Shared inline permission & expiry editor used by Desktop Inspector & Mobile Accordion */
const PermissionEditor = ({
  consent,
  onToggleCategory,
  onToggleAllCategories,
  onSelectExpiry,
}) => {
  const activeCount = PERMISSION_CONFIG.filter(({ key }) => !!consent.permissions?.[key]).length;
  const allEnabled = activeCount === PERMISSION_CONFIG.length;
  const activeExpiryDays = getActiveExpiryDays(consent);
  const expirySummary = getExpirySummary(consent.expiresAt, consent.isEnabled);

  return (
    <div className="space-y-4">
      {!consent.isEnabled && (
        <div className="neu-inset p-3.5 rounded-2xl text-warning dark:text-warning-dark text-sm font-semibold">
          Master access is paused. Turn ON access to share medical record categories.
        </div>
      )}

      {/* Shared Record Categories */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
            Shared Record Categories
          </span>
          <button
            type="button"
            disabled={!consent.isEnabled}
            onClick={() => onToggleAllCategories(consent, !allEnabled)}
            className={`min-h-[36px] px-2 text-xs font-bold transition-colors ${
              consent.isEnabled
                ? 'text-link dark:text-primary-400 hover:underline cursor-pointer'
                : 'text-tertiary opacity-50 cursor-not-allowed'
            }`}
          >
            {allEnabled ? 'Pause all' : 'Enable all'}
          </button>
        </div>

        <div className="neu-inset rounded-2xl divide-y divide-surface-border/70 dark:divide-white/5 overflow-hidden">
          {PERMISSION_CONFIG.map(({ key, label, desc }) => {
            const isChecked = !!consent.permissions?.[key] && consent.isEnabled;
            return (
              <div
                key={key}
                onClick={() => {
                  if (consent.isEnabled) {
                    onToggleCategory(consent.providerId, consent.providerName, key);
                  }
                }}
                className={`px-4 py-3.5 flex items-center justify-between gap-3 transition-colors select-none ${
                  consent.isEnabled
                    ? 'cursor-pointer hover:bg-surface-page/50 dark:hover:bg-white/[0.02]'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="text-sm font-bold text-ink dark:text-white block">
                    {label}
                  </span>
                  <span className="text-sm text-tertiary font-medium block leading-snug mt-0.5">
                    {desc}
                  </span>
                </div>

                <ConsentSwitch
                  checked={isChecked}
                  disabled={!consent.isEnabled}
                  ariaLabel={`Toggle ${label} for ${consent.providerName}`}
                  onToggle={() => onToggleCategory(consent.providerId, consent.providerName, key)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Automatic Access Expiry */}
      <div className="neu-flat-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-ink dark:text-white">
            Access expiry
          </p>
          <span className="text-xs font-bold text-link dark:text-primary-400 tabular-nums">
            {expirySummary}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EXPIRY_CHOICES.map((opt) => {
            const isSelected = activeExpiryDays === opt.days;
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectExpiry(consent, opt.days)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'neu-btn-primary'
                    : 'neu-btn text-ink dark:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-tertiary leading-relaxed font-medium">
          Providers lose access automatically on this date. Re-enabling access always sets a future expiry.
        </p>
      </div>
    </div>
  );
};

/* Clean Avatar Helper */
const ProviderAvatar = ({ url, name, sizeClass = 'w-11 h-11' }) => (
  <div
    className={`neu-flat-sm ${sizeClass} rounded-2xl flex items-center justify-center text-link dark:text-primary-400 font-black text-xs sm:text-sm shrink-0 select-none aspect-square overflow-hidden`}
  >
    {url ? (
      <img src={url} alt={name} className="w-full h-full object-cover" />
    ) : (
      name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    )}
  </div>
);

const PatientConsent = () => {
  const { user } = useAuth();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [mobileExpandedId, setMobileExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const auditTriggerRef = useRef(null);
  const [consentHistory, setConsentHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTab, setAuditTab] = useState('history');

  const getHistoryKey = useCallback(() => `consent_history_${user?.id}`, [user?.id]);

  const loadConsentHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    } catch {
      return [];
    }
  }, [getHistoryKey]);

  const addHistoryEntry = (entry) => {
    const history = loadConsentHistory();
    history.unshift({ timestamp: new Date().toISOString(), ...entry });
    localStorage.setItem(getHistoryKey(), JSON.stringify(history.slice(0, 100)));
    setConsentHistory(history.slice(0, 100));
  };

  useEffect(() => {
    if (!user) return;
    setConsentHistory(loadConsentHistory());
  }, [user, loadConsentHistory]);

  const fetchConsents = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('consent_access')
        .select('*, provider:provider_id(full_name, avatar_url)')
        .eq('patient_id', user.id);

      if (error) throw error;

      const providerIds = (data || []).map((c) => c.provider_id);
      const providerDetails = {};

      if (providerIds.length > 0) {
        const { data: provData } = await supabase
          .from('providers')
          .select('user_id, services')
          .in('user_id', providerIds);

        (provData || []).forEach((p) => {
          providerDetails[p.user_id] = p;
        });
      }

      const formatted = (data || []).map((c) => {
        const provInfo = providerDetails[c.provider_id];
        const perms = normalizePermissions(c.permissions);
        return {
          id: c.id,
          providerId: c.provider_id,
          providerName: c.provider?.full_name || 'Care Specialist',
          providerAvatarUrl: c.provider?.avatar_url || '',
          service:
            provInfo?.services && provInfo.services.length > 0
              ? provInfo.services[0]
              : 'General Care',
          lastAccess: c.last_access
            ? new Date(c.last_access).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Never',
          lastAccessRaw: c.last_access,
          isEnabled: c.is_enabled,
          expiresAt: c.expires_at || null,
          permissions: perms,
        };
      });

      setConsents(formatted);
      if (formatted.length > 0) {
        setSelectedProviderId((prev) => prev || formatted[0].id);
        setMobileExpandedId((prev) =>
          prev || (formatted.length === 1 ? formatted[0].id : null)
        );
      }
    } catch (err) {
      console.error('Error fetching consents:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const isMissingColumnError = (err) =>
    err?.code === '42703' || /column .* does not exist/i.test(err?.message || '');

  const handleToggle = async (consentId, currentValue, providerName, providerId) => {
    setTogglingId(consentId);
    try {
      const nextValue = !currentValue;
      const consent = consents.find((c) => c.id === consentId);
      let expiresAt = consent?.expiresAt || null;
      let selectedExpiryDays = consent?.selectedExpiryDays;

      if (nextValue) {
        if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
          expiresAt = new Date(Date.now() + DEFAULT_GRANT_DAYS * 86400000).toISOString();
          selectedExpiryDays = DEFAULT_GRANT_DAYS;
        }
      } else {
        expiresAt = new Date().toISOString();
        selectedExpiryDays = undefined;
      }

      let { error } = await supabase
        .from('consent_access')
        .update({ is_enabled: nextValue, expires_at: expiresAt })
        .eq('id', consentId);

      if (isMissingColumnError(error)) {
        expiresAt = consent?.expiresAt || null;
        ({ error } = await supabase
          .from('consent_access')
          .update({ is_enabled: nextValue })
          .eq('id', consentId));
      }

      if (error) throw error;

      setConsents((prev) =>
        prev.map((c) =>
          c.id === consentId
            ? { ...c, isEnabled: nextValue, expiresAt, selectedExpiryDays }
            : c
        )
      );

      if (nextValue) {
        addHistoryEntry({
          providerName,
          providerId,
          action: 'Granted',
          details: 'Full data sharing enabled',
        });
        toast.success(`Access granted for ${providerName}`, { id: 'consent-status' });
      } else {
        addHistoryEntry({
          providerName,
          providerId,
          action: 'Revoked',
          details: 'Data access paused',
        });
        toast(`Access paused for ${providerName}`, { id: 'consent-status', icon: 'pause' });
      }
    } catch (err) {
      console.error('Error toggling consent:', err);
      toast.error('Failed to update. Check your connection.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleExpiryChoice = async (consent, days) => {
    const iso = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
    const label = days === null ? 'has no expiry date' : `expires in ${days} days`;

    const { error } = await supabase
      .from('consent_access')
      .update({ expires_at: iso })
      .eq('id', consent.id);

    if (isMissingColumnError(error)) {
      toast.error('This database has no consent_expiry column yet. Apply the consent expiry migration first.');
      return;
    }
    if (error) {
      toast.error('Failed to change the expiry. Check your connection.');
      return;
    }

    setConsents((prev) =>
      prev.map((c) =>
        c.id === consent.id
          ? { ...c, expiresAt: iso, selectedExpiryDays: days }
          : c
      )
    );
    addHistoryEntry({
      providerName: consent.providerName,
      providerId: consent.providerId,
      action: 'Expiry set',
      details: `Access ${label}`,
    });
    toast.success(`Access ${label}`, { id: 'expiry-status' });
  };

  const handlePermChange = async (providerId, providerName, permKey) => {
    const consent = consents.find((c) => c.providerId === providerId);
    if (!consent) return;

    const updatedPerms = {
      ...consent.permissions,
      [permKey]: !consent.permissions[permKey],
    };

    try {
      const { error } = await supabase
        .from('consent_access')
        .update({ permissions: updatedPerms })
        .eq('id', consent.id);

      if (error) throw error;

      setConsents((prev) =>
        prev.map((c) =>
          c.id === consent.id ? { ...c, permissions: updatedPerms } : c
        )
      );

      addHistoryEntry({
        providerName,
        providerId,
        action: 'Updated',
        details: `${updatedPerms[permKey] ? 'Granted' : 'Revoked'} ${PERMISSION_LABELS[permKey]}`,
      });

      if (updatedPerms[permKey]) {
        toast.success(`Enabled ${PERMISSION_LABELS[permKey]}`, { id: 'permission-status' });
      } else {
        toast(`Disabled ${PERMISSION_LABELS[permKey]}`, {
          id: 'permission-status',
          icon: 'pause',
        });
      }
    } catch (err) {
      console.error('Error updating permissions:', err);
      toast.error('Failed to update permission.');
    }
  };

  const handleToggleAllCategories = async (consent, targetEnabled) => {
    const updatedPerms = {
      medical_history: targetEnabled,
      documents: targetEnabled,
      visit_notes: targetEnabled,
    };

    try {
      const { error } = await supabase
        .from('consent_access')
        .update({ permissions: updatedPerms })
        .eq('id', consent.id);

      if (error) throw error;

      setConsents((prev) =>
        prev.map((c) =>
          c.id === consent.id ? { ...c, permissions: updatedPerms } : c
        )
      );

      addHistoryEntry({
        providerName: consent.providerName,
        providerId: consent.providerId,
        action: 'Updated',
        details: `${targetEnabled ? 'Enabled all' : 'Paused all'} record categories`,
      });

      if (targetEnabled) {
        toast.success(`Enabled all categories for ${consent.providerName}`, {
          id: 'permission-status',
        });
      } else {
        toast(`Paused all categories for ${consent.providerName}`, {
          id: 'permission-status',
          icon: 'pause',
        });
      }
    } catch (err) {
      console.error('Error updating all categories:', err);
      toast.error('Failed to update categories.');
    }
  };

  const formatTimestamp = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'Granted':
        return 'neu-flat-sm bg-emerald-500/10 text-success dark:text-success-dark border border-emerald-500/30';
      case 'Revoked':
        return 'neu-flat-sm bg-rose-500/10 text-danger dark:text-danger-dark border border-rose-500/30';
      case 'Updated':
        return 'neu-flat-sm bg-amber-500/10 text-warning dark:text-warning-dark border border-amber-500/30';
      default:
        return 'neu-flat-sm text-ink dark:text-slate-200 border border-surface-border';
    }
  };

  const activeCountTotal = useMemo(
    () => consents.filter((c) => c.isEnabled).length,
    [consents]
  );
  const pausedCountTotal = consents.length - activeCountTotal;

  const filteredConsents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return consents.filter((c) => {
      if (statusFilter === 'active' && !c.isEnabled) return false;
      if (statusFilter === 'paused' && c.isEnabled) return false;
      if (!q) return true;
      return (
        c.providerName.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q)
      );
    });
  }, [consents, searchQuery, statusFilter]);

  const activeInspectorConsent = useMemo(() => {
    if (filteredConsents.length === 0) return null;
    return (
      filteredConsents.find((c) => c.id === selectedProviderId) ||
      filteredConsents[0]
    );
  }, [filteredConsents, selectedProviderId]);

  const accessLogs = useMemo(() => {
    return consents
      .filter((c) => c.lastAccessRaw)
      .sort((a, b) => new Date(b.lastAccessRaw) - new Date(a.lastAccessRaw));
  }, [consents]);

  useBodyScrollLock(showAuditModal);
  const {
    drawerMotionProps: auditDrawerMotionProps,
    dragHandleProps: auditDragHandleProps,
  } = useBottomDrawerDrag({
    onClose: () => setShowAuditModal(false),
  });

  return (
    <DashboardLayout role="patient">
      <div className="space-y-5 sm:space-y-6 relative w-full max-w-full pb-10">
        {/* Minimal Slim Header (No decorative icon) */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 px-1">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold tracking-tight text-xl sm:text-2xl md:text-3xl text-ink dark:text-white">
              Consent & Data Privacy
            </h1>
            <p className="text-sm text-tertiary mt-1 font-medium">
              Select a provider to govern medical record permissions and automatic expiry in real time.
            </p>
          </div>

          <button
            type="button"
            onClick={(event) => {
              auditTriggerRef.current = event.currentTarget;
              setShowAuditModal(true);
            }}
            className="neu-btn w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-2xl flex items-center justify-center transition-all cursor-pointer font-bold text-xs sm:text-sm text-ink dark:text-slate-200 hover:text-link active:scale-[0.98] shrink-0"
            title="Open Access & Consent Audit Log"
          >
            Audit Trail
          </button>
        </header>

        {/* Search & Status Filter Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="neu-inset flex-1 px-4 rounded-2xl flex items-center gap-2 min-h-[46px] border border-surface-border/70">
            <input
              type="text"
              aria-label="Search providers or services"
              placeholder="Search providers or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 text-sm font-semibold text-ink dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-link dark:text-primary-400 hover:underline px-2 py-1 cursor-pointer shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: `All (${consents.length})` },
              { id: 'active', label: `Active (${activeCountTotal})` },
              { id: 'paused', label: `Paused (${pausedCountTotal})` },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    active
                      ? 'neu-btn-primary'
                      : 'neu-btn text-ink dark:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content: Loading / Empty / Split View (Desktop) + Inline Accordion (Mobile) */}
        {loading ? (
          <div className="neu-flat p-8 sm:p-12 rounded-[2rem] text-center text-tertiary flex flex-col items-center justify-center gap-2.5">
            <RefreshCw className="w-6 h-6 animate-spin text-link" />
            <p className="text-sm font-bold">Loading consent records...</p>
          </div>
        ) : filteredConsents.length === 0 ? (
          <div className="neu-flat p-6 sm:p-12 rounded-[2rem] text-center">
            <div className="neu-flat-sm w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-tertiary mb-3">
              <ShieldAlert className="w-6 h-6 opacity-70" />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-ink dark:text-white">
              {searchQuery || statusFilter !== 'all'
                ? 'No matching providers found'
                : 'No Authorized Providers'}
            </h3>
            <p className="text-sm text-tertiary max-w-md mx-auto mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try clearing your search or switching the status filter to view all authorized providers.'
                : 'When you book a consultation or request care, the provider will appear here with granular permission controls.'}
            </p>
            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4 neu-btn px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-link cursor-pointer active:scale-[0.98]"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            {/* Left Column: Provider Cards (Master Selector on Desktop, Inline Accordion on Mobile) */}
            <div className="lg:col-span-5 space-y-3">
              {filteredConsents.map((c) => {
                const isSelectedDesktop = activeInspectorConsent?.id === c.id;
                const isExpandedMobile = mobileExpandedId === c.id;
                const activeCategories = Object.values(c.permissions || {}).filter(Boolean).length;
                const expiryText = getExpirySummary(c.expiresAt, c.isEnabled);

                return (
                  <div
                    key={c.id}
                    className={`neu-flat rounded-2xl sm:rounded-3xl overflow-hidden transition-all ${
                      isSelectedDesktop
                        ? 'lg:ring-2 lg:ring-primary dark:lg:ring-primary-400'
                        : ''
                    }`}
                  >
                    {/* Card Header (No nested interactive elements) */}
                    <div className="p-4 sm:p-5 select-none">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProviderId(c.id);
                            setMobileExpandedId((prev) => (prev === c.id ? null : c.id));
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
                        >
                          <ProviderAvatar url={c.providerAvatarUrl} name={c.providerName} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-sm sm:text-base text-ink dark:text-white truncate">
                                {c.providerName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-2xs font-extrabold uppercase tracking-wider shrink-0 ${
                                  c.isEnabled
                                    ? 'text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10'
                                    : 'text-danger dark:text-danger-dark border border-rose-500/30 bg-rose-500/10'
                                }`}
                              >
                                {c.isEnabled ? 'Active' : 'Paused'}
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-semibold text-tertiary truncate mt-0.5">
                              {c.service}
                            </p>
                          </div>
                        </button>

                        <ConsentSwitch
                          checked={c.isEnabled}
                          disabled={togglingId === c.id}
                          ariaLabel={`Master access for ${c.providerName}`}
                          onToggle={() =>
                            handleToggle(c.id, c.isEnabled, c.providerName, c.providerId)
                          }
                        />
                      </div>

                      {/* Metadata Bar (Zero middot dots) */}
                      <div className="mt-3 pt-3 border-t border-surface-border/60 dark:border-white/5 flex items-center justify-between gap-2 text-xs font-medium text-tertiary">
                        <span>
                          {c.isEnabled
                            ? `${activeCategories}/3 categories shared`
                            : 'Sharing paused'}
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            c.isEnabled ? 'text-link dark:text-primary-400' : ''
                          }`}
                        >
                          {expiryText}
                        </span>
                      </div>

                      {/* Mobile-only footer actions */}
                      <div className="lg:hidden mt-2 flex items-center justify-between text-xs font-bold text-link dark:text-primary-400">
                        <Link
                          to={`/patient/providers/${c.providerId}/profile`}
                          className="hover:underline min-h-[36px] inline-flex items-center"
                        >
                          View profile
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setMobileExpandedId((prev) => (prev === c.id ? null : c.id))
                          }
                          className="hover:underline min-h-[36px] inline-flex items-center cursor-pointer"
                        >
                          {isExpandedMobile ? 'Hide permissions' : 'Manage permissions'}
                        </button>
                      </div>
                    </div>

                    {/* Mobile Inline Accordion Body */}
                    <AnimatePresence initial={false}>
                      {isExpandedMobile && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="lg:hidden overflow-hidden border-t border-surface-border/70 dark:border-white/5"
                        >
                          <div className="p-4 bg-surface-page/50 dark:bg-black/15">
                            <PermissionEditor
                              consent={c}
                              onToggleCategory={handlePermChange}
                              onToggleAllCategories={handleToggleAllCategories}
                              onSelectExpiry={handleExpiryChoice}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Desktop Live Permissions Inspector (Zero Modal Hopping) */}
            {activeInspectorConsent && (
              <div className="hidden lg:block lg:col-span-7 lg:sticky lg:top-6">
                <div className="neu-flat rounded-[2rem] p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-surface-border/70 dark:border-white/5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <ProviderAvatar
                        url={activeInspectorConsent.providerAvatarUrl}
                        name={activeInspectorConsent.providerName}
                        sizeClass="w-12 h-12"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <Link
                            to={`/patient/providers/${activeInspectorConsent.providerId}/profile`}
                            className="font-display font-extrabold text-lg text-ink dark:text-white hover:text-link dark:hover:text-primary-400 transition-colors truncate"
                          >
                            {activeInspectorConsent.providerName}
                          </Link>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-2xs font-extrabold uppercase tracking-wider ${
                              activeInspectorConsent.isEnabled
                                ? 'text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10'
                                : 'text-danger dark:text-danger-dark border border-rose-500/30 bg-rose-500/10'
                            }`}
                          >
                            {activeInspectorConsent.isEnabled ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-tertiary mt-0.5">
                          {activeInspectorConsent.service} — Last accessed:{' '}
                          {activeInspectorConsent.lastAccess}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-tertiary">
                        {activeInspectorConsent.isEnabled ? 'ON' : 'OFF'}
                      </span>
                      <ConsentSwitch
                        checked={activeInspectorConsent.isEnabled}
                        disabled={togglingId === activeInspectorConsent.id}
                        ariaLabel={`Master access for ${activeInspectorConsent.providerName}`}
                        onToggle={() =>
                          handleToggle(
                            activeInspectorConsent.id,
                            activeInspectorConsent.isEnabled,
                            activeInspectorConsent.providerName,
                            activeInspectorConsent.providerId
                          )
                        }
                      />
                    </div>
                  </div>

                  <PermissionEditor
                    consent={activeInspectorConsent}
                    onToggleCategory={handlePermChange}
                    onToggleAllCategories={handleToggleAllCategories}
                    onSelectExpiry={handleExpiryChoice}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Audit Trail */}
        <DialogPrimitive.Root
          open={showAuditModal}
          onOpenChange={(open) => {
            if (!open) setShowAuditModal(false);
          }}
        >
          {showAuditModal && (
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-slate-950/70 md:backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <DialogPrimitive.Content
                asChild
                aria-modal="true"
                onCloseAutoFocus={(event) => {
                  if (!auditTriggerRef.current) return;
                  event.preventDefault();
                  auditTriggerRef.current.focus();
                }}
              >
                <motion.div
                  className="fixed inset-0 z-overlay flex items-end sm:items-center justify-center p-0 sm:p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setShowAuditModal(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    {...auditDrawerMotionProps}
                    className="neu-flat bg-surface-shell w-full sm:max-w-2xl rounded-t-[2.25rem] sm:rounded-[2.25rem] p-5 sm:p-6 md:p-7 space-y-4 h-[82vh] sm:h-[560px] max-h-[85vh] flex flex-col shadow-2xl border-t sm:border border-surface-border transform-gpu will-change-transform pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                  >
                    {/* Modal Header (No header icon) */}
                    <div
                      className="pb-3 border-b border-surface-border/70 dark:border-white/5 shrink-0 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                      {...auditDragHandleProps}
                    >
                      <div
                        className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden"
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <DialogPrimitive.Title asChild>
                            <h3 className="font-display font-extrabold text-base sm:text-xl text-ink dark:text-white truncate">
                              Audit Trail
                            </h3>
                          </DialogPrimitive.Title>
                          <p className="text-sm text-tertiary truncate mt-0.5">
                            Inspection records and permission history
                          </p>
                        </div>

                        <DialogPrimitive.Close
                          aria-label="Close"
                          className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl hidden sm:flex items-center justify-center text-tertiary hover:text-ink dark:hover:text-white cursor-pointer active:scale-95 shrink-0"
                        >
                          <X className="w-4 h-4 stroke-[2.5]" />
                        </DialogPrimitive.Close>
                      </div>
                    </div>

                    {/* Subtabs inside Modal (No decorative icons) */}
                    <div className="neu-inset p-1 rounded-xl flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAuditTab('history')}
                        className={`flex-1 min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                          auditTab === 'history'
                            ? 'neu-btn-primary shadow-sm'
                            : 'text-tertiary'
                        }`}
                      >
                        Permission Changes ({consentHistory.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditTab('access')}
                        className={`flex-1 min-h-[40px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                          auditTab === 'access'
                            ? 'neu-btn-primary shadow-sm'
                            : 'text-tertiary'
                        }`}
                      >
                        File Views ({accessLogs.length})
                      </button>
                    </div>

                    {/* Modal Body Content */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 overscroll-contain no-scrollbar">
                      {auditTab === 'history' ? (
                        consentHistory.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center py-10 text-tertiary">
                            <p className="text-sm font-bold text-ink dark:text-white">
                              No permission changes logged yet
                            </p>
                            <p className="text-sm text-tertiary mt-1">
                              Toggle a provider&apos;s access to see audit entries here.
                            </p>
                          </div>
                        ) : (
                          consentHistory.map((entry, idx) => (
                            <div
                              key={idx}
                              className="neu-flat-sm p-3.5 rounded-xl flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-ink dark:text-white text-sm truncate">
                                    {entry.providerName}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-2xs font-extrabold uppercase ${getActionBadge(
                                      entry.action
                                    )}`}
                                  >
                                    {entry.action}
                                  </span>
                                </div>
                                <p className="text-sm text-tertiary mt-0.5 truncate">
                                  {entry.details}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-tertiary shrink-0 tabular-nums">
                                {formatTimestamp(entry.timestamp)}
                              </span>
                            </div>
                          ))
                        )
                      ) : accessLogs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-10 text-tertiary">
                          <p className="text-sm font-bold text-ink dark:text-white">
                            No recorded provider file views
                          </p>
                          <p className="text-sm text-tertiary mt-1">
                            When doctors view your medical profile, logs will appear here.
                          </p>
                        </div>
                      ) : (
                        accessLogs.map((c) => (
                          <div
                            key={c.id}
                            className="neu-flat-sm p-3.5 rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold text-ink dark:text-white text-sm truncate">
                                {c.providerName}
                              </h5>
                              <p className="text-sm text-tertiary truncate mt-0.5">
                                Inspected:{' '}
                                {Object.entries(PERMISSION_LABELS)
                                  .filter(([k]) => c.permissions?.[k])
                                  .map(([, v]) => v)
                                  .join(', ') || 'records'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-tertiary shrink-0 tabular-nums">
                              {new Date(c.lastAccessRaw).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-surface-border/70 dark:border-white/5 text-xs text-tertiary shrink-0">
                      <span className="truncate">Stored locally</span>
                      {consentHistory.length > 0 && auditTab === 'history' && (
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem(getHistoryKey());
                            setConsentHistory([]);
                            toast.success('Audit history cleared');
                          }}
                          className="text-danger dark:text-danger-dark hover:underline font-bold cursor-pointer shrink-0 min-h-[36px] px-2"
                        >
                          Clear log
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </DialogPrimitive.Root>
      </div>
    </DashboardLayout>
  );
};

export default PatientConsent;
