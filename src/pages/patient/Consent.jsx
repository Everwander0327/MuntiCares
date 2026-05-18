import React, { useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ShieldCheck, Info, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderToggle = ({ name, service, lastAccess, initialValue }) => {
  const [isEnabled, setIsEnabled] = useState(initialValue);

  return (
    <motion.div 
      className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
      variants={staggerItem}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-lg font-bold text-slate-400">
          {name.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h4 className="font-bold text-slate-900">{name}</h4>
          <p className="text-slate-500 text-sm">{service}</p>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
            <Calendar className="w-3 h-3" />
            <span>Last access: {lastAccess}</span>
          </div>
        </div>
      </div>
      
      <motion.button 
        onClick={() => setIsEnabled(!isEnabled)}
        className={`w-14 h-8 rounded-full p-1 relative overflow-hidden transition-colors duration-300 relative ${isEnabled ? 'bg-green-500' : 'bg-slate-200'}`}
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

        <motion.div 
          className="space-y-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <h3 className="text-lg font-bold text-slate-900 px-2">Authorized Providers</h3>
          <ProviderToggle name="Maria Santos" service="Wound Care" lastAccess="Oct 20, 2025" initialValue={true} />
          <ProviderToggle name="Jose Reyes" service="Elder Care" lastAccess="Never" initialValue={false} />
          <ProviderToggle name="Ana Cruz" service="Physical Therapy" lastAccess="Oct 22, 2025" initialValue={true} />
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default PatientConsent;
