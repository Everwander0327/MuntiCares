import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ShieldCheck, Info, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderToggle = ({ providerName, service, lastAccess, isEnabled, onToggle, loading }) => {
  return (
    <motion.div 
      className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-lg font-bold text-slate-400">
          {providerName.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h4 className="font-bold text-slate-900">{providerName}</h4>
          <p className="text-slate-500 text-sm">{service}</p>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
            <Calendar className="w-3 h-3" />
            <span>Last access: {lastAccess || 'Never'}</span>
          </div>
        </div>
      </div>
      
      <motion.button 
        onClick={onToggle}
        disabled={loading}
        className={`w-14 h-8 rounded-full p-1 relative overflow-hidden transition-colors duration-300 ${isEnabled ? 'bg-green-500' : 'bg-slate-200'} ${loading ? 'opacity-50' : ''}`}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div 
          className="w-6 h-6 bg-white rounded-full shadow-sm"
          animate={{ x: isEnabled ? 18 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </motion.div>
  );
};

const PatientConsent = () => {
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchConsents = async () => {
      if (!user) return;

      try {
        // Fetch all consent entries for this patient, join with provider info
        // Fetch consent entries with user info
        const { data, error } = await supabase
          .from('consent_access')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', user.id);

        if (error) throw error;

        // Fetch provider details (services) from the providers table
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
          return {
            id: c.id,
            providerId: c.provider_id,
            providerName: c.provider?.full_name || 'Unknown',
            service: (provInfo?.services && provInfo.services.length > 0) ? provInfo.services[0] : 'General Care',
            lastAccess: c.last_access ? new Date(c.last_access).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never',
            isEnabled: c.is_enabled,
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

  const handleToggle = async (consentId, currentValue) => {
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
    } catch (err) {
      console.error('Error toggling consent:', err);
    } finally {
      setTogglingId(null);
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
          <div className="p-3 bg-blue-100 text-primary rounded-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Your Health Data Access</h1>
            <p className="text-slate-500">Securely control which providers can view your medical information.</p>
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
          <div className="text-slate-700">
            <p className="font-bold text-primary mb-1">Privacy Notice</p>
            <p className="text-sm leading-relaxed">You have full control over who can access your health information. Revoking access will prevent providers from seeing your records immediately. You can re-enable access at any time.</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-10 text-slate-400">Loading consent settings...</div>
        ) : (
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <h3 className="text-lg font-bold text-slate-900 px-2">Authorized Providers</h3>
            {consents.length > 0 ? (
              consents.map((c) => (
                <ProviderToggle 
                  key={c.id}
                  providerName={c.providerName}
                  service={c.service}
                  lastAccess={c.lastAccess}
                  isEnabled={c.isEnabled}
                  loading={togglingId === c.id}
                  onToggle={() => handleToggle(c.id, c.isEnabled)}
                />
              ))
            ) : (
              <div className="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-100">
                No providers to manage yet. Request a service from a provider first!
              </div>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientConsent;
