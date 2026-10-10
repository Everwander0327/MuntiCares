import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Activity, LogOut, Save, Calendar, CheckCircle2, Upload, FileText, X, Loader2, Download, User, Stethoscope, FolderOpen, Clock, FileCode } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { getSignedUrl } from '../../lib/supabaseHelpers';
import EmptyState from '../../components/EmptyState';
import ProfilePhotoUpload from '../../components/ProfilePhotoUpload';
import FhirExportModal from '../../components/FhirExportModal';
import { buildPatientResource, buildVitalSignObservations, buildConditionResources, buildAllergyResources, buildBundle } from '../../lib/fhir';

const PatientProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [visitNotes, setVisitNotes] = useState([]);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [fhirBundle, setFhirBundle] = useState(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    medical_notes: '',
    emergency_contact: '',
    allergies: '',
    chronic_conditions: '',
    past_surgeries: '',
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
          allergies: '',
          chronic_conditions: '',
          past_surgeries: '',
          is_profile_complete: patData?.is_profile_complete || false,
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

        // Fetch Medical History
        const { data: histRows } = await supabase
          .from('medical_histories')
          .select('allergies, chronic_conditions, past_surgeries')
          .eq('patient_id', user.id);
        const mh = histRows?.[0];
        if (mh) {
          setProfile(prev => ({
            ...prev,
            allergies: mh.allergies || '',
            chronic_conditions: mh.chronic_conditions || '',
            past_surgeries: mh.past_surgeries || '',
          }));
        }

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

      const { data: existingMH } = await supabase
        .from('medical_histories')
        .select('id')
        .eq('patient_id', user.id);
      const hasExisting = existingMH && existingMH.length > 0;

      const mhPayload = {
        patient_id: user.id,
        allergies: profile.allergies,
        chronic_conditions: profile.chronic_conditions,
        past_surgeries: profile.past_surgeries,
      };

      if (hasExisting) {
        const { error: mhError } = await supabase
          .from('medical_histories')
          .update(mhPayload)
          .eq('patient_id', user.id);
        if (mhError) throw mhError;
      } else {
        const { error: mhError } = await supabase
          .from('medical_histories')
          .insert(mhPayload);
        if (mhError) throw mhError;
      }

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

  // FHIR Export
  const handleFhirExport = async () => {
    setFhirLoading(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: histRows } = await supabase
        .from('medical_histories')
        .select('*')
        .eq('patient_id', user.id);
      const histData = histRows?.[0] || null;

      const { data: notesData } = await supabase
        .from('visit_notes')
        .select('*')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      const resources = [];

      const patientRes = buildPatientResource(userData, patData);
      resources.push(patientRes);

      const vitals = buildVitalSignObservations(notesData || [], user.id);
      resources.push(...vitals);

      if (histData) {
        const conditions = buildConditionResources(histData, user.id);
        resources.push(...conditions);
        const allergies = buildAllergyResources(histData, user.id);
        resources.push(...allergies);
      }

      const bundle = buildBundle(resources);
      setFhirBundle(bundle);
      setFhirOpen(true);
    } catch (err) {
      console.error('FHIR export error:', err);
      toast.error('Failed to export FHIR data.');
    } finally {
      setFhirLoading(false);
    }
  };

  // PDF Generation
  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      // Fetch medical history
      const { data: histRows } = await supabase
        .from('medical_histories')
        .select('*')
        .eq('patient_id', user.id);
      const histData = histRows?.[0] || null;

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
    <>
    <DashboardLayout role="patient">
      <div className="space-y-4 sm:space-y-6 relative w-full max-w-full pb-8 select-text">
        
        {/* Clean Patient Profile Header */}
        <div className="pt-1 pb-2">
          <h1 className="font-display font-black tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
            Patient Profile
          </h1>
          <p className="text-3xs sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Manage your personal information, medical history, and consultation records.
          </p>
        </div>

        {/* Completion Alert Banner (Neumorphic Inset / Flat) */}
        {!profile.is_profile_complete && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="neu-flat p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-amber-500/30 bg-amber-500/5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-amber-800 dark:text-amber-300 font-extrabold text-sm sm:text-base">Complete Your Profile</h3>
                  <p className="text-amber-700/80 dark:text-amber-200/70 text-3xs sm:text-xs mt-0.5">Your address is required so providers know where to deliver home care services.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <div className="w-28 h-2.5 neu-inset rounded-full overflow-hidden p-0.5">
                  <motion.div 
                    className="h-full bg-amber-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercent}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
                <span className="text-amber-700 dark:text-amber-300 font-black text-xs sm:text-sm">{completionPercent}%</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-7">
          {/* Profile Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div 
              className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Neumorphic Header Accent */}
              <div className="h-20 sm:h-24 neu-convex relative flex items-center justify-center overflow-hidden border-b border-white/50 dark:border-white/5">
                <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5" />
              </div>

              {/* Avatar overlapping the banner */}
              <div className="px-5 sm:px-6 -mt-12 sm:-mt-14 relative z-10 flex justify-center">
                <div className="neu-flat rounded-full p-1.5 shadow-lg">
                  <ProfilePhotoUpload
                    userId={user.id}
                    fullName={profile.full_name}
                    currentUrl={avatarUrl}
                    onUpdate={setAvatarUrl}
                  />
                </div>
              </div>

              <div className="px-5 sm:px-6 pt-3 pb-6 sm:pb-7 text-center">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 truncate">{profile.full_name}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5 truncate">{profile.email}</p>
                
                <div className="flex items-center justify-center gap-2 mt-3">
                  <span className="neu-flat-sm px-3 py-1 text-primary font-black text-3xs uppercase tracking-widest rounded-full">
                    Patient
                  </span>
                  {profile.is_profile_complete && (
                    <span className="neu-flat-sm px-3 py-1 text-emerald-600 dark:text-emerald-400 font-black text-3xs uppercase tracking-widest rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Complete
                    </span>
                  )}
                </div>

                {/* Quick Info - Unified Single Card */}
                <div className="mt-5 neu-inset p-3.5 sm:p-4 rounded-2xl text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                    <span className="text-3xs uppercase font-extrabold text-slate-400">Email</span>
                    <span className="truncate font-semibold max-w-[65%] text-right">{profile.email}</span>
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

                  {profile.address && (
                    <>
                      <div className="border-t border-slate-200/50 dark:border-white/5" />
                      <div className="flex items-start justify-between gap-3 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                        <span className="text-3xs uppercase font-extrabold text-slate-400 shrink-0 pt-0.5">Address</span>
                        <span className="font-semibold text-right leading-relaxed max-w-[70%] break-words">{profile.address}</span>
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between text-xs sm:text-[13px] text-slate-700 dark:text-slate-200">
                    <span className="text-3xs uppercase font-extrabold text-slate-400">Member Since</span>
                    <span className="font-semibold">{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                  </div>
                </div>

                {/* Data Export Section */}
                <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-white/5">
                  <p className="text-3xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center mb-3">Health Data Export</p>
                  <div className="neu-inset p-2 rounded-2xl space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={generatePDF}
                      disabled={generatingPdf}
                      className="neu-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-primary transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{generatingPdf ? 'Generating...' : 'Medical Summary (PDF)'}</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={handleFhirExport}
                      disabled={fhirLoading}
                      className="neu-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      {fhirLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
                      <span>{fhirLoading ? 'Exporting...' : 'FHIR Record (JSON)'}</span>
                    </motion.button>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="pt-4">
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

          {/* Tabbed Content */}
          <motion.div 
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              {/* Neumorphic Tabs Header */}
              <Tabs.List className="neu-inset p-1.5 rounded-2xl mb-5 flex gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { value: 'overview', icon: User, label: 'Overview' },
                  { value: 'medical', icon: Stethoscope, label: 'Medical' },
                  { value: 'documents', icon: FolderOpen, label: 'Documents' },
                  { value: 'history', icon: Clock, label: 'History' },
                ].map(tab => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 cursor-pointer select-none ${
                      activeTab === tab.value
                        ? 'neu-flat text-primary font-black shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <tab.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === tab.value ? 'text-primary' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* Overview Tab */}
              <Tabs.Content value="overview" className="outline-none">
                <form onSubmit={handleSave} className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-5 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Personal Information</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Your contact details and medical notes.</p>
                  </div>

                  <div className="p-5 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Phone Number</label>
                        <input 
                          type="tel" name="phone" required
                          value={profile.phone}
                          onChange={e => setProfile({...profile, phone: e.target.value})}
                          placeholder="e.g., 09123456789"
                          className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm font-semibold outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Emergency Contact</label>
                        <input 
                          type="text" name="emergency_contact" required
                          value={profile.emergency_contact}
                          onChange={e => setProfile({...profile, emergency_contact: e.target.value})}
                          placeholder="Name & Contact Number"
                          className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm font-semibold outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Home Address</label>
                        <textarea name="address" required value={profile.address}
                          onChange={e => setProfile({...profile, address: e.target.value})}
                          placeholder="Complete home address in Muntinlupa..." rows={3}
                          className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">General Medical Notes</label>
                        <textarea name="medical_notes" value={profile.medical_notes}
                          onChange={e => setProfile({...profile, medical_notes: e.target.value})}
                          placeholder="Special needs, mobility notes, or care instructions..." rows={3}
                          className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row justify-end items-center gap-2.5">
                      <motion.button whileTap={{ scale: 0.96 }} type="button"
                        onClick={() => setProfile({...profile, medical_notes: ''})}
                        className="neu-btn px-5 py-2.5 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-xs cursor-pointer w-full sm:w-auto"
                      >
                        Clear Notes
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={saving}
                        className="neu-btn-primary px-7 py-2.5 font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Profile'}
                      </motion.button>
                    </div>
                  </div>
                </form>
              </Tabs.Content>

              {/* Medical Tab */}
              <Tabs.Content value="medical" className="outline-none">
                <form onSubmit={handleSave} className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-5 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Medical History</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Your allergies, chronic conditions, and past surgeries.</p>
                  </div>

                  <div className="p-5 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
                    {/* Allergies */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Known Allergies</label>
                        <span className="text-3xs font-extrabold text-rose-500 uppercase">Critical</span>
                      </div>
                      <textarea name="allergies" value={profile.allergies}
                        onChange={e => setProfile({...profile, allergies: e.target.value})}
                        placeholder="List any medication, food, or contact allergies..." rows={2}
                        className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3 text-xs sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {['No known allergies', 'Penicillin', 'Sulfa', 'Iodine', 'Latex', 'Peanuts'].filter(s => !(profile.allergies || '').toLowerCase().includes(s.toLowerCase())).map(s => (
                          <motion.button key={s} type="button" whileTap={{ scale: 0.94 }}
                            onClick={() => setProfile({...profile, allergies: ((profile.allergies || '').trim() ? `${profile.allergies.replace(/,\s*$/, '')}, ${s}` : s)})}
                            className="neu-btn px-2.5 py-1 text-rose-600 dark:text-rose-400 rounded-lg text-3xs font-bold cursor-pointer"
                          >+ {s}</motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Chronic Conditions */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Chronic Conditions</label>
                      <textarea name="chronic_conditions" value={profile.chronic_conditions}
                        onChange={e => setProfile({...profile, chronic_conditions: e.target.value})}
                        placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma..." rows={2}
                        className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3 text-xs sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {['Diabetes', 'High Blood Pressure', 'Asthma', 'Heart Disease', 'Arthritis', 'None'].filter(s => !(profile.chronic_conditions || '').toLowerCase().includes(s.toLowerCase())).map(s => (
                          <motion.button key={s} type="button" whileTap={{ scale: 0.94 }}
                            onClick={() => setProfile({...profile, chronic_conditions: ((profile.chronic_conditions || '').trim() ? `${profile.chronic_conditions.replace(/,\s*$/, '')}, ${s}` : s)})}
                            className="neu-btn px-2.5 py-1 text-primary rounded-lg text-3xs font-bold cursor-pointer"
                          >+ {s}</motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Past Surgeries */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">Past Surgeries or Procedures</label>
                      <textarea name="past_surgeries" value={profile.past_surgeries}
                        onChange={e => setProfile({...profile, past_surgeries: e.target.value})}
                        placeholder="List any past surgeries and approximate year..." rows={2}
                        className="w-full neu-inset text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3 text-xs sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {['Appendectomy', 'C-Section', 'Gallbladder Removal', 'Knee Surgery', 'Tonsillectomy', 'None'].filter(s => !(profile.past_surgeries || '').toLowerCase().includes(s.toLowerCase())).map(s => (
                          <motion.button key={s} type="button" whileTap={{ scale: 0.94 }}
                            onClick={() => setProfile({...profile, past_surgeries: ((profile.past_surgeries || '').trim() ? `${profile.past_surgeries.replace(/,\s*$/, '')}, ${s}` : s)})}
                            className="neu-btn px-2.5 py-1 text-indigo-600 dark:text-indigo-400 rounded-lg text-3xs font-bold cursor-pointer"
                          >+ {s}</motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200/60 dark:border-white/5 flex justify-end">
                      <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={saving}
                        className="neu-btn-primary px-7 py-2.5 font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Medical History'}
                      </motion.button>
                    </div>
                  </div>
                </form>
              </Tabs.Content>

              {/* Documents Tab */}
              <Tabs.Content value="documents" className="outline-none">
                <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-5 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Medical Documents</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Upload lab results, prescriptions, or imaging (Max 500KB)</p>
                    </div>
                    <div>
                      <input type="file" id="doc-upload" className="hidden" accept="image/jpeg, image/png, application/pdf"
                        onChange={handleFileUpload} disabled={uploading} />
                      <label htmlFor="doc-upload"
                        className={`neu-btn px-4 py-2 text-primary font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                      </label>
                    </div>
                  </div>

                  {uploading && (
                    <div className="px-5 sm:px-7 py-3 neu-inset mx-5 sm:mx-7 my-4 rounded-xl">
                      <div className="flex justify-between text-3xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>Uploading document...</span>
                        <span className="text-primary animate-pulse">Processing</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <motion.div className="h-full bg-primary rounded-full"
                          initial={{ width: "0%" }} animate={{ width: "100%" }}
                          transition={{ duration: 1.5, repeat: Infinity }} />
                      </div>
                    </div>
                  )}

                  <div className="p-5 sm:p-6 md:p-7">
                    {documents.length === 0 ? (
                      <EmptyState icon="document" title="No documents uploaded yet" message="Upload lab results, prescriptions, or other medical records." variant="compact" />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        {documents.map((doc) => (
                          <div key={doc.id} className="neu-flat-sm p-3.5 sm:p-4 rounded-xl sm:rounded-2xl flex items-center gap-3 select-text">
                            <div className="neu-flat-sm w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-primary shrink-0">
                              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">{doc.document_title}</p>
                              <p className="text-3xs text-slate-400 dark:text-slate-500 mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                            </div>
                            <motion.button whileTap={{ scale: 0.9 }} type="button"
                              className="neu-btn w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors shrink-0"
                              title="Delete Document"
                              onClick={async () => {
                                if(window.confirm('Delete this document?')) {
                                  await supabase.storage.from('medical_documents').remove([doc.file_path]);
                                  await supabase.from('patient_documents').delete().eq('id', doc.id);
                                  setDocuments(documents.filter(d => d.id !== doc.id));
                                  toast.success('Document deleted!');
                                }
                              }}
                            >
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </motion.button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Tabs.Content>

              {/* History Tab */}
              <Tabs.Content value="history" className="outline-none">
                <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-5 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Consultation & Visit History</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-3xs sm:text-xs mt-0.5">Past medical visits, vital signs, and provider clinical notes.</p>
                  </div>

                  <div className="p-5 sm:p-6 md:p-7">
                    {visitNotes.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="neu-flat-sm w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Activity className="w-6 h-6" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No past visits recorded.</p>
                        <p className="text-slate-400 text-3xs mt-1">Consultation summaries will appear here after provider appointments.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 sm:space-y-5">
                        {visitNotes.map((note) => (
                          <div key={note.id} className="neu-flat-sm p-4 sm:p-5 rounded-2xl space-y-3.5 select-text">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-3">
                              <div>
                                <p className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">Dr. {note.provider?.full_name || 'Healthcare Provider'}</p>
                                <div className="flex items-center gap-1.5 text-3xs sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  <Calendar className="w-3.5 h-3.5 text-primary" />
                                  <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                              </div>
                              {note.services_rendered && (
                                <span className="neu-flat-sm px-3 py-1 text-primary font-black text-3xs uppercase tracking-widest rounded-full self-start sm:self-auto">
                                  {note.services_rendered}
                                </span>
                              )}
                            </div>

                            {/* Vitals Grid with Inset or Flat-sm Tiles */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                              {note.vitals_bp && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">Blood Pressure</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_bp}</p>
                                </div>
                              )}
                              {note.vitals_temp && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">Temperature</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_temp}°C</p>
                                </div>
                              )}
                              {note.vitals_hr && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">Heart Rate</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_hr} bpm</p>
                                </div>
                              )}
                              {note.vitals_spo2 && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">Oxygen (SpO2)</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_spo2}%</p>
                                </div>
                              )}
                            </div>

                            {note.notes && (
                              <div className="neu-inset p-3 sm:p-4 rounded-xl">
                                <p className="text-3xs font-black text-slate-400 uppercase tracking-wider mb-1">Clinical Notes</p>
                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{note.notes}</p>
                              </div>
                            )}

                            {note.attachment_url && (
                              <motion.button whileTap={{ scale: 0.96 }} type="button"
                                onClick={async () => { const url = await getSignedUrl(note.attachment_url, 3600); if (url) window.open(url, '_blank'); }}
                                className="neu-btn px-3 py-1.5 rounded-lg inline-flex items-center gap-2 text-xs text-primary font-bold transition-all cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View Attachment</span>
                              </motion.button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Tabs.Content>
            </Tabs.Root>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>

      <FhirExportModal
        open={fhirOpen}
        onClose={() => setFhirOpen(false)}
        bundle={fhirBundle}
        patientName={profile.full_name}
      />
    </>
  );
};

export default PatientProfile;
