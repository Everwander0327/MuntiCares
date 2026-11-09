import { useState, useEffect } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Mail, Phone, MapPin, Award, Clock, LogOut, CheckCircle2, ShieldCheck, Save, Shield, User } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isMissingColumnError } from '@/features/patient/utils/patientProfile';

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
  if (score >= 90) return { label: 'Highly Trusted', color: 'text-success dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-900/50' };
  if (score >= 70) return { label: 'Trusted', color: 'text-success dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-900/50' };
  if (score >= 40) return { label: 'Developing', color: 'text-warning dark:text-warning-dark', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-900/50' };
  return { label: 'Needs Improvement', color: 'text-danger dark:text-danger-dark', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-900/50' };
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
    license_number: null,
    license_expiry: null,
    service_radius_km: null,
    languages: [],
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
  const [languagesInput, setLanguagesInput] = useState('');
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
          license_number: provData.license_number || null,
          license_expiry: provData.license_expiry ? String(provData.license_expiry).slice(0, 10) : null,
          service_radius_km: provData.service_radius_km ?? null,
          languages: provData.languages || [],
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
        setLanguagesInput((provData.languages || []).join(', '));

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
      const languagesList = [...new Set(
        (languagesInput || '').split(',').map(l => l.trim()).filter(l => l)
      )];
      const radiusInput = editForm.service_radius_km;
      const hasRadius = radiusInput !== '' && radiusInput !== null && radiusInput !== undefined;
      const serviceRadius = hasRadius && Number.isFinite(Number(radiusInput)) ? Number(radiusInput) : null;
      if (serviceRadius !== null && (serviceRadius < 1 || serviceRadius > 100)) {
        toast.error('Service radius must be between 1 and 100 km.');
        return;
      }

      const updatedData = {
        phone: editForm.phone,
        location: editForm.location,
        bio: editForm.bio,
        license_number: (editForm.license_number || '').trim() || null,
        license_expiry: editForm.license_expiry || null,
        service_radius_km: serviceRadius,
        languages: languagesList,
        is_profile_complete: true,
      };

      // trust_score is derived by the database from approval/verification/completeness/
      // rating. The provider must not be able to raise it, so it is never sent here.
      let { error } = await supabase
        .from('providers')
        .update(updatedData)
        .eq('user_id', user.id);

      // Databases without the credential migration keep the original form usable.
      let savedExtended = true;
      if (error && isMissingColumnError(error)) {
        savedExtended = false;
        const {
          license_number: _licenseNumber,
          license_expiry: _licenseExpiry,
          service_radius_km: _serviceRadius,
          languages: _languages,
          ...legacyData
        } = updatedData;
        ({ error } = await supabase
          .from('providers')
          .update(legacyData)
          .eq('user_id', user.id));
      }

      if (error) throw error;

      setProfile(prev => ({
        ...prev,
        ...editForm,
        ...(savedExtended
          ? {
              license_number: updatedData.license_number,
              license_expiry: updatedData.license_expiry,
              service_radius_km: updatedData.service_radius_km,
              languages: languagesList,
            }
          : {}),
        is_profile_complete: true,
        trust_score: calculateTrustScore({ ...prev, ...editForm, is_profile_complete: true }),
      }));
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
      const { error } = await supabase
        .from('providers')
        .update({ services: servicesList })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, services: servicesList }));
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
      <div className="w-full max-w-full space-y-3.5 sm:space-y-6 pb-12 px-0 sm:px-2 select-text">
        {/* Header */}
        <div className="pt-0.5 pb-1 sm:pt-1 sm:pb-2">
          <h1 className="font-display font-black tracking-tight text-lg sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
            Provider Profile
          </h1>
          <p className="text-sm text-tertiary dark:text-tertiary mt-0.5 font-medium">
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
            <div className="neu-flat-sm w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-warning shrink-0">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-amber-800 dark:text-warning-dark font-extrabold text-xs sm:text-base">Profile Incomplete</h3>
              <p className="text-warning dark:text-warning-dark text-xs sm:text-xs mt-0.5 leading-relaxed">
                Please fill out your contact details and bio so you can be approved by an Admin and become visible to patients.
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
            <div className="neu-flat-sm w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-link shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-blue-800 dark:text-primary-300 font-extrabold text-xs sm:text-base">Under Review</h3>
              <p className="text-blue-700/80 dark:text-blue-200/70 text-xs sm:text-xs mt-0.5 leading-relaxed">
                Your profile is currently under review by the municipal health office. You will appear to patients once approved.
              </p>
            </div>
          </motion.div>
        )}

        {/* ================= OPTION 1: COMPACT IDENTITY HERO BANNER ================= */}
        <motion.div
          className="neu-flat rounded-2xl p-4 sm:p-6 border border-slate-200/80 dark:border-white/10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <ProfilePhotoUpload
                userId={user.id}
                fullName={profile.full_name}
                currentUrl={avatarUrl}
                onUpdate={setAvatarUrl}
                compact
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    {profile.full_name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-link/15 border border-link/30 text-link font-black text-3xs uppercase tracking-wider shrink-0">
                    Healthcare Provider
                  </span>
                  {profile.is_approved ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-black text-3xs uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      <span>Approved</span>
                    </span>
                  ) : profile.is_profile_complete ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-black text-3xs uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-warning" />
                      <span>In Review</span>
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-tertiary dark:text-tertiary font-semibold mt-1 truncate">
                  <span className="text-link font-bold">{profile.bio || 'Healthcare Professional'}</span>
                  {' \u2022 Joined '}
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'N/A'}
                </p>

                {/* Inline Trust Score Progress */}
                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  <div className={`px-2 py-0.5 rounded-md border text-2xs font-black flex items-center gap-1.5 ${trustLevel.bg} ${trustLevel.border} ${trustLevel.color}`}>
                    <Shield className="w-3 h-3 shrink-0" />
                    <span>Trust Score: {profile.trust_score}/100</span>
                  </div>
                  <div className="w-24 sm:w-32 h-2 rounded-xs bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, profile.trust_score))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions (Thumb-friendly 2-column grid on mobile, inline on desktop) */}
            <div className="grid grid-cols-2 md:flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-white/10 shrink-0">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setActiveTab('overview');
                  setEditingOverview(true);
                  setEditForm(profile);
                  setLanguagesInput((profile.languages || []).join(', '));
                }}
                className="neu-btn px-3.5 py-2 rounded-xl font-black text-xs text-link flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleLogout}
                className="neu-btn px-3.5 py-2 rounded-xl font-black text-xs text-danger dark:text-danger-dark flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ================= ABOVE-THE-FOLD CREDENTIAL HUB TABS ================= */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="neu-inset p-1.5 rounded-xl mb-4 grid grid-cols-3 gap-1.5">
              {[
                { value: 'overview', icon: User, label: 'Overview' },
                { value: 'specializations', icon: Award, label: `Services (${profile.services.length})` },
                { value: 'trust', icon: Shield, label: 'Trust Score' },
              ].map(tab => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all truncate cursor-pointer select-none ${
                    activeTab === tab.value
                      ? 'bg-primary text-white font-black shadow-sm'
                      : 'text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <tab.icon className={`w-3.5 h-3.5 shrink-0 ${activeTab === tab.value ? 'text-white' : 'text-tertiary'}`} />
                  <span className="truncate">{tab.label}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Overview Tab: 2-Group Credential Hub (Read Mode) or Structured Form (Edit Mode) */}
            <Tabs.Content value="overview" className="outline-none">
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10">
                <div className="p-4 sm:p-6 border-b border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Professional Details</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs sm:text-sm mt-0.5">
                      Your contact coverage and PRC credentials displayed during patient booking
                    </p>
                  </div>
                  {!editingOverview ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { setEditingOverview(true); setEditForm(profile); setLanguagesInput((profile.languages || []).join(', ')); }}
                      className="neu-btn px-4 py-2 rounded-xl font-black text-xs text-link flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </motion.button>
                  ) : (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setEditingOverview(false); setEditForm(profile); setLanguagesInput((profile.languages || []).join(', ')); }}
                        className="neu-btn px-3.5 py-2 rounded-xl font-bold text-xs text-tertiary hover:text-slate-700 cursor-pointer flex-1 sm:flex-initial"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSaveOverview}
                        disabled={saving}
                        className="neu-btn-primary px-4 py-2 rounded-xl font-black text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                      </motion.button>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {!editingOverview ? (
                    /* Option 1: 2 Structured Credential Cards (Zero Fake Disabled Inputs) */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Group 1: Contact & Coverage */}
                      <div className="neu-flat-sm p-4 rounded-xl border border-slate-200/80 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-link">
                            Contact &amp; Coverage
                          </span>
                          <span className="text-3xs font-bold uppercase tracking-wider text-tertiary">
                            Booking Info
                          </span>
                        </div>
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary flex items-center gap-1.5 shrink-0">
                              <Phone className="w-3.5 h-3.5 text-link" />
                              <span>Phone</span>
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-right">
                              {profile.phone || 'Not provided'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary flex items-center gap-1.5 shrink-0">
                              <Mail className="w-3.5 h-3.5 text-link" />
                              <span>Email</span>
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate text-right">
                              {profile.email}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary flex items-center gap-1.5 shrink-0 pt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-link" />
                              <span>Location</span>
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-right break-words">
                              {profile.location || 'No location set'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-1">
                            <span className="text-2xs font-extrabold uppercase text-tertiary shrink-0">
                              Service Radius
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-right">
                              {profile.service_radius_km ? `${profile.service_radius_km} km` : 'Not provided'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Group 2: PRC & Professional Credentials */}
                      <div className="neu-flat-sm p-4 rounded-xl border border-slate-200/80 dark:border-white/10 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            PRC &amp; Credentials
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                            profile.professional_id_status === 'verified'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200/70 dark:bg-slate-800 border-slate-300/80 dark:border-white/10 text-tertiary'
                          }`}>
                            {profile.professional_id_status === 'verified' ? 'ID Verified' : 'Standard'}
                          </span>
                        </div>
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary shrink-0">
                              PRC / License No.
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-right">
                              {profile.license_number || 'Not provided'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary shrink-0">
                              License Expiry
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-right">
                              {profile.license_expiry || 'Not provided'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/40 dark:border-white/5">
                            <span className="text-2xs font-extrabold uppercase text-tertiary shrink-0">
                              Languages
                            </span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {(profile.languages || []).length > 0 ? (
                                profile.languages.map((lang, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md neu-inset text-2xs font-bold text-slate-700 dark:text-slate-200"
                                  >
                                    {lang}
                                  </span>
                                ))
                              ) : (
                                <span className="font-semibold text-tertiary">Not provided</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-3 py-1">
                            <span className="text-2xs font-extrabold uppercase text-tertiary shrink-0 pt-0.5">
                              Bio / Title
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-right break-words">
                              {profile.bio || 'No bio provided'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode Form */
                    <div className="space-y-4 sm:space-y-5">
                      <div>
                        <label htmlFor="provider-bio" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Bio / Professional Title</label>
                        <input
                          id="provider-bio"
                          type="text"
                          name="bio"
                          value={editForm.bio}
                          onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                          placeholder="E.g. Registered Nurse • Wound Care Specialist"
                          className="w-full neu-inset rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
                        <div>
                          <label htmlFor="provider-phone" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Phone Number</label>
                          <div className="relative flex items-center">
                            <input
                              id="provider-phone"
                              type="text"
                              name="phone"
                              value={editForm.phone}
                              onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                              placeholder="+63 912 345 6789"
                              className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-10 pr-3.5 sm:pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                            />
                            <Phone className="absolute left-3.5 w-4 h-4 text-primary z-10 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="provider-location" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Service Location / Area</label>
                          <div className="relative flex items-center">
                            <input
                              id="provider-location"
                              type="text"
                              name="location"
                              value={editForm.location}
                              onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                              placeholder="e.g. Poblacion, Muntinlupa"
                              className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-10 pr-3.5 sm:pr-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                            />
                            <MapPin className="absolute left-3.5 w-4 h-4 text-primary z-10 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <p className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5">Email (Read Only)</p>
                          <div className="neu-inset p-2.5 sm:p-3 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                            <Mail className="w-4 h-4 text-tertiary shrink-0" />
                            <span className="truncate">{profile.email}</span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="provider-service-radius" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Service Radius</label>
                          <div className="relative flex items-center">
                            <input
                              id="provider-service-radius"
                              type="number"
                              name="service_radius_km"
                              inputMode="numeric"
                              min="1"
                              max="100"
                              aria-describedby="provider-service-radius-unit"
                              value={editForm.service_radius_km ?? ''}
                              onChange={e => setEditForm({ ...editForm, service_radius_km: e.target.value })}
                              placeholder="15"
                              className="w-full neu-inset rounded-xl py-2.5 sm:py-3 pl-3.5 sm:pl-4 pr-11 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                            />
                            <span id="provider-service-radius-unit" className="absolute right-3.5 z-10 text-xs font-extrabold text-tertiary pointer-events-none">km</span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="provider-license-number" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">PRC / License Number</label>
                          <input
                            id="provider-license-number"
                            type="text"
                            name="license_number"
                            value={editForm.license_number || ''}
                            onChange={e => setEditForm({ ...editForm, license_number: e.target.value })}
                            placeholder="PRC-0123456"
                            className="w-full neu-inset rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                          />
                        </div>

                        <div>
                          <label htmlFor="provider-license-expiry" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">License Expiry</label>
                          <input
                            id="provider-license-expiry"
                            type="date"
                            name="license_expiry"
                            value={editForm.license_expiry || ''}
                            onChange={e => setEditForm({ ...editForm, license_expiry: e.target.value })}
                            className="w-full neu-inset rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="provider-languages" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Languages</label>
                          <input
                            id="provider-languages"
                            type="text"
                            name="languages"
                            value={languagesInput}
                            onChange={e => setLanguagesInput(e.target.value)}
                            placeholder="English, Filipino"
                            className="w-full neu-inset rounded-xl py-2.5 sm:py-3 px-3.5 sm:px-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Content>

            {/* Specializations Tab */}
            <Tabs.Content value="specializations" className="outline-none">
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10">
                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Specializations &amp; Services</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">List of medical and healthcare services you deliver</p>
                  </div>
                  {!editingSpecializations ? (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setEditingSpecializations(true)}
                      className="neu-btn px-4 py-2 rounded-xl font-black text-xs text-link flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Edit Specializations</span>
                    </motion.button>
                  ) : (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setEditingSpecializations(false); setServicesInput((profile.services || []).join(', ')); }}
                        className="neu-btn px-3 sm:px-4 py-2 rounded-xl font-bold text-xs text-tertiary hover:text-slate-700 cursor-pointer flex-1 sm:flex-initial"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={handleSaveSpecializations}
                        disabled={saving}
                        className="neu-btn-primary px-4 py-2 rounded-xl font-black text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save'}</span>
                      </motion.button>
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {editingSpecializations ? (
                    <div className="space-y-3.5 sm:space-y-4">
                      <div>
                        <label htmlFor="provider-services" className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-1.5 block">Comma-Separated Services</label>
                        <textarea
                          id="provider-services"
                          name="services"
                          value={servicesInput}
                          onChange={e => setServicesInput(e.target.value)}
                          placeholder="Wound Care, Post-Surgery Recovery, Elderly Care"
                          className="w-full h-24 sm:h-28 neu-inset rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all"
                        />
                      </div>

                      <div>
                        <p className="text-2xs uppercase font-extrabold text-tertiary dark:text-tertiary mb-2">Suggested Services to Add:</p>
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
                                className="neu-btn px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold text-link cursor-pointer active:scale-95"
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
                            className="neu-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold text-link shadow-xs"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 + i * 0.04 }}
                          >
                            {s}
                          </motion.span>
                        ))
                      ) : (
                        <div className="neu-inset p-3.5 sm:p-4 rounded-xl text-center w-full">
                          <p className="text-tertiary dark:text-tertiary text-xs sm:text-sm">
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
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10">
                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-white/5">
                  <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-slate-100">Trust Score Breakdown</h3>
                  <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">Calculated based on credentials, verification status, and profile completion</p>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="neu-inset p-3.5 sm:p-5 rounded-2xl space-y-2.5 sm:space-y-3">
                    {[
                      { label: 'Profile Completed', met: profile.is_profile_complete, points: 20 },
                      { label: 'PRC / Medical ID Verified', met: profile.professional_id_status === 'verified', points: 30 },
                      { label: 'Approved by City Health Office', met: profile.is_approved, points: 30 },
                      { label: 'Patient Rating 4.0 or Higher', met: profile.rating >= 4.0, points: 20 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-200/40 dark:border-white/5 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${item.met ? 'bg-emerald-500 text-white shadow-xs' : 'neu-pressed text-tertiary'}`}>
                            {item.met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-3xs font-black">-</span>}
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-2xs font-black ${
                          item.met ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'text-tertiary'
                        }`}>
                          +{item.points} pts
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 neu-flat-sm p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 block">Total Calculated Score</span>
                      <span className="text-2xs uppercase tracking-wider font-bold text-tertiary">Level: {trustLevel.label}</span>
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
    </DashboardLayout>
  );
};

export default ProviderProfile;
