import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { 
  LogOut, Shield, Calendar, Users, Briefcase, FileText, 
  User, BarChart3, CheckCircle2, Lock, Save, Sparkles, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import ProfilePhotoUpload from '../../components/ProfilePhotoUpload';
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
      <p className="text-2xs sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider mt-0.5 dark:text-slate-400">
        {label}
      </p>
    </div>
  );
};

const AdminProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, logout } = useAuth();
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
          full_name: userData.full_name || 'System Administrator',
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
      toast.error('Full Name cannot be empty.');
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
      toast.success('Admin name updated successfully!');
    } catch (err) {
      console.error('Error updating name:', err);
      toast.error('Failed to update name.');
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
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Page Top Header Banner */}
        <motion.div
          className="neu-flat p-4 sm:p-6 rounded-2xl sm:rounded-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white">
            System Admin Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your administrative credentials, oversee platform telemetry, and system statistics
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
                    fullName={profile.full_name}
                    currentUrl={avatarUrl}
                    onUpdate={setAvatarUrl}
                  />
                </div>

                <div className="mt-4">
                  <h2 className="text-lg sm:text-xl font-display font-black text-slate-900 dark:text-white">
                    {profile.full_name}
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {profile.email}
                  </p>
                </div>

                {/* Role Pill */}
                <div className="mt-3">
                  <span className="neu-flat-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-primary">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    System Administrator
                  </span>
                </div>
              </div>

              {/* Inset Account Info Details */}
              <div className="neu-inset p-4 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-3xs">Role Level:</span>
                  <span className="font-black text-primary">Super Administrator</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-3xs">Joined Platform:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-3xs">Jurisdiction:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">Muntinlupa City</span>
                </div>
              </div>

              {/* Logout Action */}
              <div className="pt-2 border-t border-white/60 dark:border-white/5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleLogout}
                  className="w-full neu-btn py-3 rounded-2xl font-black text-xs sm:text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Admin Console</span>
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
                      ? 'neu-inset text-primary'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Account Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'system'
                      ? 'neu-inset text-primary'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>System Telemetry</span>
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
                      Profile Information
                    </h3>
                    <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Personalize your identity as seen on audits
                    </p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Admin Full Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="e.g., Juan Dela Cruz"
                        className="w-full neu-inset rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Email Address (Read-only)
                      </label>
                      <div className="neu-inset rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between cursor-not-allowed">
                        <span className="truncate">{profile.email}</span>
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    <div className="pt-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={saving}
                        className="w-full neu-btn-primary py-3 rounded-2xl text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Updating...' : 'Save Profile Changes'}</span>
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
                      Platform Statistics
                    </h3>
                    <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      Live entity metrics across the Muntinlupa network
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <QuickStat 
                      label="Patients" 
                      value={stats.patients} 
                      icon={<Users />} 
                      colorClass="text-primary" 
                    />
                    <QuickStat 
                      label="Providers" 
                      value={stats.providers} 
                      icon={<Briefcase />} 
                      colorClass="text-purple-600 dark:text-purple-400" 
                    />
                    <QuickStat 
                      label="Requests" 
                      value={stats.requests} 
                      icon={<FileText />} 
                      colorClass="text-amber-500" 
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
