import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Camera, Mail, Phone, MapPin, Award, BookOpen, Clock, LogOut, Calendar, CheckCircle2, ShieldCheck, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';

const ProviderProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
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
    created_at: ''
  });

  const [editForm, setEditForm] = useState({ ...profile });
  const [servicesInput, setServicesInput] = useState('');

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
          created_at: userData.created_at
        };

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

  const handleSave = async () => {
    const servicesList = servicesInput.split(',').map(s => s.trim()).filter(s => s);
    
    if (!editForm.phone.trim() || !editForm.location.trim() || !editForm.bio.trim() || servicesList.length === 0) {
      alert('Please fill out all fields (Phone, Location, Bio, and at least one Specialization) to complete your profile.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({
          phone: editForm.phone,
          location: editForm.location,
          bio: editForm.bio,
          services: servicesList,
          price_per_service: editForm.price_per_service,
          is_profile_complete: true
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setProfile({
        ...editForm,
        services: servicesList,
        is_profile_complete: true
      });
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
                <div className="relative inline-block">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white dark:bg-slate-800 border-4 border-white shadow-lg flex items-center justify-center text-3xl md:text-4xl font-bold text-primary mx-auto bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800"
                  >
                    {profile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                  </div>
                  <button className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-white rounded-lg shadow-md hover:bg-primary/90 transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{profile.full_name}</h2>
                <p className="text-primary text-sm font-semibold mt-1">{profile.bio || 'No bio provided'}</p>
                
                <div className="flex items-center justify-center flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] uppercase tracking-widest rounded-full border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/50">
                    Healthcare Provider
                  </span>
                  {profile.is_approved ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 font-bold text-[10px] uppercase tracking-widest rounded-full border border-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50">
                      <ShieldCheck className="w-3 h-3" /> Approved
                    </span>
                  ) : profile.is_profile_complete ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 font-bold text-[10px] uppercase tracking-widest rounded-full border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50">
                      <Clock className="w-3 h-3" /> Under Review
                    </span>
                  ) : null}
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
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm dark:bg-red-900/30 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column — Details */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {/* Contact & Rates */}
            <motion.div 
              className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden dark:bg-slate-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Contact & Rates</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your professional info visible to patients</p>
                </div>
                <motion.button 
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  disabled={saving}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all w-full sm:w-auto ${isEditing ? 'bg-green-500 text-white shadow-green-200 hover:bg-green-600' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Edit Profile'}
                </motion.button>
              </div>

              <div className="p-6 md:p-8 space-y-5">
                {/* Bio */}
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Bio / Title</p>
                  {isEditing ? (
                    <input 
                      type="text" 
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
                  {/* Phone */}
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Phone Number</p>
                    {isEditing ? (
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input 
                          type="text" 
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

                  {/* Location */}
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Location</p>
                    {isEditing ? (
                      <div className="relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input 
                          type="text" 
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

                  {/* Rate */}
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Rate per Service (₱)</p>
                    {isEditing ? (
                      <div className="relative group">
                        <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" />
                        <input 
                          type="number" 
                          value={editForm.price_per_service}
                          onChange={e => setEditForm({...editForm, price_per_service: e.target.value})}
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

                  {/* Email */}
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-2">Email (Read Only)</p>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                      <p className="text-slate-700 dark:text-slate-200 font-medium truncate">{profile.email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Specializations */}
            <motion.div 
              className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden dark:bg-slate-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Specializations</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Services you offer to patients</p>
              </div>
              <div className="p-6 md:p-8">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase mb-2">Comma separated services</p>
                      <textarea 
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
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No specializations added yet. Click "Edit Profile" to add your services.</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderProfile;
