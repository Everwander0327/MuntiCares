import { useState, useRef } from 'react';
import { Camera, Loader2, Sparkles, Upload, Check, X, Stethoscope, User, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const DOCTOR_AVATARS = [
  { id: 'doc-male', name: 'Dr. Ryan', src: '/images/avatars/avatar_doctor_male.jpg', role: 'Physician' },
  { id: 'nurse-female', name: 'Nurse Joy', src: '/images/avatars/avatar_nurse_female.jpg', role: 'Nurse / Specialist' },
  { id: 'doc-black', name: 'Dr. Marcus', src: '/images/avatars/avatar_doctor_black_male.jpg', role: 'Doctor' },
  { id: 'doc-asian-f', name: 'Dr. Kimberly', src: '/images/avatars/avatar_doctor_female_asian.jpg', role: 'Specialist' },
  { id: 'surgeon-male', name: 'Dr. Joshua', src: '/images/avatars/avatar_surgeon_male.jpg', role: 'Surgeon' },
  { id: 'nurse-hijab', name: 'Nurse Sara', src: '/images/avatars/avatar_nurse_hijab_female.jpg', role: 'Home Nurse' },
];

export const PATIENT_AVATARS = [
  { id: 'pat-hoodie', name: 'Alex', src: '/images/avatars/avatar_patient_hoodie.jpg', role: 'Youth / Casual' },
  { id: 'pat-female', name: 'Sarah', src: '/images/avatars/avatar_patient_female.jpg', role: 'Adult / Friendly' },
  { id: 'pat-tie', name: 'David', src: '/images/avatars/avatar_patient_shirt_tie.jpg', role: 'Formal / Adult' },
  { id: 'pat-grandpa', name: 'Lolo Carlos', src: '/images/avatars/avatar_patient_grandpa.jpg', role: 'Senior Citizen' },
  { id: 'pat-female-ref', name: 'Chloe', src: '/images/avatars/avatar_patient_female_ref.jpg', role: 'Friendly / Modern' },
  { id: 'pat-tie-ref', name: 'Lucas', src: '/images/avatars/avatar_patient_tie_ref.jpg', role: 'Casual / Friendly' },
];

const ProfilePhotoUpload = ({ userId, fullName, currentUrl, role: propRole, onUpdate }) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'patient';
  const isProvider = effectiveRole === 'provider';
  const isAdmin = effectiveRole === 'admin';

  // Providers only see Doctor avatars, Patients only see Patient avatars
  const avatarList = isProvider ? DOCTOR_AVATARS : isAdmin ? [...DOCTOR_AVATARS, ...PATIENT_AVATARS] : PATIENT_AVATARS;
  const collectionTitle = isProvider ? 'Healthcare Provider Avatars' : isAdmin ? 'Administrator Avatars' : 'Patient Avatars';
  const collectionSubtitle = isProvider 
    ? 'Choose a 3D medical character for your professional provider profile'
    : 'Choose a 3D character avatar for your personal patient profile';

  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  const syncUserAvatar = (avatarUrl) => {
    const stored = localStorage.getItem('munticares_user');
    if (stored) {
      try {
        const userObj = JSON.parse(stored);
        userObj.avatar_url = avatarUrl;
        localStorage.setItem('munticares_user', JSON.stringify(userObj));
        window.dispatchEvent(new Event('munticares-user-updated'));
      } catch {}
    }
    onUpdate?.(avatarUrl);
  };

  const handleSelectDefault = async (avatar) => {
    setUploading(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatar.src })
        .eq('id', userId);

      if (updateError && updateError.code !== '42703') {
        throw updateError;
      }

      setPreview(avatar.src);
      syncUserAvatar(avatar.src);
      toast.success(`Avatar set to ${avatar.name}!`);
      setModalOpen(false);
    } catch (err) {
      console.error('Error selecting avatar:', err);
      toast.error('Failed to update avatar.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Max 2MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const avatarUrl = publicUrl?.publicUrl || '';

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError && updateError.code !== '42703') {
        throw updateError;
      }

      syncUserAvatar(avatarUrl);
      toast.success('Custom photo uploaded!');
      setModalOpen(false);
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const src = preview || currentUrl;

  return (
    <>
      <div className="relative mx-auto">
        <div 
          onClick={() => setModalOpen(true)}
          className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 border-4 border-white dark:border-slate-800 shadow-lg flex items-center justify-center overflow-hidden cursor-pointer group hover:scale-[1.02] transition-transform"
          title="Click to choose 3D avatar or upload photo"
        >
          {src ? (
            <img src={src} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl md:text-4xl font-black text-primary">
              {fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
            </span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          {/* Subtle hover overlay hint */}
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full backdrop-blur-[2px]">
            <Sparkles className="w-6 h-6 text-white drop-shadow-md" />
          </div>
        </div>

        {/* Change button badge */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={uploading}
          className="neu-btn absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-primary cursor-pointer shadow-md disabled:opacity-50"
          title="Choose 3D Avatar or Upload Photo"
        >
          <Camera className="w-4 h-4" />
        </motion.button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </div>

      {/* Neumorphic 3D Avatar Selection Modal */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="neu-flat w-full max-w-xl rounded-3xl p-5 sm:p-6 relative overflow-hidden shadow-2xl border border-white/60 dark:border-white/10"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/50 dark:border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary">
                    {isProvider ? <Stethoscope className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                      {collectionTitle}
                    </h3>
                    <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {collectionSubtitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="neu-btn p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of Default 3D Realism Avatars Strictly Filtered for User Role */}
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-3 sm:gap-3.5 max-h-[310px] overflow-y-auto p-1 pr-1.5 no-scrollbar">
                  {avatarList.map((avatar) => {
                    const isCurrent = src === avatar.src;
                    return (
                      <motion.button
                        key={avatar.id}
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleSelectDefault(avatar)}
                        disabled={uploading}
                        className={`group relative flex flex-col items-center p-2.5 sm:p-3 rounded-2xl transition-all cursor-pointer select-none ${
                          isCurrent
                            ? 'neu-pressed border-2 border-primary/60 shadow-inner'
                            : 'neu-btn hover:border-primary/30'
                        }`}
                      >
                        <div className="relative">
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-sm transition-all ${
                            isCurrent
                              ? 'ring-4 ring-primary ring-offset-2 ring-offset-[#e8ecf2] dark:ring-offset-slate-800'
                              : 'border-2 border-white/80 dark:border-slate-700'
                          }`}>
                            <img
                              src={avatar.src}
                              alt={avatar.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>
                          {isCurrent && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </motion.div>
                          )}
                        </div>
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 mt-2 truncate w-full text-center">
                          {avatar.name}
                        </span>
                        <span className="text-3xs text-slate-400 font-medium truncate">
                          {avatar.role}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Upload Custom Photo Option */}
              <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-left w-full sm:w-auto">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Prefer your own photo?</p>
                  <p className="text-3xs text-slate-400">JPG, PNG or WebP up to 2MB</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="neu-btn px-4 py-2.5 rounded-xl font-extrabold text-xs text-primary flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto shadow-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload from Device</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default ProfilePhotoUpload;
