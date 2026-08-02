import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ShieldCheck, Info, Calendar, ChevronDown, ChevronUp, History, Eye, Check, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const PERMISSION_LABELS = {
  medical_history: 'Medical History',
  documents: 'Documents',
  visit_notes: 'Visit Notes',
};

const DEFAULT_PERMS = { medical_history: true, documents: true, visit_notes: true };

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderCard = ({ providerName, service, lastAccess, isEnabled, permissions, onToggle, onPermChange, loading, expanded, onToggleExpand }) => {
  return (
    <motion.div
      className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden"
      variants={staggerItem}
    >
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-lg font-bold text-slate-400 dark:text-slate-500 shrink-0">
            {providerName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">{providerName}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm truncate">{service}</p>
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs mt-1">
              <Calendar className="w-3 h-3 shrink-0" />
              <span className="truncate">Last access: {lastAccess || 'Never'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleExpand}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <motion.button
            onClick={onToggle}
            disabled={loading}
            className={`w-14 h-8 rounded-full p-1 relative overflow-hidden transition-colors duration-300 ${isEnabled ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'} ${loading ? 'opacity-50' : ''}`}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-6 h-6 bg-white dark:bg-slate-800 rounded-full shadow-sm dark:shadow-slate-900/50"
              animate={{ x: isEnabled ? 22 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-slate-50 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                Data Sharing Permissions
              </p>
              <div className="space-y-2">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isEnabled ? 'hover:bg-slate-50 dark:hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        if (isEnabled) onPermChange(key);
                      }}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        permissions[key]
                          ? 'bg-primary border-primary text-white'
                          : 'border-slate-300 bg-white dark:bg-slate-800'
                      }`}
                    >
                      {permissions[key] && <Check className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                  </label>
                ))}
              </div>
              {!isEnabled && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Enable data sharing to modify permissions.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PatientConsent = () => {
  const { user } = useAuth();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [consentHistory, setConsentHistory] = useState([]);

  const getHistoryKey = () => `consent_history_${user?.id}`;

  const loadConsentHistory = () => {
    try {
      return JSON.parse(localStorage.getItem(getHistoryKey()) || '[]');
    } catch { return []; }
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

  useEffect(() => {
    const fetchConsents = async () => {
      if (!user) return;
      try {
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
            providerName: c.provider?.full_name || 'Unknown',
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

    fetchConsents();
  }, [user]);

  const handleToggle = async (consentId, currentValue, providerName, providerId) => {
    setTogglingId(consentId);
    try {
      const { error } = await supabase
        .from('consent_access')
        .update({ is_enabled: !currentValue })
        .eq('id', consentId);

      if (error) throw error;

      setConsents(prev => prev.map(c =>
        c.id === consentId ? { ...c, isEnabled: !currentValue } : c
      ));

      if (!currentValue) {
        addHistoryEntry({ providerName, providerId, action: 'Granted', details: 'Data sharing enabled' });
      } else {
        addHistoryEntry({ providerName, providerId, action: 'Revoked', details: 'Data sharing disabled' });
      }
    } catch (err) {
      console.error('Error toggling consent:', err);
      toast.error('Failed to update. Check your permissions.');
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

      addHistoryEntry({
        providerName,
        providerId,
        action: 'Updated',
        details: `${updatedPerms[permKey] ? 'Enabled' : 'Disabled'} ${PERMISSION_LABELS[permKey]}`,
      });

      toast.success(`Updated permission for ${PERMISSION_LABELS[permKey]}`, { duration: 2000 });
    } catch (err) {
      console.error('Error updating permissions:', err);
      toast.error('Failed to update permissions.');
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

  const getActionIcon = (action) => {
    switch (action) {
      case 'Granted': return <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-300" />;
      case 'Revoked': return <X className="w-3.5 h-3.5 text-red-500 dark:text-red-300" />;
      case 'Updated': return <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" />;
      default: return <History className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'Granted': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200';
      case 'Revoked': return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300';
      case 'Updated': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  };

  return (
    <DashboardLayout role="patient">
      <div className="max-w-4xl space-y-8">
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-primary rounded-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manage Your Health Data Access</h1>
            <p className="text-slate-500 dark:text-slate-400">Securely control which providers can view your medical information.</p>
          </div>
        </motion.div>

        <motion.div
          className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex gap-4 items-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="p-2 bg-primary text-white rounded-xl mt-1">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-slate-700 dark:text-slate-200">
            <p className="font-bold text-primary mb-1">Privacy Notice</p>
            <p className="text-sm leading-relaxed">
              You have full control over who can access your health information and what they can see.
              Click the arrow on any provider card to set granular permissions for Medical History, Documents, and Visit Notes.
              Revoking the master toggle will immediately prevent all data access.
            </p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">Loading consent settings...</div>
        ) : (
          <>
            {/* Provider Cards */}
            <motion.div
              className="space-y-4"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 px-2">Authorized Providers</h3>
              {consents.length > 0 ? (
                consents.map((c) => (
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
                    expanded={expandedId === c.id}
                    onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  />
                ))
              ) : (
                <div className="p-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                  No providers to manage yet. Request a service from a provider first!
                </div>
              )}
            </motion.div>

            {/* Privacy Activity Section */}
            {consents.length > 0 && (
              <motion.div
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm border-b-2 transition-colors ${
                      activeTab === 'history'
                        ? 'border-primary text-primary bg-blue-50/50'
                        : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    Consent History
                  </button>
                  <button
                    onClick={() => setActiveTab('access')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm border-b-2 transition-colors ${
                      activeTab === 'access'
                        ? 'border-primary text-primary bg-blue-50/50'
                        : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Data Access Log
                  </button>
                </div>

                {/* Consent History Tab */}
                {activeTab === 'history' && (
                  <div className="p-6 max-h-80 overflow-y-auto">
                    {consentHistory.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No consent changes recorded yet.</p>
                        <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Toggle data sharing to see activity here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {consentHistory.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                            <div className={`p-1.5 rounded-lg ${entry.action === 'Granted' ? 'bg-green-100 dark:bg-green-900/40' : entry.action === 'Revoked' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
                              {getActionIcon(entry.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{entry.providerName}</span>
                                <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${getActionBadge(entry.action)}`}>
                                  {entry.action}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{entry.details}</p>
                            </div>
                            <span className="text-2xs text-slate-400 dark:text-slate-500 shrink-0">{formatTimestamp(entry.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Data Access Log Tab */}
                {activeTab === 'access' && (
                  <div className="p-6 max-h-80 overflow-y-auto">
                    {consents.filter(c => c.lastAccessRaw).length === 0 ? (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No data access recorded yet.</p>
                        <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">When a provider views your records, it will be logged here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {consents
                          .filter(c => c.lastAccessRaw)
                          .sort((a, b) => new Date(b.lastAccessRaw) - new Date(a.lastAccessRaw))
                          .map((c) => (
                            <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-primary rounded-lg">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{c.providerName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Viewed your {Object.entries(PERMISSION_LABELS)
                                    .filter(([k]) => c.permissions?.[k])
                                    .map(([, v]) => v)
                                    .join(', ') || 'records'}
                                </p>
                              </div>
                              <span className="text-2xs text-slate-400 dark:text-slate-500 shrink-0">
                                {new Date(c.lastAccessRaw).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientConsent;
