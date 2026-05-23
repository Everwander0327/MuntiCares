import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { LogOut, Shield, Mail, Calendar, Users, Briefcase, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';

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
      <div className="max-w-2xl mx-auto space-y-6 md:space-y-8">
        {/* Profile Card */}
        <motion.div 
          className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Gradient Banner */}
          <div className="h-32 md:h-36 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 relative">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          {/* Avatar */}
          <div className="px-6 md:px-8 -mt-16 md:-mt-18 relative z-10 flex justify-center">
            <div className="relative">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center text-4xl md:text-5xl font-bold text-slate-700 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-200"
                style={{ background: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)' }}
              >
                {profile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                <Shield className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 pt-5 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{profile.full_name}</h2>
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
          </div>

          {/* Quick Stats */}
          <div className="mx-6 md:mx-8 mt-8 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900">
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
              <QuickStat 
                label="Patients" 
                value={stats.patients} 
                icon={<Users />} 
                color="bg-blue-100 text-primary" 
              />
              <QuickStat 
                label="Providers" 
                value={stats.providers} 
                icon={<Briefcase />} 
                color="bg-purple-100 text-purple-600" 
              />
              <QuickStat 
                label="Requests" 
                value={stats.requests} 
                icon={<FileText />} 
                color="bg-orange-100 text-orange-600" 
              />
            </div>
          </div>

          {/* Logout — very bottom */}
          <div className="px-6 md:px-8 pt-8 pb-6 md:pb-8">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm border border-red-100"
            >
              <LogOut className="w-4 h-4" />
              Logout from Admin Panel
            </button>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminProfile;
