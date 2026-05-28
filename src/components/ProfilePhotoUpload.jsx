import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ProfilePhotoUpload = ({ userId, fullName, currentUrl, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

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

      const { error: updateError } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
      if (updateError) {
        if (updateError.code === '42703') {
          // column doesn't exist yet — still show the photo this session
          console.warn('avatar_url column missing in users table');
        } else {
          throw updateError;
        }
      }

      onUpdate?.(avatarUrl);
      toast.success('Photo updated!');
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
    <div className="relative mx-auto">
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 border-4 border-white dark:border-slate-800 shadow-lg flex items-center justify-center overflow-hidden">
        {src ? (
          <img src={src} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl md:text-4xl font-bold text-primary">
            {fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
          </span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
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
  );
};

export default ProfilePhotoUpload;
