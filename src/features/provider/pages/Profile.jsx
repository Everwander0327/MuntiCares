import { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Mail, Phone, MapPin, Award, BookOpen, Clock, LogOut, Calendar, CheckCircle2, ShieldCheck, Save, Shield, User } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

import { SkeletonPage } from '@/shared/ui';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ProfilePhotoUpload } from '@/shared/components';

const calculateTrustScore = (data) => {
  let score = 0;
  if (data.is_approved) score += 30;
  if (data.professional_id_status === 'verified') score += 30;
  if (data.is_profile_complete) score += 20;
  if (data.rating && data.rating >= 4.0) score += 20;
  return Math.min(100, score);
};

const getTrustLevel = (score) => {
  if (score >= 90) return { label: 'Highly Trusted', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-900/50' };
  if (score >= 70) return { label: 'Trusted', color: 'text-green-600 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-900/50' };
  if (score >= 40) return { label: 'Developing', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-900/50' };
  return { label: 'Needs Improvement', color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-900/50' };
};

const ProviderProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    services: [],
    price_per_service: 0,
    is_profile_complete: false,
    is_approved: false,
    professional_id_path: null,
    professional_id_paths: [],
    professional_id_status: 'none',
    trust_score: 0,
    rating: 0,
    created_at: ''
  });

  const [editForm, setEditForm] = useState({ ...profile });
  const [servicesInput, setServicesInput] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [editingOverview, setEditingOverview] = useState(false);
  const [editingSpecializations, setEditingSpecializations] = useState(false);

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

        try {
          const { data: avData } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
          if (avData?.avatar_url) setAvatarUrl(avData.avatar_url);
        } catch {} // column may not exist yet

        const { data: provData, error: provError } = await supabase
          .from('providers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (provError) throw provError;

        const fullProfile = {
          full_name: userData.full_name,
          email: userData.email,
          phone: provData.phone || '',
          location: provData.location || 'Muntinlupa City',
          bio: provData.bio || '',
          services: provData.services || [],
          price_per_service: provData.price_per_service || 0,
          is_profile_complete: provData.is_profile_complete,
          is_approved: provData.is_approved,
          professional_id_path: provData.professional_id_path || null,
          professional_id_paths: provData.professional_id_paths || [],
          professional_id_status: provData.professional_id_status || 'none',
          trust_score: provData.trust_score || 0,
          rating: provData.rating || 0,
          created_at: userData.created_at
        };

        const computedScore = calculateTrustScore(fullProfile);
        fullProfile.trust_score = computedScore;

        setProfile(fullProfile);
        setEditForm(fullProfile);
        setServicesInput((provData.services || []).join(', '));

      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveOverview = async () => {
    if (!editForm.phone.trim() || !editForm.location.trim() || !editForm.bio.trim()) {
      toast.error('Please fill out all fields (Phone, Location, Bio).');
      return;
    }

    setSaving(true);
    try {
      const updatedData = {
        phone: editForm.phone,
        location: editForm.location,
        bio: editForm.bio,
        price_per_service: editForm.price_per_service,
        is_profile_complete: true,
      };

      const newScore = calculateTrustScore({
        ...profile,
        ...updatedData,
        professional_id_path: profile.professional_id_path,
        rating: profile.rating,
      });
      updatedData.trust_score = newScore;

      const { error } = await supabase
        .from('providers')
        .update(updatedData)
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, ...editForm, is_profile_complete: true, trust_score: newScore }));
      setEditingOverview(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSpecializations = async () => {
    const servicesList = servicesInput.split(',').map(s => s.trim()).filter(s => s);

    if (servicesList.length === 0) {
      toast.error('Please add at least one specialization.');
      return;
    }

    setSaving(true);
    try {
      const newScore = calculateTrustScore({ ...profile, services: servicesList });
      const { error } = await supabase
        .from('providers')
        .update({ services: servicesList, trust_score: newScore })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, services: servicesList, trust_score: newScore }));
      setEditingSpecializations(false);
      toast.success('Specializations updated!');
    } catch (err) {
      console.error('Error saving specializations:', err);
      toast.error('Failed to save specializations.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const trustLevel = getTrustLevel(profile.trust_score);

  if (loading) {
    return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="provider">
      <div className="w-full max-w-full lg:max-w-6xl mx-auto space-y-3.5 sm:space-y-6 pb-12 px-0 sm:px-2 select-text">
        {/* Header */}
        <div className="pt-0.5 pb-1 sm:pt-1 sm:pb-2">
          <h1 className="font-display font-black tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
            Provider Profile
          </h1>
          <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Manage your credentials, professional bio, services offered, and trust score.
          </p>
        </div>

        {/* Status Alerts (Neumorphic Flat/Inset) */}
        {!profile.is_profile_complete && (
          <motion.div 
            className="neu-flat p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-amber-500/30 bg-amber-500/5 flex items-start gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="neu-flat-sm w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-amber-800 dark:text-amber-300 font-extrabold text-xs sm:text-base">Profile Incomplete</h3>
              <p className="text-amber-700/80 dark:text-amber-200/70 text-3xs sm:text-xs mt-0.5 leading-relaxed">
                Please fill out your contact details, bio, and rates so you can be approved by an Admin and become visible to patients.
              </p>
            </div>
          </motion.div>
        )}

        {profile.is_profile_complete && !profile.is_approved && (
          <motion.div 
            className="neu-flat p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-blue-500/30 bg-blue-500/5 flex items-start gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="neu-flat-sm w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-blue-800 dark:text-blue-300 font-extrabold text-xs sm:text-base">Under Review</h3>
              <p className="text-blue-700/80 dark:text-blue-200/70 text-3xs sm:text-xs mt-0.5 leading-relaxed">
                Your profile is currently under review by the municipal health office. You will appear to patients once approved.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-6 md:gap-7">
          {/* Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div 
              className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Neumorphic Accent Banner */}
              <div className="h-16 sm:h-24 neu-convex relative flex items-center justify-center overflow-hidden border-b border-white/50 dark:border-white/5">
                <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5" />
              </div>

              {/* Avatar overlapping banner */}
              <div className="px-4 sm:px-6 -mt-10 sm:-mt-14 relative z-10 flex justify-center">
                <div className="neu-flat rounded-full p-1 sm:p-1.5 shadow-lg">
                  <ProfilePhotoUpload
                    userId={user.id}
                    fullName={profile.full_name}
                    currentUrl={avatarUrl}
                    onUpdate={setAvatarUrl}
                  />
                </div>
              </div>

              <div className="px-4 sm:px-6 pt-2.5 sm:pt-3 pb-5 sm:pb-7 text-center">
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 truncate">{profile.full_name}</h2>
                <p className="text-primary text-xs font-bold mt-0.5 truncate">{profile.bio || 'Healthcare Professional'}</p>

                <div className="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 mt-2.5 sm:mt-3">
                  <span className="neu-flat-sm px-2.5 py-1 text-primary font-black text-3xs uppercase tracking-widest rounded-full">
                    Healthcare Provider
                  </span>
                  {profile.is_approved ? (
                    <span className="neu-flat-sm px-2.5 py-1 text-emerald-600 dark:text-emerald-400 font-black text-3xs uppercase tracking-widest rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" /> Approved
                    </span>
                  ) : profile.is_profile_complete ? (
                    <span className="neu-flat-sm px-2.5 py-1 text-amber-600 dark:text-amber-400 font-black text-3xs uppercase tracking-widest rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> In Review
                    </span>
                  ) : null}
                </div>

                {/* Trust Score Badge (Neumorphic Raised) */}
                <div className="mt-3 sm:mt-4 neu-btn inline-flex items-center gap-2 px-3.5 py-1.5 sm:py-2 rounded-xl border border-primary/20">
                  <Shield className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${trustLevel.color}`} />
                  <span className={`text-xs sm:text-sm font-black ${trustLevel.color}`}>
                    Trust Score: {profile.trust_score}/100
                  </span>
                </div>

                {/* Quick Info - Unified Neumorphic Inset */}
                <div className="mt-4 sm:mt-5 neu-inset p-3 sm:p-4 rounded-2xl text-left space-y-2 sm:space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                    <span className="text-3xs uppercase font-extrabold text-slate-400">Email</span>
                    <span className="truncate font-semibold max-w-[62%] text-right">{profile.email}</span>
                  </div>

                  {profile.phone && (
                    <>
                      <div className="border-t border-slate-200/50 dark:border-white/5" />
                      <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                        <span className="text-3xs uppercase font-extrabold text-slate-400">Phone</span>
                        <span className="font-semibold">{profile.phone}</span>
                      </div>
                    </>
                  )}

                  {profile.location && (
                    <>
                      <div className="border-t border-slate-200/50 dark:border-white/5" />
                      <div className="flex items-start justify-between gap-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                        <span className="text-3xs uppercase font-extrabold text-slate-400 shrink-0 pt-0.5">Location</span>
                        <span className="font-semibold text-right leading-relaxed max-w-[65%] break-words">{profile.location}</span>
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                    <span className="text-3xs uppercase font-extrabold text-slate-400">Rate</span>
                    <span className="font-black text-primary">₱{Number(profile.price_per_service || 0).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                    <span className="text-3xs uppercase font-extrabold text-slate-400">Joined</span>
                    <span className="font-semibold">{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>

                {/* Sign Out Button */}
                <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-200/60 dark:border-white/5">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLogout}
                    className="neu-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 transition-all text-xs cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
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
                {/* Neumorphic Tab Switcher matching Patient Profile */}
                <Tabs.List className="neu-inset p-1 sm:p-1.5 rounded-2xl mb-3.5 sm:mb-5 flex gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { value: 'overview', icon: User, label: 'Overview' },
                    { value: 'specializations', icon: Award, label: 'Services' },
                    { value: 'trust', icon: Shield, label: 'Trust Score' },
                  ].map(tab => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={`flex items-center justify-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-3xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 cursor-pointer select-none ${
                        activeTab === tab.value
                          ? 'neu-pressed text-primary font-black shadow-inner'
                          : 'neu-btn text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <tab.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === tab.value ? 'text-primary' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Content value="overview" className="outline-none">
                  <div className="neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-7 border-b border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Professional Details & Rates</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Your bio, location, and fees displayed during patient booking</p>
                      </div>
                      {!editingOverview ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setEditingOverview(true); setEditForm(profile); }}
                          className="neu-btn px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-primary flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                        >
                          <Save className="w-4 h-4" />
                          Edit Profile
                        </motion.button>
                      ) : (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { setEditingOverview(false); setEditForm(profile); }}
                            className="neu-btn px-3 sm:px-4 py-2 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 cursor-pointer flex-1 sm:flex-initial"
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleSaveOverview}
                            disabled={saving}
                            className="neu-btn px-4 sm:px-5 py-2 rounded-xl font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </motion.button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
                      <div>
                        <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Bio / Professional Title</p>
                        {editingOverview ? (
                          <input
                            type="text" 
                            name="bio"
                            value={editForm.bio}
                            onChange={e => setEditForm({...editForm, bio: e.target.value})}
                            placeholder="E.g. Registered Nurse • Wound Care Specialist"
                            className="w-full neu-inset rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                          />
                        ) : (
                          <div className="neu-inset p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                            {profile.bio || 'No bio provided'}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
                        <div>
                          <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Phone Number</p>
                          {editingOverview ? (
                            <div className="relative">
                              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text" 
                                name="phone"
                                value={editForm.phone}
                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                placeholder="+63 912 345 6789"
                                className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-10 pr-3.5 sm:pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="neu-inset p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                              <Phone className="w-4 h-4 text-primary shrink-0" />
                              <span>{profile.phone || 'Not provided'}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Service Location / Area</p>
                          {editingOverview ? (
                            <div className="relative">
                              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="text" 
                                name="location"
                                value={editForm.location}
                                onChange={e => setEditForm({...editForm, location: e.target.value})}
                                placeholder="e.g. Poblacion, Muntinlupa"
                                className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-10 pr-3.5 sm:pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="neu-inset p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                              <MapPin className="w-4 h-4 text-primary shrink-0" />
                              <span>{profile.location || 'No location set'}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Rate per Service (₱)</p>
                          {editingOverview ? (
                            <div className="relative">
                              <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <input
                                type="number" 
                                name="price_per_service"
                                value={editForm.price_per_service}
                                onChange={e => setEditForm({...editForm, price_per_service: Number(e.target.value)})}
                                placeholder="e.g. 1500"
                                className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-10 pr-3.5 sm:pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="neu-inset p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              <BookOpen className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-primary font-black">₱{Number(profile.price_per_service || 0).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Email (Read Only)</p>
                          <div className="neu-inset p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate">{profile.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Specializations Tab */}
                <Tabs.Content value="specializations" className="outline-none">
                  <div className="neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-7 border-b border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Specializations & Services</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">List of medical and healthcare services you deliver</p>
                      </div>
                      {!editingSpecializations ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setEditingSpecializations(true)}
                          className="neu-btn px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-primary flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                        >
                          <Save className="w-4 h-4" />
                          Edit Specializations
                        </motion.button>
                      ) : (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { setEditingSpecializations(false); setServicesInput((profile.services || []).join(', ')); }}
                            className="neu-btn px-3 sm:px-4 py-2 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-700 cursor-pointer flex-1 sm:flex-initial"
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleSaveSpecializations}
                            disabled={saving}
                            className="neu-btn px-4 sm:px-5 py-2 rounded-xl font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Save' : 'Save'}
                          </motion.button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-6 md:p-7">
                      {editingSpecializations ? (
                        <div className="space-y-3.5 sm:space-y-4">
                          <div>
                            <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-1.5">Comma-Separated Services</p>
                            <textarea
                              name="services"
                              value={servicesInput}
                              onChange={e => setServicesInput(e.target.value)}
                              placeholder="Wound Care, Post-Surgery Recovery, Elderly Care"
                              className="w-full h-24 sm:h-28 neu-inset rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all"
                            />
                          </div>

                          <div>
                            <p className="text-3xs uppercase font-extrabold text-slate-400 dark:text-slate-500 mb-2">Suggested Services to Add:</p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {['Wound Care', 'Elderly Care', 'Post-Surgery Recovery', 'Physical Therapy', 'Vital Signs Monitoring', 'Medication Administration', 'Dementia Care', 'Stroke Rehab']
                                .filter(s => !(servicesInput || '').toLowerCase().includes(s.toLowerCase()))
                                .map(s => (
                                  <motion.button
                                    key={s}
                                    type="button"
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => {
                                      const curr = (servicesInput || '').trim();
                                      const newServices = curr ? `${curr.replace(/,\s*$/, '')}, ${s}` : s;
                                      setServicesInput(newServices);
                                    }}
                                    className="neu-btn px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-3xs sm:text-xs font-bold text-primary cursor-pointer active:scale-95"
                                  >
                                    + {s}
                                  </motion.button>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 sm:gap-2.5">
                          {profile.services.length > 0 ? (
                            profile.services.map((s, i) => (
                              <motion.span
                                key={i}
                                className="neu-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-3xs sm:text-sm font-extrabold text-primary shadow-sm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.05 + i * 0.04 }}
                              >
                                {s}
                              </motion.span>
                            ))
                          ) : (
                            <div className="neu-inset p-3.5 sm:p-4 rounded-xl text-center w-full">
                              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                                No specializations added yet. Click &ldquo;Edit Specializations&rdquo; to add services you provide.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Trust Score Breakdown Tab */}
                <Tabs.Content value="trust" className="outline-none">
                  <div className="neu-flat rounded-2xl sm:rounded-[2rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-7 border-b border-slate-200/50 dark:border-white/5">
                      <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Trust Score Breakdown</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Calculated based on credentials, verification status, and profile completion</p>
                    </div>

                    <div className="p-4 sm:p-6 md:p-7">
                      <div className="neu-inset p-3.5 sm:p-5 rounded-2xl space-y-2.5 sm:space-y-3">
                        {[
                          { label: 'Profile Completed', met: profile.is_profile_complete, points: 20 },
                          { label: 'PRC / Medical ID Verified', met: profile.professional_id_status === 'verified', points: 30 },
                          { label: 'Approved by City Health Office', met: profile.is_approved, points: 30 },
                          { label: 'Patient Rating 4.0 or Higher', met: profile.rating >= 4.0, points: 20 },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-slate-200/40 dark:border-white/5 last:border-0">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                              <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center ${item.met ? 'bg-emerald-500 text-white shadow-sm' : 'neu-pressed text-slate-400'}`}>
                                {item.met ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                              </div>
                              <span className="text-3xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                            </div>
                            <span className={`text-3xs sm:text-xs font-black ${item.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                              +{item.points} pts
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3.5 sm:mt-5 neu-flat p-3.5 sm:p-5 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 block">Total Calculated Score</span>
                          <span className="text-3xs uppercase tracking-wider font-bold text-slate-400">Level: {trustLevel.label}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg sm:text-2xl font-black ${trustLevel.color}`}>
                            {profile.trust_score}/100
                          </span>
                        </div>
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

export default ProviderProfile;
