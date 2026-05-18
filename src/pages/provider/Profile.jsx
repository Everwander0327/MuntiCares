import React from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Camera, Mail, Phone, MapPin, Award } from 'lucide-react';
import { motion } from 'framer-motion';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderProfile = () => {
  const [isEditing, setIsEditing] = React.useState(false);

  const handleSave = () => {
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  return (
    <DashboardLayout role="provider">
      <motion.div 
        className="max-w-4xl space-y-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div 
          className="flex flex-col md:flex-row items-start gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
          variants={staggerItem}
        >
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] bg-blue-100 flex items-center justify-center text-4xl font-bold text-primary shadow-inner">
              MS
            </div>
            <motion.button 
              className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl shadow-lg transition-transform"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Camera className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              {isEditing ? (
                <input 
                  type="text" 
                  defaultValue="Maria Santos, RN"
                  className="text-3xl font-bold text-slate-900 bg-slate-50 border-b border-primary outline-none w-full"
                />
              ) : (
                <h1 className="text-3xl font-bold text-slate-900">Maria Santos, RN</h1>
              )}
              <p className="text-primary font-semibold">Registered Nurse • Wound Care Specialist</p>
            </div>
            <div className="flex flex-wrap gap-4 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Alabang, Muntinlupa</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span>8 Years Experience</span>
              </div>
            </div>
          </div>
          
          <motion.button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className="btn-primary px-8 rounded-2xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isEditing ? 'Save Profile' : 'Edit Profile'}
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div 
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
            variants={staggerItem}
          >
            <h3 className="text-xl font-bold text-slate-900 border-b pb-4">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Email</p>
                  <p className="text-slate-700 font-medium">maria.santos@email.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <Phone className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Phone</p>
                  <p className="text-slate-700 font-medium">+63 912 345 6789</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
            variants={staggerItem}
          >
            <h3 className="text-xl font-bold text-slate-900 border-b pb-4">Specializations</h3>
            <div className="flex flex-wrap gap-2">
              {['Wound Care', 'Post-Surgery Recovery', 'Elderly Care', 'IV Therapy', 'Diabetes Management'].map((s, i) => (
                <motion.span 
                  key={i} 
                  className="px-4 py-2 bg-blue-50 text-primary rounded-xl text-sm font-bold border border-blue-100"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default ProviderProfile;
