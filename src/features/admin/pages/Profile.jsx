import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  SignOut,
  Shield,
  Users,
  Briefcase,
  FileText,
  User,
  ChartBar,
  Lock,
  FloppyDisk,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { SkeletonPage } from '@/shared/ui';
import { useNavigate } from 'react-router-dom';
import useCountUp from '@/hooks/useCountUp';
import { ProfilePhotoUpload } from '@/shared/components';
import toast from 'react-hot-toast';

const QuickStat = ({ label, value, icon, colorClass }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1200, false);
  return (
    <div className="text-center p-4 sm:p-6 neu-inset rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center">
      <div className={`w-11 h-11 sm:w-13 sm:h-13 mx-auto rounded-2xl neu-flat-sm ${colorClass} flex items-center justify-center mb-2.5`}>
        {React.cloneElement(icon, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
      </div>
      <p className="text-xl sm:text-3xl font-display font-black text-slate-900 dark:text-white" ref={ref}>
        {count}
      </p>
      <p className="text-2xs sm:text-xs text-tertiary font-extrabold uppercase tracking-wider mt-0.5 dark:text-tertiary">
        {label}
      </p>
    </div>
  );
};

const AdminProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { t, formatDate } = useLanguage();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    created_at: ''
  });

  const [editName, setEditName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [stats, setStats] = useState({
    patients: 0,
    providers: 0,
    requests: 0
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email, created_at')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;

        setProfile({
          full_name: userData.full_name || '',
          email: userData.email || user.email || '',
          created_at: userData.created_at || ''
        });
        setEditName(userData.full_name || '');

        try {
          const { data: avData } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
          if (avData?.avatar_url) setAvatarUrl(avData.avatar_url);
        } catch {} // column may not exist yet

        // Fetch quick stats
        const { count: patientCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'patient');

        const { count: providerCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'provider');

        const { count: requestCount } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true });

        setStats({
          patients: patientCount || 0,
          providers: providerCount || 0,
          requests: requestCount || 0
        });
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!editName.trim()) {
      toast.error(t('admin.profile.toastEmptyName'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: editName.trim() })
        .eq('id', user.id);

      if (error) throw error;
      setProfile(prev => ({ ...prev, full_name: editName.trim() }));
      updateUser?.({ full_name: editName.trim() });
      toast.success(t('admin.profile.toastUpdated'));
    } catch (err) {
      console.error('Error updating name:', err);
      toast.error(t('admin.profile.toastUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="w-full max-w-full space-y-6 md:space-y-8">
        {/* Page Top Header Banner */}
        <motion.div
          className="neu-flat p-4 sm:p-6 rounded-2xl sm:rounded-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white">
            {t('admin.profile.pageTitle')}
          </h1>
          <p className="text-sm text-tertiary dark:text-tertiary mt-1">
            {t('admin.profile.pageSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left Column: Admin Identity Card (5 cols) */}
          <div className="lg:col-span-5">
            <motion.div 
              className="neu-flat rounded-2xl sm:rounded-3xl overflow-hidden p-6 sm:p-7 space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Avatar Upload Container */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <ProfilePhotoUpload
                    userId={user.id}
                    fullName={profile.full_name || t('admin.profile.fallbackName')}
                    currentUrl={avatarUrl}
                    onUpdate={setAvatarUrl}
                  />
                </div>

                <div className="mt-4">
                  <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 dark:text-white">
                    {profile.full_name || t('admin.profile.fallbackName')}
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-tertiary dark:text-tertiary mt-0.5">
                    {profile.email}
                  </p>
                </div>

                {/* Role Badge */}
                <div className="mt-3">
                  <span className="neu-flat-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-2xs font-extrabold uppercase tracking-wider text-link">
                    <Shield className="w-3.5 h-3.5 text-link" />
                    {t('admin.profile.roleBadge')}
                  </span>
                </div>
              </div>

              {/* Inset Account Info Details */}
              <div className="neu-inset p-4 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-tertiary font-bold uppercase tracking-wider text-2xs">{t('admin.profile.roleLevelLabel')}</span>
                  <span className="font-black text-link">{t('admin.profile.superAdmin')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-tertiary font-bold uppercase tracking-wider text-2xs">{t('admin.profile.joinedLabel')}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {profile.created_at ? formatDate(profile.created_at, { month: 'short', day: 'numeric', year: 'numeric' }) : t('admin.profile.na')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-tertiary font-bold uppercase tracking-wider text-2xs">{t('admin.profile.jurisdictionLabel')}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{t('admin.profile.jurisdictionValue')}</span>
                </div>
              </div>

              {/* Logout Action */}
              <div className="pt-2 border-t border-white/60 dark:border-white/5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleLogout}
                  className="w-full neu-btn py-3 rounded-2xl font-black text-xs sm:text-sm text-danger dark:text-danger-dark hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <SignOut className="w-4 h-4" />
                  <span>{t('admin.profile.signOutBtn')}</span>
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Tabbed Sections (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {/* Neumorphic Tab Switches */}
              <div className="neu-flat p-1.5 rounded-2xl flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'overview'
                      ? 'neu-inset text-link'
                      : 'text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{t('admin.profile.tabDetails')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'system'
                      ? 'neu-inset text-link'
                      : 'text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <ChartBar className="w-4 h-4" />
                  <span>{t('admin.profile.tabTelemetry')}</span>
                </button>
              </div>

              {/* Tab 1: Account Overview */}
              {activeTab === 'overview' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neu-flat rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-6"
                >
                  <div className="border-b border-white/60 dark:border-white/5 pb-4">
                    <h3 className="text-base sm:text-lg font-display font-black text-slate-900 dark:text-white">
                      {t('admin.profile.cardTitle')}
                    </h3>
                    <p className="text-2xs text-tertiary font-bold uppercase tracking-wider mt-0.5">
                      {t('admin.profile.cardSubtitle')}
                    </p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="admin-full-name" className="text-2xs font-black uppercase tracking-wider text-tertiary dark:text-tertiary">
                        {t('admin.profile.nameLabel')}
                      </label>
                      <input
                        id="admin-full-name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('admin.profile.namePlaceholder')}
                        className="w-full neu-inset rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-2xs font-black uppercase tracking-wider text-tertiary dark:text-tertiary">
                        {t('admin.profile.emailLabel')}
                      </label>
                      <div className="neu-inset rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-tertiary dark:text-tertiary flex items-center justify-between cursor-not-allowed">
                        <span className="truncate">{profile.email}</span>
                        <Lock className="w-3.5 h-3.5 text-tertiary shrink-0" />
                      </div>
                    </div>

                    <div className="pt-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={saving}
                        className="w-full neu-btn-primary py-3 rounded-2xl text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                      >
                        <FloppyDisk className="w-4 h-4" />
                        <span>{saving ? t('admin.profile.updating') : t('admin.profile.saveBtn')}</span>
                      </motion.button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Tab 2: System Telemetry Stats */}
              {activeTab === 'system' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="neu-flat rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-6"
                >
                  <div className="border-b border-white/60 dark:border-white/5 pb-4">
                    <h3 className="text-base sm:text-lg font-display font-black text-slate-900 dark:text-white">
                      {t('admin.profile.statsTitle')}
                    </h3>
                    <p className="text-2xs text-tertiary font-bold uppercase tracking-wider mt-0.5">
                      {t('admin.profile.statsSubtitle')}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <QuickStat 
                      label={t('admin.profile.statPatients')}
                      value={stats.patients} 
                      icon={<Users />} 
                      colorClass="text-link" 
                    />
                    <QuickStat 
                      label={t('admin.profile.statProviders')}
                      value={stats.providers} 
                      icon={<Briefcase />} 
                      colorClass="text-link dark:text-primary-400" 
                    />
                    <QuickStat 
                      label={t('admin.profile.statRequests')}
                      value={stats.requests} 
                      icon={<FileText />} 
                      colorClass="text-warning dark:text-warning-dark" 
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminProfile;
