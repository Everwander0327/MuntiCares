import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { LogOut, Shield, Calendar, Users, Briefcase, FileText, User, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import ProfilePhotoUpload from '../../components/ProfilePhotoUpload';

const QuickStat = ({ label, value, icon, color }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1200, false);
  return (
    <div className="text-center p-4 md:p-6">
      <div className={`w-12 h-12 md:w-14 md:h-14 mx-auto rounded-2xl ${color} flex items-center justify-center mb-3`}>
        {React.cloneElement(icon, { className: 'w-6 h-6' })}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100" ref={ref}>{count}</p>
      <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 dark:text-slate-400">{label}</p>
    </div>
  );
};

const AdminProfile = () => {
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    created_at: ''
  });

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
          full_name: userData.full_name,
          email: userData.email,
          created_at: userData.created_at
        });

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden dark:bg-slate-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Gradient Banner */}
              <div className="h-28 md:h-32 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 relative">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              {/* Avatar */}
              <div className="px-6 md:px-8 -mt-14 md:-mt-16 relative z-10">
                <ProfilePhotoUpload
                  userId={user.id}
                  fullName={profile.full_name}
                  currentUrl={avatarUrl}
                  onUpdate={setAvatarUrl}
                />
              </div>

              <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.full_name}</h2>
                <p className="text-slate-500 font-medium mt-1 dark:text-slate-400">{profile.email}</p>

                <div className="flex items-center justify-center flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-full border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
                    <Shield className="w-3.5 h-3.5" />
                    System Administrator
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-4 dark:text-slate-400">
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span>Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</span>
                </div>

                {/* Logout — very bottom */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-sm dark:bg-red-900/30 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout from Admin Panel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column — Tabs */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <Tabs.List className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-2xl mb-6">
                  <Tabs.Trigger
                    value="overview"
                    className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-xl text-2xs md:text-sm font-medium transition-all whitespace-nowrap flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400`}
                  >
                    <User className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === 'overview' ? 'text-primary' : ''}`} />
                    <span>Overview</span>
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="system"
                    className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-xl text-2xs md:text-sm font-medium transition-all whitespace-nowrap flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400`}
                  >
                    <BarChart3 className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === 'system' ? 'text-primary' : ''}`} />
                    <span>System</span>
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Content value="overview" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Account Information</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your admin account details</p>
                    </div>
                    <div className="p-6 md:p-8 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Full Name</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                              <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium">{profile.full_name}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Email Address</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium truncate">{profile.email}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Role</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                              <Shield className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium">System Administrator</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Member Since</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium">
                              {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* System Tab */}
                <Tabs.Content value="system" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">System Statistics</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Overview of platform users and activity</p>
                    </div>
                    <div className="mx-6 md:mx-8 mt-6 mb-8 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900">
                      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
                        <QuickStat 
                          label="Patients" 
                          value={stats.patients} 
                          icon={<Users />} 
                          color="bg-blue-100 text-primary dark:bg-blue-900/30" 
                        />
                        <QuickStat 
                          label="Providers" 
                          value={stats.providers} 
                          icon={<Briefcase />} 
                          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" 
                        />
                        <QuickStat 
                          label="Requests" 
                          value={stats.requests} 
                          icon={<FileText />} 
                          color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300" 
                        />
                      </div>
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminProfile;
