import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { 
  ShieldCheck, Info, Calendar, ChevronDown, ChevronUp, 
  History, Eye, Check, X, Clock, Lock, FileText, Activity,
  Search, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const PERMISSION_CONFIG = [
  {
    key: 'medical_history',
    label: 'Medical History',
    desc: 'Diagnoses, allergies, blood type, and conditions',
    icon: Activity,
  },
  {
    key: 'documents',
    label: 'Clinical Documents',
    desc: 'Uploaded test results, lab clearances, and imaging',
    icon: FileText,
  },
  {
    key: 'visit_notes',
    label: 'Visit & Session Notes',
    desc: 'Past consultation logs and provider encounter notes',
    icon: Clock,
  },
];

const PERMISSION_LABELS = {
  medical_history: 'Medical History',
  documents: 'Documents',
  visit_notes: 'Visit Notes',
};

const DEFAULT_PERMS = { medical_history: true, documents: true, visit_notes: true };

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

/* Neumorphic Provider Access Card */
const ProviderCard = ({ 
  providerName, 
  service, 
  lastAccess, 
  isEnabled, 
  permissions, 
  onToggle, 
  onPermChange, 
  loading, 
  onOpenPermissions 
}) => {
  const activeCount = useMemo(() => {
    return Object.values(permissions || {}).filter(Boolean).length;
  }, [permissions]);

  return (
    <div className="neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden select-text">
      {/* Header Row */}
      <div className="p-3.5 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Tactile Provider Avatar */}
          <div className="neu-flat-sm w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center text-primary font-black text-xs sm:text-sm shrink-0 select-none aspect-square">
            {providerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base md:text-lg truncate">
                {providerName}
              </h4>
              <span className={`neu-flat-sm px-2.5 py-0.5 rounded-lg text-3xs font-extrabold uppercase tracking-wider shrink-0 ${
                isEnabled 
                  ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15' 
                  : 'text-rose-600 dark:text-rose-400 border border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/15'
              }`}>
                {isEnabled ? 'Active' : 'Paused'}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm font-semibold truncate mt-0.5">
              {service}
            </p>

            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-2xs sm:text-xs mt-0.5 sm:mt-1">
              <span className="flex items-center gap-1 font-medium truncate">
                <Calendar className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">Last: {lastAccess || 'Never'}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-medium text-slate-500 dark:text-slate-400 truncate">
                {isEnabled ? `${activeCount}/3 permissions` : 'Access disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls: Compact Mobile-Friendly Row */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-white/5 shrink-0">
          <button
            type="button"
            onClick={onOpenPermissions}
            className="neu-btn px-3.5 py-2 rounded-xl text-2xs sm:text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer text-slate-700 dark:text-slate-200 hover:text-primary active:scale-[0.98]"
            aria-label="Manage permissions"
          >
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>Permissions</span>
          </button>

          {/* Tactile Neumorphic Pill Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-3xs sm:text-2xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
              {isEnabled ? 'ON' : 'OFF'}
            </span>
            <button
              type="button"
              onClick={onToggle}
              disabled={loading}
              role="switch"
              aria-checked={isEnabled}
              className={`w-14 h-8 rounded-full p-1 neu-inset relative flex items-center transition-all cursor-pointer select-none ${
                loading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <motion.div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  isEnabled 
                    ? 'neu-btn-primary' 
                    : 'neu-flat-sm text-slate-400 dark:text-slate-500'
                }`}
                animate={{ x: isEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {isEnabled ? (
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                ) : (
                  <X className="w-3 h-3 stroke-[2.5]" />
                )}
              </motion.div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PatientConsent = () => {
  const { user } = useAuth();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [selectedPermProvider, setSelectedPermProvider] = useState(null);
  const [consentHistory, setConsentHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditTab, setAuditTab] = useState('history');

  const getHistoryKey = () => `consent_history_${user?.id}`;

  const loadConsentHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    } catch { 
      return []; 
    }
  };

  const addHistoryEntry = (entry) => {
    const history = loadConsentHistory();
    history.unshift({ timestamp: new Date().toISOString(), ...entry });
    localStorage.setItem(getHistoryKey(), JSON.stringify(history.slice(0, 100)));
    setConsentHistory(history.slice(0, 100));
  };

  useEffect(() => {
    if (!user) return;
    setConsentHistory(loadConsentHistory());
  }, [user]);

  const fetchConsents = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('consent_access')
        .select('*, provider:provider_id(full_name)')
        .eq('patient_id', user.id);

      if (error) throw error;

      const providerIds = (data || []).map(c => c.provider_id);
      let providerDetails = {};

      if (providerIds.length > 0) {
        const { data: provData } = await supabase
          .from('providers')
          .select('user_id, services')
          .in('user_id', providerIds);

        (provData || []).forEach(p => {
          providerDetails[p.user_id] = p;
        });
      }

      const formatted = (data || []).map(c => {
        const provInfo = providerDetails[c.provider_id];
        const perms = c.permissions || { ...DEFAULT_PERMS };
        return {
          id: c.id,
          providerId: c.provider_id,
          providerName: c.provider?.full_name || 'Care Specialist',
          service: (provInfo?.services && provInfo.services.length > 0) ? provInfo.services[0] : 'General Care',
          lastAccess: c.last_access ? new Date(c.last_access).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never',
          lastAccessRaw: c.last_access,
          isEnabled: c.is_enabled,
          permissions: perms,
        };
      });

      setConsents(formatted);
    } catch (err) {
      console.error('Error fetching consents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, [user]);

  const handleToggle = async (consentId, currentValue, providerName, providerId) => {
    setTogglingId(consentId);
    try {
      const nextValue = !currentValue;
      const { error } = await supabase
        .from('consent_access')
        .update({ is_enabled: nextValue })
        .eq('id', consentId);

      if (error) throw error;

      setConsents(prev => prev.map(c =>
        c.id === consentId ? { ...c, isEnabled: nextValue } : c
      ));

      if (selectedPermProvider?.id === consentId) {
        setSelectedPermProvider(prev => prev ? { ...prev, isEnabled: nextValue } : null);
      }

      if (nextValue) {
        addHistoryEntry({ providerName, providerId, action: 'Granted', details: 'Full data sharing enabled' });
        toast.success(`Access granted for ${providerName}`);
      } else {
        addHistoryEntry({ providerName, providerId, action: 'Revoked', details: 'Data access paused' });
        toast.success(`Access paused for ${providerName}`);
      }
    } catch (err) {
      console.error('Error toggling consent:', err);
      toast.error('Failed to update. Check your connection.');
    } finally {
      setTogglingId(null);
    }
  };

  const handlePermChange = async (providerId, providerName, permKey) => {
    const consent = consents.find(c => c.providerId === providerId);
    if (!consent) return;

    const updatedPerms = { ...consent.permissions, [permKey]: !consent.permissions[permKey] };

    try {
      const { error } = await supabase
        .from('consent_access')
        .update({ permissions: updatedPerms })
        .eq('id', consent.id);

      if (error) throw error;

      setConsents(prev => prev.map(c =>
        c.id === consent.id ? { ...c, permissions: updatedPerms } : c
      ));

      if (selectedPermProvider?.id === consent.id) {
        setSelectedPermProvider(prev => prev ? { ...prev, permissions: updatedPerms } : null);
      }

      addHistoryEntry({
        providerName,
        providerId,
        action: 'Updated',
        details: `${updatedPerms[permKey] ? 'Granted' : 'Revoked'} ${PERMISSION_LABELS[permKey]}`,
      });

      toast.success(`${updatedPerms[permKey] ? 'Enabled' : 'Disabled'} ${PERMISSION_LABELS[permKey]}`);
    } catch (err) {
      console.error('Error updating permissions:', err);
      toast.error('Failed to update permission.');
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
      case 'Granted': return 'neu-flat-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      case 'Revoked': return 'neu-flat-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      case 'Updated': return 'neu-flat-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      default: return 'neu-flat-sm bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    }
  };

  // Filtered providers
  const filteredConsents = useMemo(() => {
    if (!searchQuery.trim()) return consents;
    const q = searchQuery.toLowerCase().trim();
    return consents.filter(c => 
      c.providerName.toLowerCase().includes(q) || 
      c.service.toLowerCase().includes(q)
    );
  }, [consents, searchQuery]);

  const accessLogs = useMemo(() => {
    return consents
      .filter(c => c.lastAccessRaw)
      .sort((a, b) => new Date(b.lastAccessRaw) - new Date(a.lastAccessRaw));
  }, [consents]);

  // Prevent background scroll and repaint lag when modal is open
  useEffect(() => {
    if (showAuditModal || selectedPermProvider) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showAuditModal, selectedPermProvider]);

  return (
    <DashboardLayout role="patient">
      <div className="space-y-3.5 sm:space-y-6 relative w-full max-w-full pb-8">
        
        {/* Unified Clean Neumorphic Header Card */}
        <section className="neu-flat p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-[2.25rem] space-y-3.5 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="neu-flat-sm w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-primary font-black shrink-0 aspect-square">
                <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-extrabold tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white truncate">
                  Consent & Data Privacy
                </h1>
                <p className="text-3xs sm:text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 font-medium truncate sm:whitespace-normal">
                  Review and govern medical record permissions granted to your healthcare providers in real time.
                </p>
              </div>
            </div>

            {/* Compact Neumorphic Audit Trail Trigger Button */}
            <button
              type="button"
              onClick={() => setShowAuditModal(true)}
              className="neu-btn w-full sm:w-auto px-4 py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:text-primary active:scale-[0.98]"
              title="Open Access & Consent Audit Log"
            >
              <History className="w-4 h-4 text-primary" />
              <span>Audit Trail</span>
            </button>
          </div>

          {/* Full Search Bar */}
          <div className="relative w-full">
            <div className="neu-inset p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 h-[44px] sm:h-[48px] border border-slate-200/50 dark:border-white/5">
              <Search className="w-4 h-4 text-primary ml-1.5 sm:ml-2 shrink-0 pointer-events-none" />
              <input
                type="text"
                placeholder="Search providers or services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-slate-400 placeholder:font-normal min-w-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer mr-1 shrink-0"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Authorized Providers List */}
        <div className="space-y-3 sm:space-y-4">
          {loading ? (
            <div className="neu-flat p-8 sm:p-10 rounded-2xl sm:rounded-[2rem] text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
              <p className="text-xs sm:text-sm font-bold">Loading consent records...</p>
            </div>
          ) : filteredConsents.length > 0 ? (
            <div className="space-y-3 sm:space-y-3.5">
              {filteredConsents.map((c) => (
                <ProviderCard
                  key={c.id}
                  providerName={c.providerName}
                  service={c.service}
                  lastAccess={c.lastAccess}
                  isEnabled={c.isEnabled}
                  permissions={c.permissions}
                  loading={togglingId === c.id}
                  onToggle={() => handleToggle(c.id, c.isEnabled, c.providerName, c.providerId)}
                  onPermChange={(key) => handlePermChange(c.providerId, c.providerName, key)}
                  onOpenPermissions={() => setSelectedPermProvider(c)}
                />
              ))}
            </div>
          ) : (
            <div className="neu-flat p-6 sm:p-12 rounded-2xl sm:rounded-[2.25rem] text-center">
              <div className="neu-flat-sm w-12 h-12 sm:w-16 sm:h-16 rounded-2xl mx-auto flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2.5 sm:mb-3">
                <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 opacity-60" />
              </div>
              <h3 className="font-extrabold text-sm sm:text-lg text-slate-800 dark:text-white">
                {searchQuery ? 'No matching providers found' : 'No Authorized Providers'}
              </h3>
              <p className="text-2xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                {searchQuery 
                  ? `We couldn't find any provider matching "${searchQuery}". Clear your search to view all.`
                  : 'When you book a consultation or request care, the provider will appear here with granular permission controls.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-3.5 neu-btn px-4 py-2 rounded-xl text-xs font-bold text-primary cursor-pointer active:scale-[0.98]"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal: Granular Permissions Sheet (Zero page resizing!) */}
        <AnimatePresence>
          {selectedPermProvider && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 md:backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setSelectedPermProvider(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="neu-flat bg-[#ebf1f8] dark:bg-[#172236] w-full sm:max-w-lg rounded-t-[2.25rem] sm:rounded-[2.25rem] p-5 sm:p-6 space-y-4 shadow-2xl border-t sm:border border-white/60 dark:border-white/10 transform-gpu will-change-transform pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                        {selectedPermProvider.providerName}
                      </h3>
                      <p className="text-2xs sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        Configure data sharing categories
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPermProvider(null)}
                    className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer active:scale-95"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Status notice */}
                {!selectedPermProvider.isEnabled && (
                  <div className="neu-inset p-3 rounded-xl flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Master toggle is OFF. Turn ON master access to enable sharing.</span>
                  </div>
                )}

                {/* Categories */}
                <div className="space-y-2.5">
                  {PERMISSION_CONFIG.map(({ key, label, desc, icon: Icon }) => {
                    const isChecked = !!selectedPermProvider.permissions[key];
                    const isEnabled = selectedPermProvider.isEnabled;
                    return (
                      <div
                        key={key}
                        onClick={() => isEnabled && handlePermChange(selectedPermProvider.providerId, selectedPermProvider.providerName, key)}
                        className={`p-3.5 rounded-2xl transition-all select-none flex items-center justify-between gap-3 ${
                          isEnabled
                            ? isChecked
                              ? 'neu-inset border border-primary/20 cursor-pointer'
                              : 'neu-flat-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-700'
                            : 'neu-flat-sm opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isChecked && isEnabled 
                              ? 'neu-btn-primary text-white' 
                              : 'neu-flat-sm text-slate-500 dark:text-slate-400'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 block truncate">
                              {label}
                            </span>
                            <span className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 block truncate font-medium">
                              {desc}
                            </span>
                          </div>
                        </div>

                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isChecked && isEnabled
                            ? 'neu-btn-primary text-white'
                            : 'neu-inset text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer action */}
                <button
                  type="button"
                  onClick={() => setSelectedPermProvider(null)}
                  className="w-full neu-btn-primary py-2.5 rounded-xl font-bold text-xs sm:text-sm cursor-pointer shadow-sm active:scale-[0.98]"
                >
                  Done
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Audit Trail - Lightweight 60fps Sheet with zero jitter */}
        <AnimatePresence>
          {showAuditModal && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 md:backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setShowAuditModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="neu-flat bg-[#ebf1f8] dark:bg-[#172236] w-full sm:max-w-2xl rounded-t-[2.25rem] sm:rounded-[2.25rem] p-4 sm:p-6 md:p-7 space-y-3.5 h-[80vh] sm:h-[560px] max-h-[85vh] flex flex-col shadow-2xl border-t sm:border border-white/60 dark:border-white/10 transform-gpu will-change-transform pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-white/5 shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="neu-flat-sm w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
                      <History className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white truncate">
                        Audit Trail
                      </h3>
                      <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                        Inspection records and permission history
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAuditModal(false)}
                    className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer active:scale-95 shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Subtabs inside Modal */}
                <div className="neu-inset p-1 rounded-xl flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAuditTab('history')}
                    className={`flex-1 py-2 rounded-lg text-2xs sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      auditTab === 'history'
                        ? 'neu-btn-primary shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Permission Changes ({consentHistory.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditTab('access')}
                    className={`flex-1 py-2 rounded-lg text-2xs sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      auditTab === 'access'
                        ? 'neu-btn-primary shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">File Views ({accessLogs.length})</span>
                  </button>
                </div>

                {/* Modal Body Content - Fixed Height, Pure CSS Smooth Scroll */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 overscroll-contain no-scrollbar">
                  {auditTab === 'history' ? (
                    consentHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 dark:text-slate-500">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs sm:text-sm font-bold">No permission changes logged yet</p>
                        <p className="text-3xs text-slate-400 mt-0.5">Toggle a provider's access to see audit entries here.</p>
                      </div>
                    ) : (
                      consentHistory.map((entry, idx) => (
                        <div key={idx} className="neu-flat-sm p-3 rounded-xl flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              entry.action === 'Granted'
                                ? 'neu-btn-primary text-white'
                                : entry.action === 'Revoked'
                                ? 'neu-flat-sm text-rose-500'
                                : 'neu-flat-sm text-amber-500'
                            }`}>
                              {entry.action === 'Granted' ? <Check className="w-3 h-3 stroke-[3]" /> : entry.action === 'Revoked' ? <X className="w-3 h-3 stroke-[3]" /> : <Clock className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  {entry.providerName}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-3xs font-extrabold uppercase ${getActionBadge(entry.action)}`}>
                                  {entry.action}
                                </span>
                              </div>
                              <p className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                {entry.details}
                              </p>
                            </div>
                          </div>
                          <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      ))
                    )
                  ) : (
                    accessLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 dark:text-slate-500">
                        <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs sm:text-sm font-bold">No recorded provider file views</p>
                        <p className="text-3xs text-slate-400 mt-0.5">When doctors view your medical profile, logs will appear here.</p>
                      </div>
                    ) : (
                      accessLogs.map((c) => (
                        <div key={c.id} className="neu-flat-sm p-3 rounded-xl flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="neu-flat-sm w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-primary shrink-0">
                              <Eye className="w-3 h-3" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                {c.providerName}
                              </h5>
                              <p className="text-3xs sm:text-2xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                Inspected: {Object.entries(PERMISSION_LABELS)
                                  .filter(([k]) => c.permissions?.[k])
                                  .map(([, v]) => v)
                                  .join(', ') || 'records'}
                              </p>
                            </div>
                          </div>
                          <span className="text-3xs font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                            {new Date(c.lastAccessRaw).toLocaleDateString('en-US', {
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))
                    )
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-white/5 text-3xs text-slate-400 shrink-0">
                  <span className="truncate">Stored locally</span>
                  {consentHistory.length > 0 && auditTab === 'history' && (
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem(getHistoryKey());
                        setConsentHistory([]);
                        toast.success('Audit history cleared');
                      }}
                      className="text-rose-500 hover:underline font-bold cursor-pointer shrink-0"
                    >
                      Clear log
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </DashboardLayout>
  );
};

export default PatientConsent;

