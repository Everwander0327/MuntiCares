import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Camera, Mail, Phone, MapPin, Award, BookOpen, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ProviderProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const { user } = useAuth();
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    services: [],
    price_per_service: 0,
    is_profile_complete: false,
    is_approved: false
  });

  const [editForm, setEditForm] = useState({ ...profile });
  const [servicesInput, setServicesInput] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email')
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
          is_approved: provData.is_approved
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
    // Validation: prevent empty profiles
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

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="provider">
      <motion.div 
        className="max-w-4xl space-y-8"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {!profile.is_profile_complete && (
          <motion.div 
            className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl flex items-center gap-3"
            variants={staggerItem}
          >
            <Award className="w-5 h-5 text-yellow-600" />
            <p className="text-sm font-medium">Your profile is incomplete. Please fill out your details so you can be approved by an Admin and become visible to patients.</p>
          </motion.div>
        )}

        {profile.is_profile_complete && !profile.is_approved && (
          <motion.div 
            className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl flex items-center gap-3"
            variants={staggerItem}
          >
            <Clock className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium">Your profile is currently under review. You will be visible to patients once approved by an Admin.</p>
          </motion.div>
        )}

        <motion.div 
          className="flex flex-col md:flex-row items-start gap-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"
          variants={staggerItem}
        >
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] bg-blue-100 flex items-center justify-center text-4xl font-bold text-primary shadow-inner">
              {profile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
            </div>
            <motion.button 
              className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl shadow-lg transition-transform"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Camera className="w-5 h-5" />
            </motion.button>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{profile.full_name}</h1>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.bio}
                  onChange={e => setEditForm({...editForm, bio: e.target.value})}
                  placeholder="E.g. Registered Nurse • Wound Care Specialist"
                  className="mt-2 w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-primary"
                />
              ) : (
                <p className="text-primary font-semibold mt-1">{profile.bio || 'No bio provided'}</p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.location}
                    onChange={e => setEditForm({...editForm, location: e.target.value})}
                    placeholder="Location"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary"
                  />
                ) : (
                  <span>{profile.location || 'No location set'}</span>
                )}
              </div>
            </div>
          </div>
          
          <motion.button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={saving}
            className={`px-8 py-3 rounded-2xl font-bold text-white shadow-lg transition-all ${isEditing ? 'bg-green-500 shadow-green-500/20' : 'btn-primary shadow-primary/20'}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {saving ? 'Saving...' : isEditing ? 'Save Profile' : 'Edit Profile'}
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div 
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
            variants={staggerItem}
          >
            <h3 className="text-xl font-bold text-slate-900 border-b pb-4">Contact & Rates</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <Mail className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase">Email (Read Only)</p>
                  <p className="text-slate-700 font-medium">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <Phone className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase">Phone Number</p>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editForm.phone}
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                      placeholder="+63 912 345 6789"
                      className="mt-1 w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary text-sm"
                    />
                  ) : (
                    <p className="text-slate-700 font-medium">{profile.phone || 'Not provided'}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <BookOpen className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase">Rate per Service (₱)</p>
                  {isEditing ? (
                    <input 
                      type="number" 
                      value={editForm.price_per_service}
                      onChange={e => setEditForm({...editForm, price_per_service: e.target.value})}
                      placeholder="e.g. 1500"
                      className="mt-1 w-full text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary text-sm"
                    />
                  ) : (
                    <p className="text-slate-700 font-medium">₱{profile.price_per_service || '0.00'}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6"
            variants={staggerItem}
          >
            <h3 className="text-xl font-bold text-slate-900 border-b pb-4">Specializations</h3>
            {isEditing ? (
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Comma separated services</p>
                <textarea 
                  value={servicesInput}
                  onChange={e => setServicesInput(e.target.value)}
                  placeholder="Wound Care, Post-Surgery Recovery, Elderly Care"
                  className="w-full h-32 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary text-sm resize-none"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.services.length > 0 ? (
                  profile.services.map((s, i) => (
                    <motion.span 
                      key={i} 
                      className="px-4 py-2 bg-blue-50 text-primary rounded-xl text-sm font-bold border border-blue-100"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                    >
                      {s}
                    </motion.span>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No specializations added.</p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
};

export default ProviderProfile;
