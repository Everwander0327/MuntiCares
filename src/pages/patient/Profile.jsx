import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Phone, MapPin, Activity, HeartPulse, LogOut, Save, Mail, Calendar, CheckCircle2, Upload, FileText, X, Loader2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { getSignedUrl } from '../../lib/supabaseHelpers';

const PatientProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [visitNotes, setVisitNotes] = useState([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    medical_notes: '',
    emergency_contact: '',
    is_profile_complete: false,
    created_at: ''
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

        const { data: patData, error: patError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (patError && patError.code !== 'PGRST116') {
          throw patError;
        }

        setProfile({
          full_name: userData.full_name,
          email: userData.email,
          phone: patData?.phone || '',
          address: patData?.address || '',
          medical_notes: patData?.medical_notes || '',
          emergency_contact: patData?.emergency_contact || '',
          is_profile_complete: patData?.is_profile_complete || false,
          created_at: userData.created_at
        });

        // Fetch Documents
        const { data: docs, error: docsError } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', user.id)
          .order('uploaded_at', { ascending: false });
          
        if (!docsError && docs) {
          setDocuments(docs);
        }

        // Fetch Visit Notes
        const { data: notes, error: notesError } = await supabase
          .from('visit_notes')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (!notesError && notes) {
          setVisitNotes(notes);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .upsert({
          user_id: user.id,
          phone: profile.phone,
          address: profile.address,
          medical_notes: profile.medical_notes,
          emergency_contact: profile.emergency_contact,
          is_profile_complete: true
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setProfile(prev => ({ ...prev, is_profile_complete: true }));
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 500KB Limit Check
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large! Limit is 500KB lang po.");
      event.target.value = ''; // Reset input
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('medical_documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save to Database
      const { error: dbError } = await supabase
        .from('patient_documents')
        .insert([{
          patient_id: user.id,
          document_title: file.name,
          file_path: filePath
        }]);

      if (dbError) throw dbError;

      // Refresh documents
      const { data: docs } = await supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', user.id)
        .order('uploaded_at', { ascending: false });
      if (docs) setDocuments(docs);
      
      toast.success('Document uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload document.');
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  // Calculate completion
  const fields = [profile.phone, profile.address, profile.emergency_contact];
  const filled = fields.filter(f => f && f.trim() !== '').length;
  const completionPercent = Math.round((filled / fields.length) * 100);

  // PDF Generation
  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      // Fetch medical history
      const { data: histData } = await supabase
        .from('medical_histories')
        .select('*')
        .eq('patient_id', user.id)
        .maybeSingle();

      // Fetch visit notes
      const { data: notesData } = await supabase
        .from('visit_notes')
        .select('*, provider:provider_id(full_name)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      const checkPage = (needed = 20) => {
        if (y + needed > 275) {
          doc.addPage();
          y = 20;
        }
      };

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('MuntiCares - Medical Summary', 14, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 23);
      doc.text('CONFIDENTIAL - For authorized use only', 14, 29);

      y = 45;
      doc.setTextColor(30, 41, 59);

      // Patient Info
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Information', 14, y);
      y += 2;
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.5);
      doc.line(14, y, pageWidth - 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const info = [
        ['Full Name', profile.full_name],
        ['Email', profile.email],
        ['Phone', profile.phone || 'Not provided'],
        ['Address', profile.address || 'Not provided'],
        ['Emergency Contact', profile.emergency_contact || 'Not provided'],
      ];
      info.forEach(([label, val]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(val, 55, y);
        y += 6;
      });

      // Medical Notes
      y += 6;
      checkPage(30);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Medical Notes', 14, y);
      y += 2;
      doc.line(14, y, pageWidth - 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const notes = profile.medical_notes || 'No medical notes provided.';
      const splitNotes = doc.splitTextToSize(notes, pageWidth - 28);
      doc.text(splitNotes, 14, y);
      y += splitNotes.length * 5 + 4;

      // Medical History
      if (histData) {
        y += 4;
        checkPage(40);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Medical History', 14, y);
        y += 2;
        doc.line(14, y, pageWidth - 14, y);
        y += 8;
        doc.setFontSize(10);

        const histItems = [
          ['Allergies', histData.allergies || 'None reported'],
          ['Chronic Conditions', histData.chronic_conditions || 'None reported'],
          ['Past Surgeries', histData.past_surgeries || 'None reported'],
        ];
        histItems.forEach(([label, val]) => {
          checkPage(15);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(220, 38, 38);
          if (label !== 'Allergies') doc.setTextColor(30, 41, 59);
          doc.text(`${label}:`, 14, y);
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'normal');
          const splitVal = doc.splitTextToSize(val, pageWidth - 60);
          doc.text(splitVal, 55, y);
          y += splitVal.length * 5 + 4;
        });
      }

      // Uploaded Documents
      if (documents.length > 0) {
        y += 4;
        checkPage(30);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Uploaded Documents', 14, y);
        y += 2;
        doc.line(14, y, pageWidth - 14, y);
        y += 8;
        doc.setFontSize(10);

        for (let i = 0; i < documents.length; i++) {
          const d = documents[i];
          const ext = d.document_title.split('.').pop().toLowerCase();
          const isImage = ['jpg', 'jpeg', 'png'].includes(ext);
          const publicUrl = await getSignedUrl(d.file_path, 3600);

          checkPage(isImage ? 80 : 14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`${i + 1}. ${d.document_title} (${new Date(d.uploaded_at).toLocaleDateString()})`, 14, y);
          y += 6;

          if (isImage && publicUrl) {
            try {
              const response = await fetch(publicUrl);
              const blob = await response.blob();
              const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });

              const imgFormat = ext === 'png' ? 'PNG' : 'JPEG';
              const maxW = pageWidth - 28;
              const maxH = 60;
              doc.addImage(base64, imgFormat, 14, y, maxW, maxH, undefined, 'MEDIUM');
              y += maxH + 6;
              } catch (imgErr) {
               console.warn('Could not embed image:', imgErr);
               doc.setFont('helvetica', 'normal');
               doc.setTextColor(37, 99, 235);
                if (publicUrl) doc.textWithLink('    ↳ View/Download File', 14, y, { url: publicUrl });
               doc.setTextColor(30, 41, 59);
               y += 7;
             }
           } else if (publicUrl) {
             doc.setFont('helvetica', 'normal');
             doc.setTextColor(37, 99, 235);
             doc.textWithLink('    ↳ View/Download File', 14, y, { url: publicUrl });
             doc.setTextColor(30, 41, 59);
             y += 7;
           }
        }
      }

      // Visit Notes
      if (notesData && notesData.length > 0) {
        y += 4;
        checkPage(30);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Visit History', 14, y);
        y += 2;
        doc.line(14, y, pageWidth - 14, y);
        y += 8;

        for (let i = 0; i < notesData.length; i++) {
          const note = notesData[i];
          checkPage(40);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`Visit #${i + 1} — ${new Date(note.created_at).toLocaleDateString()} by Dr. ${note.provider?.full_name || 'Provider'}`, 14, y);
          y += 6;
          doc.setFont('helvetica', 'normal');
          const vitals = [
            note.vitals_bp && `BP: ${note.vitals_bp}`,
            note.vitals_temp && `Temp: ${note.vitals_temp}°C`,
            note.vitals_hr && `HR: ${note.vitals_hr}`,
            note.vitals_spo2 && `SpO2: ${note.vitals_spo2}%`,
            note.pain_scale != null && `Pain: ${note.pain_scale}/10`,
          ].filter(Boolean).join('  |  ');
          if (vitals) {
            doc.text(`Vitals: ${vitals}`, 14, y);
            y += 5;
          }
          if (note.services_rendered) {
            doc.text(`Services: ${note.services_rendered}`, 14, y);
            y += 5;
          }
          if (note.notes) {
            const splitN = doc.splitTextToSize(`Notes: ${note.notes}`, pageWidth - 28);
            doc.text(splitN, 14, y);
            y += splitN.length * 5;
          }

          if (note.attachment_url) {
              const publicUrl = await getSignedUrl(note.attachment_url, 3600);
             const ext = note.attachment_url.split('.').pop().toLowerCase();
             const isImage = ['jpg', 'jpeg', 'png'].includes(ext);

             if (isImage && publicUrl) {
                try {
                  checkPage(65);
                  const response = await fetch(publicUrl);
                  const blob = await response.blob();
                  const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                  });

                  doc.setFont('helvetica', 'italic');
                  doc.text('Attached Image:', 14, y);
                  y += 4;
                  
                  const imgFormat = ext === 'png' ? 'PNG' : 'JPEG';
                  const maxW = pageWidth - 28;
                  const maxH = 60;
                  doc.addImage(base64, imgFormat, 14, y, maxW, maxH, undefined, 'MEDIUM');
                  y += maxH;
                   } catch (imgErr) {
                    console.warn('Could not embed note attachment:', imgErr);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(37, 99, 235);
                    if (publicUrl) doc.textWithLink('↳ View Attached File', 14, y, { url: publicUrl });
                    doc.setTextColor(30, 41, 59);
                  }
               } else if (publicUrl) {
                  checkPage(10);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(37, 99, 235);
                  doc.textWithLink('↳ View Attached File', 14, y, { url: publicUrl });
                  doc.setTextColor(30, 41, 59);
               }
          }
          
          y += 6;
        }
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`MuntiCares Medical Summary — Page ${i} of ${pageCount}`, 14, 290);
        doc.text('This document is auto-generated and not a substitute for official medical records.', pageWidth - 14, 290, { align: 'right' });
      }

      doc.save(`MuntiCares_MedicalSummary_${profile.full_name.replace(/\s+/g, '_')}.pdf`);
      toast.success('Medical Summary downloaded!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="patient">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        {/* Completion Alert */}
        {!profile.is_profile_complete && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl md:rounded-3xl p-4 md:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-yellow-800 font-bold text-base md:text-lg">Complete Your Profile</h3>
                <p className="text-yellow-700 text-xs md:text-sm mt-1">Your address is required so providers know where to deliver home care services.</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 h-2 bg-yellow-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-yellow-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercent}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
                <span className="text-yellow-700 font-bold text-sm">{completionPercent}%</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Profile Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Gradient Banner */}
              <div className="h-28 md:h-32 bg-gradient-to-br from-primary via-blue-500 to-blue-400 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              </div>

              {/* Avatar overlapping the banner */}
              <div className="px-6 md:px-8 -mt-14 md:-mt-16 relative z-10">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center text-3xl md:text-4xl font-bold text-primary mx-auto"
                  style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' }}
                >
                  {profile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
              </div>

              <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">{profile.full_name}</h2>
                <p className="text-slate-500 text-sm font-medium mt-1">{profile.email}</p>
                
                <div className="flex items-center justify-center gap-2 mt-3">
                  <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-primary font-bold text-[10px] uppercase tracking-widest rounded-full border border-blue-100">
                    Patient
                  </span>
                  {profile.is_profile_complete && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 font-bold text-[10px] uppercase tracking-widest rounded-full border border-green-100">
                      <CheckCircle2 className="w-3 h-3" /> Complete
                    </span>
                  )}
                </div>

                {/* Quick Info */}
                <div className="mt-6 space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <span className="truncate">{profile.email}</span>
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                        <Phone className="w-4 h-4 text-slate-400" />
                      </div>
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile.address && (
                    <div className="flex items-start gap-3 text-sm text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-lg shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="line-clamp-2">{profile.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <div className="p-2 bg-slate-50 rounded-lg shrink-0">
                      <Calendar className="w-4 h-4 text-slate-400" />
                    </div>
                    <span>Member since {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>

                {/* Download & Logout */}
                <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                  <button 
                    onClick={generatePDF}
                    disabled={generatingPdf}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-primary bg-blue-50 hover:bg-blue-100 transition-colors text-sm disabled:opacity-50"
                  >
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {generatingPdf ? 'Generating...' : 'Download Medical Summary'}
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Edit Form */}
          <motion.div 
            className="lg:col-span-2 bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-6 md:p-8 border-b border-slate-100">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">Personal & Medical Details</h3>
              <p className="text-slate-500 text-sm mt-1">This information helps providers give you the best possible care.</p>
            </div>
            
            <form onSubmit={handleSave} className="p-6 md:p-8 space-y-5 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="tel"
                      required
                      value={profile.phone}
                      onChange={e => setProfile({...profile, phone: e.target.value})}
                      placeholder="e.g., 09123456789"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Emergency Contact</label>
                  <div className="relative group">
                    <HeartPulse className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text"
                      required
                      value={profile.emergency_contact}
                      onChange={e => setProfile({...profile, emergency_contact: e.target.value})}
                      placeholder="Name & Number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Home Address (Service Location)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <textarea 
                      required
                      value={profile.address}
                      onChange={e => setProfile({...profile, address: e.target.value})}
                      placeholder="Full home address in Muntinlupa..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Medical Notes (Allergies, Conditions)</label>
                  <div className="relative group">
                    <Activity className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <textarea 
                      value={profile.medical_notes}
                      onChange={e => setProfile({...profile, medical_notes: e.target.value})}
                      placeholder="Any important medical history providers should know?"
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all resize-none"
                    />
                  </div>
                  
                  {/* Smart Suggestions */}
                  <div className="pt-2 space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Add Suggestions:</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs py-1.5 px-2 bg-slate-100 rounded-lg font-bold text-slate-500 mr-1 flex items-center">💊 Conditions</span>
                        {['Diabetic', 'High Blood Pressure', 'Asthma', 'Heart Condition'].filter(s => !(profile.medical_notes || '').toLowerCase().includes(s.toLowerCase())).map(s => (
                          <motion.button
                            key={s}
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              const curr = (profile.medical_notes || '').trim();
                              const newNotes = curr ? `${curr.replace(/,\s*$/, '')}, ${s}` : s;
                              setProfile({...profile, medical_notes: newNotes});
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-primary rounded-lg text-xs font-bold border border-blue-100 transition-colors"
                          >
                            + {s}
                          </motion.button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs py-1.5 px-2 bg-slate-100 rounded-lg font-bold text-slate-500 mr-1 flex items-center">⚠️ Allergies/Notes</span>
                        {['No known allergies', 'Penicillin Allergy', 'Needs Wheelchair'].filter(s => !(profile.medical_notes || '').toLowerCase().includes(s.toLowerCase())).map(s => (
                          <motion.button
                            key={s}
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              const curr = (profile.medical_notes || '').trim();
                              const newNotes = curr ? `${curr.replace(/,\s*$/, '')}, ${s}` : s;
                              setProfile({...profile, medical_notes: newNotes});
                            }}
                            className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold border border-orange-100 transition-colors"
                          >
                            + {s}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 md:pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setProfile({...profile, medical_notes: ''})}
                  className="px-6 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors text-sm"
                >
                  Clear Notes
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white font-bold rounded-xl md:rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 w-full sm:w-auto"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Documents Section */}
          <motion.div 
            className="lg:col-span-2 lg:col-start-2 bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900">Medical Documents</h3>
                <p className="text-slate-500 text-sm mt-1">Upload lab results, prescriptions, etc. (Max 500KB)</p>
              </div>
              <div>
                <input 
                  type="file" 
                  id="doc-upload" 
                  className="hidden" 
                  accept="image/jpeg, image/png, application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <label 
                  htmlFor="doc-upload" 
                  className={`flex items-center gap-2 px-4 py-2 bg-blue-50 text-primary font-bold rounded-xl cursor-pointer hover:bg-blue-100 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
            </div>

            {/* Upload Progress Indication */}
            {uploading && (
              <div className="px-6 md:px-8 pb-4">
                <div className="flex justify-between text-xs text-slate-500 font-bold mb-1">
                  <span>Uploading document...</span>
                  <span className="text-primary animate-pulse">Processing</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>
              </div>
            )}
            
            <div className="p-6 md:p-8">
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="p-2 bg-blue-100 rounded-lg text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-700 text-sm truncate">{doc.document_title}</p>
                        <p className="text-xs text-slate-400">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                         type="button"
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                         onClick={async () => {
                           if(window.confirm('Are you sure you want to delete this document?')) {
                             // 1. Delete from Storage Bucket first
                             await supabase.storage
                               .from('medical_documents')
                               .remove([doc.file_path]);
                               
                             // 2. Delete from Database
                             await supabase
                               .from('patient_documents')
                               .delete()
                               .eq('id', doc.id);
                               
                             // 3. Update UI
                             setDocuments(documents.filter(d => d.id !== doc.id));
                             toast.success('Document deleted!');
                           }
                         }}
                      >
                         <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Visit History Section */}
          <motion.div 
            className="lg:col-span-2 lg:col-start-2 bg-white rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="p-6 md:p-8 border-b border-slate-100">
              <h3 className="text-lg md:text-xl font-bold text-slate-900">Visit History & Clinical Notes</h3>
              <p className="text-slate-500 text-sm mt-1">Past consultations, vitals, and provider notes.</p>
            </div>
            
            <div className="p-6 md:p-8">
              {visitNotes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 font-medium">No past visits recorded.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {visitNotes.map((note) => (
                    <div key={note.id} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <p className="font-bold text-slate-900 text-lg">Dr. {note.provider?.full_name || 'Unknown'}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        </div>
                        {note.services_rendered && (
                          <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-primary font-bold text-[10px] uppercase tracking-widest rounded-full self-start sm:self-auto">
                            {note.services_rendered}
                          </span>
                        )}
                      </div>

                      {/* Vitals Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {note.vitals_bp && (
                          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Blood Pressure</p>
                            <p className="font-bold text-slate-700">{note.vitals_bp}</p>
                          </div>
                        )}
                        {note.vitals_temp && (
                          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Temperature</p>
                            <p className="font-bold text-slate-700">{note.vitals_temp}°C</p>
                          </div>
                        )}
                        {note.vitals_hr && (
                          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Heart Rate</p>
                            <p className="font-bold text-slate-700">{note.vitals_hr} bpm</p>
                          </div>
                        )}
                        {note.vitals_spo2 && (
                          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">SpO2</p>
                            <p className="font-bold text-slate-700">{note.vitals_spo2}%</p>
                          </div>
                        )}
                      </div>

                      {note.notes && (
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Clinical Notes</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.notes}</p>
                        </div>
                      )}

                       {note.attachment_url && (
                         <button
                           type="button"
                           onClick={async () => {
                             const url = await getSignedUrl(note.attachment_url, 3600);
                             if (url) window.open(url, '_blank');
                           }}
                           className="inline-flex items-center gap-2 text-sm text-primary font-bold hover:underline"
                         >
                           <FileText className="w-4 h-4" />
                           View Attachment
                         </button>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientProfile;
