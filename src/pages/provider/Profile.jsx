import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Mail, Phone, MapPin, Award, BookOpen, Clock, LogOut, Calendar, CheckCircle2, ShieldCheck, Save, Upload, ExternalLink, Shield, FileText, X, User, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const PROFESSIONAL_ID_BUCKET = 'provider-docs';

const getProfessionalIdUrl = (filePath) => {
  if (!filePath) return null;
  const { data } = supabase.storage.from(PROFESSIONAL_ID_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || null;
};
import { SkeletonPage } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ProfilePhotoUpload from '../../components/ProfilePhotoUpload';

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
  const [uploading, setUploading] = useState(false);
  const [professionalIdPreviews, setProfessionalIdPreviews] = useState([]);
  const fileInputRef = useRef(null);

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

        const paths = (provData.professional_id_paths && provData.professional_id_paths.length > 0)
          ? provData.professional_id_paths
          : (provData.professional_id_path ? [provData.professional_id_path] : []);
        setProfessionalIdPreviews(paths.map(p => getProfessionalIdUrl(p)).filter(Boolean));
        if (paths.length > 0 && (!provData.professional_id_paths || provData.professional_id_paths.length === 0)) {
          supabase.from('providers').update({ professional_id_paths: paths }).eq('user_id', user.id);
        }
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

  const handleProfessionalIdUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    for (const f of files) {
      if (!allowed.includes(f.type)) {
        toast.error(`"${f.name}" has an unsupported file type. Please use JPG, PNG, or PDF.`);
        e.target.value = '';
        return;
      }
      if (f.size > 2 * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds the 2MB limit.`);
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    try {
      const newPaths = [...(profile.professional_id_paths || [])];

      for (const file of files) {
        const ext = file.name.split('.').pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const filePath = `${user.id}/${uniqueName}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('provider-docs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        newPaths.push(filePath);
      }

      const newScore = calculateTrustScore({
        ...profile,
        professional_id_paths: newPaths,
        professional_id_path: newPaths[0] || null,
      });

      const { error: updateError } = await supabase
        .from('providers')
        .update({ professional_id_paths: newPaths, professional_id_path: newPaths[0] || null, professional_id_status: 'pending', trust_score: newScore })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfessionalIdPreviews(newPaths.map(p => getProfessionalIdUrl(p)).filter(Boolean));
      setProfile(prev => ({ ...prev, professional_id_paths: newPaths, professional_id_path: newPaths[0] || null, professional_id_status: 'pending', trust_score: newScore }));
      toast.success('Professional ID uploaded successfully! It will be reviewed by an admin.');
    } catch (err) {
      console.error('Error uploading professional ID:', err);
      toast.error('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveProfessionalId = async () => {
    const allPaths = profile.professional_id_paths || [];
    if (allPaths.length === 0 && !profile.professional_id_path) return;

    try {
      await supabase.storage
        .from('provider-docs')
        .remove(allPaths);

      const newScore = calculateTrustScore({ ...profile, professional_id_paths: [], professional_id_path: null });

      const { error } = await supabase
        .from('providers')
        .update({ professional_id_paths: [], professional_id_path: null, professional_id_status: 'none', trust_score: newScore })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfessionalIdPreviews([]);
      setProfile(prev => ({ ...prev, professional_id_paths: [], professional_id_path: null, professional_id_status: 'none', trust_score: newScore }));
      toast.success('Professional ID removed.');
    } catch (err) {
      console.error('Error removing professional ID:', err);
      toast.error('Failed to remove. Please try again.');
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
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Status Alerts */}
        {!profile.is_profile_complete && (
          <motion.div 
            className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 text-yellow-800 p-4 md:p-5 rounded-2xl flex items-start gap-3 dark:from-yellow-900/30 dark:to-orange-900/30 dark:border-yellow-900/50 dark:text-yellow-200"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Award className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">Your profile is incomplete. Please fill out your details so you can be approved by an Admin and become visible to patients.</p>
          </motion.div>
        )}

        {profile.is_profile_complete && !profile.is_approved && (
          <motion.div 
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-800 p-4 md:p-5 rounded-2xl flex items-start gap-3 dark:from-blue-900/30 dark:to-indigo-900/30 dark:border-blue-900/50 dark:text-blue-200"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">Your profile is currently under review. You will be visible to patients once approved by an Admin.</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden dark:bg-slate-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Gradient Banner */}
              <div className="h-28 md:h-32 bg-gradient-to-br from-primary via-blue-500 to-blue-400 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
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
                <p className="text-primary text-sm font-semibold mt-1">{profile.bio || 'No bio provided'}</p>

                <div className="flex items-center justify-center flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 font-bold text-2xs uppercase tracking-widest rounded-full border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/50">
                    Healthcare Provider
                  </span>
                  {profile.is_approved ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 font-bold text-2xs uppercase tracking-widest rounded-full border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50">
                      <ShieldCheck className="w-3 h-3" /> Approved
                    </span>
                  ) : profile.is_profile_complete ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 font-bold text-2xs uppercase tracking-widest rounded-full border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50">
                      <Clock className="w-3 h-3" /> Under Review
                    </span>
                  ) : null}
                </div>

                {/* Trust Score Badge */}
                <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${trustLevel.bg} ${trustLevel.border} border`}>
                  <Shield className={`w-4 h-4 ${trustLevel.color}`} />
                  <span className={`text-sm font-bold ${trustLevel.color}`}>Trust Score: {profile.trust_score}/100</span>
                </div>

                {/* Quick Info */}
                <div className="mt-6 space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span className="truncate">{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>{profile.location || 'No location set'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>

                {/* Logout — very bottom */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all text-sm dark:bg-red-900/30 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
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
                  {[
                    { value: 'overview', icon: User, label: 'Overview' },
                    { value: 'specializations', icon: Award, label: 'Specializations' },
                    { value: 'documents', icon: FolderOpen, label: 'Documents' },
                    { value: 'trust', icon: Shield, label: 'Trust' },
                  ].map(tab => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-xl text-2xs md:text-sm font-medium transition-all whitespace-nowrap flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400`}
                    >
                      <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === tab.value ? 'text-primary' : ''}`} />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Content value="overview" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Contact & Rates</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your professional info visible to patients</p>
                      </div>
                      {!editingOverview ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setEditingOverview(true); setEditForm(profile); }}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all w-full sm:w-auto"
                        >
                          <Save className="w-4 h-4" />
                          Edit Profile
                        </motion.button>
                      ) : (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { setEditingOverview(false); setEditForm(profile); }}
                            className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleSaveOverview}
                            disabled={saving}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 transition-all disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                          </motion.button>
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8 space-y-5">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Bio / Title</p>
                        {editingOverview ? (
                          <input
                            type="text" name="bio"
                            value={editForm.bio}
                            onChange={e => setEditForm({...editForm, bio: e.target.value})}
                            placeholder="E.g. Registered Nurse • Wound Care Specialist"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl py-3 px-4 outline-none focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                          />
                        ) : (
                          <p className="text-slate-700 dark:text-slate-200 font-medium">{profile.bio || 'No bio provided'}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Phone Number</p>
                          {editingOverview ? (
                            <div className="relative group">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                              <input
                                type="text" name="phone"
                                value={editForm.phone}
                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                placeholder="+63 912 345 6789"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                              <p className="text-slate-700 dark:text-slate-200 font-medium">{profile.phone || 'Not provided'}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Location</p>
                          {editingOverview ? (
                            <div className="relative group">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                              <input
                                type="text" name="location"
                                value={editForm.location}
                                onChange={e => setEditForm({...editForm, location: e.target.value})}
                                placeholder="Location"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                              <p className="text-slate-700 dark:text-slate-200 font-medium">{profile.location || 'No location set'}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Rate per Service (₱)</p>
                          {editingOverview ? (
                            <div className="relative group">
                              <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                              <input
                                type="number" name="price_per_service"
                                value={editForm.price_per_service}
                                onChange={e => setEditForm({...editForm, price_per_service: Number(e.target.value)})}
                                placeholder="e.g. 1500"
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl py-3 pl-11 pr-4 outline-none focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                              <p className="text-slate-700 dark:text-slate-200 font-medium">₱{profile.price_per_service || '0.00'}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Email (Read Only)</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium truncate">{profile.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Specializations Tab */}
                <Tabs.Content value="specializations" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Specializations</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Services you offer to patients</p>
                      </div>
                      {!editingSpecializations ? (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setEditingSpecializations(true)}
                          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all w-full sm:w-auto"
                        >
                          <Save className="w-4 h-4" />
                          Edit Specializations
                        </motion.button>
                      ) : (
                        <div className="flex gap-2 w-full sm:w-auto">
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => { setEditingSpecializations(false); setServicesInput((profile.services || []).join(', ')); }}
                            className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                          >
                            Cancel
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleSaveSpecializations}
                            disabled={saving}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 transition-all disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save'}
                          </motion.button>
                        </div>
                      )}
                    </div>
                    <div className="p-6 md:p-8">
                      {editingSpecializations ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mb-2">Comma separated services</p>
                            <textarea
                              name="services"
                              value={servicesInput}
                              onChange={e => setServicesInput(e.target.value)}
                              placeholder="Wound Care, Post-Surgery Recovery, Elderly Care"
                              className="w-full h-28 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-primary focus:bg-white focus:dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 text-sm resize-none transition-all"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Suggested Services to Add:</p>
                            <div className="flex flex-wrap gap-2">
                              {['Wound Care', 'Elderly Care', 'Post-Surgery Recovery', 'Physical Therapy', 'Vital Signs Monitoring', 'Medication Administration', 'Dementia Care', 'Stroke Rehab']
                                .filter(s => !(servicesInput || '').toLowerCase().includes(s.toLowerCase()))
                                .map(s => (
                                  <motion.button
                                    key={s}
                                    type="button"
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      const curr = (servicesInput || '').trim();
                                      const newServices = curr ? `${curr.replace(/,\s*$/, '')}, ${s}` : s;
                                      setServicesInput(newServices);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary rounded-lg text-xs font-bold border border-blue-100 transition-colors dark:bg-blue-900/30 dark:hover:bg-blue-900/20 dark:border-blue-900/50"
                                  >
                                    + {s}
                                  </motion.button>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {profile.services.length > 0 ? (
                            profile.services.map((s, i) => (
                              <motion.span
                                key={i}
                                className="px-4 py-2 bg-blue-50 text-primary rounded-xl text-sm font-bold border border-blue-100 dark:bg-blue-900/30 dark:border-blue-900/50"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 + i * 0.08 }}
                              >
                                {s}
                              </motion.span>
                            ))
                          ) : (
                            <p className="text-slate-500 dark:text-slate-400 text-sm">No specializations added yet. Click {'\u201C'}Edit Specializations{'\u201D'} to add your services.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Documents Tab */}
                <Tabs.Content value="documents" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Professional ID / License</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Upload your professional documents for verification</p>
                    </div>
                    <div className="p-6 md:p-8">
                      {(profile.professional_id_paths?.length > 0 || profile.professional_id_path) ? (
                        <div className="space-y-3">
                          {profile.professional_id_status === 'rejected' && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-medium text-red-700 dark:text-red-300">
                              <X className="w-4 h-4 shrink-0" />
                              Your ID was not approved. Please upload a valid professional ID.
                            </div>
                          )}
                          {professionalIdPreviews.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {professionalIdPreviews.map((url, i) => (
                                <div key={i} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-1">
                                  {url.endsWith('.pdf') ? (
                                    <div className="flex items-center gap-2 p-2">
                                      <FileText className="w-5 h-5 text-primary shrink-0" />
                                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">Document {i + 1}</span>
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
                                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                      </a>
                                    </div>
                                  ) : (
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                      <img src={url} alt={`Professional ID ${i + 1}`} className="w-full h-28 object-contain rounded-lg" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading}
                              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                            >
                              <Upload className="w-4 h-4" />
                              {uploading ? 'Uploading...' : 'Add More'}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              onClick={handleRemoveProfessionalId}
                              disabled={uploading}
                              className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                            >
                              Remove All
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-6 text-center hover:border-primary transition-colors">
                          <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Upload your Professional ID</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Accepted: JPG, PNG, or PDF (max 2MB each)</p>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                          >
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Uploading...' : 'Choose Files'}
                          </motion.button>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file" name="professional_id"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={handleProfessionalIdUpload}
                        hidden
                        multiple
                        disabled={uploading}
                      />
                    </div>
                  </div>
                </Tabs.Content>

                {/* Trust Tab */}
                <Tabs.Content value="trust" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Trust Score Breakdown</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">How your trust score is calculated</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="space-y-2">
                        {[
                          { label: 'Profile completed', met: profile.is_profile_complete, points: 20 },
                          { label: 'Professional ID verified', met: profile.professional_id_status === 'verified', points: 30 },
                          { label: 'Approved by admin', met: profile.is_approved, points: 30 },
                          { label: 'Rating 4.0 or higher', met: profile.rating >= 4.0, points: 20 },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.met ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                {item.met && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                            </div>
                            <span className={`text-xs font-bold ${item.met ? 'text-green-600 dark:text-green-300' : 'text-slate-400 dark:text-slate-500'}`}>+{item.points}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 dark:border-slate-700">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total Trust Score</span>
                          <span className={`text-lg font-bold ${trustLevel.color}`}>{profile.trust_score}/100</span>
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
