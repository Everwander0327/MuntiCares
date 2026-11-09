import { useState, useRef } from 'react';
import { Camera, Loader2, Sparkles, Upload, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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

const ProfilePhotoUpload = ({ userId, fullName, currentUrl, role: propRole, onUpdate, compact = false }) => {
  const { user: authUser } = useAuth();
  const effectiveRole = propRole || authUser?.role || 'patient';
  const isProvider = effectiveRole === 'provider';
  const isAdmin = effectiveRole === 'admin';

  // Providers only see Doctor avatars, Patients only see Patient avatars
  const avatarList = isProvider ? DOCTOR_AVATARS : isAdmin ? [...DOCTOR_AVATARS, ...PATIENT_AVATARS] : PATIENT_AVATARS;
  const collectionTitle = isProvider ? 'Healthcare Provider Avatars' : isAdmin ? 'Administrator Avatars' : 'Patient Avatars';
  const collectionSubtitle = isProvider 
    ? 'Preview and apply a 3D medical character or upload your own photo'
    : 'Preview and apply a 3D character avatar or upload your own photo';

  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [stagedAvatar, setStagedAvatar] = useState(null);
  const inputRef = useRef(null);

  const src = preview || currentUrl;

  const openModal = () => {
    const matched = avatarList.find((a) => a.src === src) || null;
    setStagedAvatar(matched);
    setModalOpen(true);
  };

  const syncUserAvatar = (avatarUrl) => {
    const stored = localStorage.getItem('munticares_user');
    if (stored) {
      try {
        const userObj = JSON.parse(stored);
        if (userObj.id === userId) {
          userObj.avatar_url = avatarUrl;
          localStorage.setItem('munticares_user', JSON.stringify(userObj));
          window.dispatchEvent(new Event('munticares-user-updated'));
        }
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
      if (inputRef.current) inputRef.current.value = '';
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

      setPreview(avatarUrl);
      syncUserAvatar(avatarUrl);
      toast.success('Custom photo uploaded!');
      setModalOpen(false);
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo.');
      setPreview(null);
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (inputRef.current) inputRef.current.value = '';
      setUploading(false);
    }
  };

  const activePreviewSrc = stagedAvatar ? stagedAvatar.src : src;
  const activePreset = stagedAvatar || avatarList.find((a) => a.src === src) || null;
  const isStagedChanged = Boolean(stagedAvatar && stagedAvatar.src !== src);

  return (
    <>
      <div className="relative mx-auto shrink-0">
        <div 
          onClick={openModal}
          className={`${
            compact ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl' : 'w-24 h-24 md:w-28 md:h-28 rounded-2xl'
          } bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 ring-2 ring-white/70 dark:ring-white/15 shadow-lg flex items-center justify-center overflow-hidden cursor-pointer group hover:scale-[1.02] transition-transform relative`}
          title="Click to choose 3D avatar or upload photo"
        >
          {src ? (
            <img src={src} alt="Profile" className="w-full h-full object-cover block" />
          ) : (
            <span className={`${compact ? 'text-xl sm:text-2xl' : 'text-3xl md:text-4xl'} font-black text-link`}>
              {fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
            </span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
          {/* Subtle hover overlay hint */}
          <div className="absolute inset-0 bg-slate-950/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
            <Sparkles className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        </div>

        {/* Option 1: Sleek proportional primary accent squircle micro-badge */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={openModal}
          disabled={uploading}
          className={`absolute -bottom-1 -right-1 ${
            compact ? 'w-6 h-6 rounded-lg' : 'w-7 h-7 rounded-lg'
          } bg-primary hover:bg-primary/90 text-white border-2 border-[#e8ecf2] dark:border-[#16212e] flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105 disabled:opacity-50 z-10`}
          title="Choose 3D Avatar or Upload Photo"
        >
          <Camera className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
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

      {/* Option 1: Neumorphic 3D Avatar Selection Modal (Mobile Bottom Sheet + Desktop Centered Modal) */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => !uploading && setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="neu-flat w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-2xl border-t sm:border border-white/60 dark:border-white/10 max-h-[92dvh] flex flex-col"
            >
              {/* Mobile Bottom Sheet Grab Handle */}
              <div className="w-10 h-1 rounded-sm bg-slate-300 dark:bg-slate-600 mx-auto mb-3 sm:hidden shrink-0" />

              {/* Clean Modal Header (No Left Icon) */}
              <div className="flex items-start justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200/50 dark:border-white/5 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                    {collectionTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-tertiary dark:text-tertiary font-medium mt-0.5">
                    {collectionSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="neu-btn p-2 rounded-xl text-tertiary hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Live Identity Preview Stage (Signal / Cal.com Pattern) */}
              <div className="neu-inset rounded-2xl p-3 sm:p-3.5 mb-3.5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 ring-2 ring-white/60 dark:ring-white/15 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                    {activePreviewSrc ? (
                      <img src={activePreviewSrc} alt="Staged Avatar Preview" className="w-full h-full object-cover block" />
                    ) : (
                      <span className="text-lg sm:text-xl font-black text-link">
                        {fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                        {fullName || 'Your Profile'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isStagedChanged
                          ? 'bg-primary/15 text-link border border-primary/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {activePreset
                          ? `${isStagedChanged ? 'Previewing' : 'Active'}: ${activePreset.name}`
                          : src
                            ? 'Custom Photo'
                            : 'Initials'}
                      </span>
                    </div>
                    <p className="text-xs text-tertiary font-medium truncate mt-0.5">
                      {activePreset ? `${activePreset.role} • 3D Preset` : 'Upload a custom photo or tap a 3D character below'}
                    </p>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="neu-btn px-3 py-2 rounded-xl font-extrabold text-xs text-link flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  title="Upload custom photo from device"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-link" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden xs:inline sm:inline">Upload Photo</span>
                </motion.button>
              </div>

              {/* Clean Single-Border Squircle Grid (2-Col Mobile / 3-Col Desktop, Zero Double-Ring Clutter) */}
              <div className="overflow-y-auto pr-0.5 no-scrollbar flex-1 min-h-0 mb-3.5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 p-0.5">
                  {avatarList.map((avatar) => {
                    const isSelected = stagedAvatar ? stagedAvatar.id === avatar.id : src === avatar.src;
                    return (
                      <motion.button
                        key={avatar.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setStagedAvatar(avatar)}
                        disabled={uploading}
                        className={`group relative flex items-center sm:flex-col gap-2.5 sm:gap-0 p-2.5 sm:p-3 rounded-2xl transition-all cursor-pointer select-none text-left sm:text-center ${
                          isSelected
                            ? 'bg-primary/10 dark:bg-primary/15 border-2 border-primary shadow-sm'
                            : 'neu-btn border-2 border-transparent hover:border-primary/40'
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 w-5 h-5 rounded-md bg-primary text-white flex items-center justify-center shadow-sm z-10"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </motion.span>
                        )}

                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm shrink-0">
                          <img
                            src={avatar.src}
                            alt={avatar.name}
                            className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>

                        <div className="min-w-0 flex-1 sm:w-full sm:mt-2 pr-4 sm:pr-0">
                          <p className={`font-extrabold text-xs truncate ${
                            isSelected ? 'text-link' : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {avatar.name}
                          </p>
                          <p className="text-[11px] text-tertiary font-medium truncate">
                            {avatar.role}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Sticky Action Footer (Cancel + Apply Avatar) */}
              <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                <p className="hidden sm:block text-xs text-tertiary font-medium">
                  Custom photo: JPG, PNG or WebP up to 2MB
                </p>
                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={uploading}
                    className="neu-btn px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => {
                      if (stagedAvatar && stagedAvatar.src !== src) {
                        handleSelectDefault(stagedAvatar);
                      } else {
                        setModalOpen(false);
                      }
                    }}
                    disabled={uploading || !stagedAvatar}
                    className="px-5 py-2.5 rounded-xl font-extrabold text-xs bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Apply Avatar</span>
                      </>
                    )}
                  </motion.button>
                </div>
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
