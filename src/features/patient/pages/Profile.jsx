import { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  FolderOpen,
  Loader2,
  LogOut,
  MapPin,
  MoreHorizontal,
  Save,
  Stethoscope,
  Trash2,
  Undo2,
  Upload,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import { getSignedUrl } from '@/lib/supabaseHelpers';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import { ProfilePhotoUpload, FhirExportModal } from '@/shared/components';
import { buildPatientResource, buildVitalSignObservations, buildConditionResources, buildAllergyResources, buildBundle } from '@/lib/fhir';
import ProfileAddressModal from '@/features/patient/components/ProfileAddressModal';
import ProfileMobileAccountSheet from '@/features/patient/components/ProfileMobileAccountSheet';
import ProfileConfirmDialog from '@/features/patient/components/ProfileConfirmDialog';
import {
  buildProfileSnapshot,
  formatEmergencyContact,
  getProfileCompletion,
  isMissingColumnError,
  isProfileDirty,
  resolveEmergencyContactParts,
  shouldSkipMedicalHistoryWrite,
  summarizeAddressForCard,
} from '@/features/patient/utils/patientProfile';

const PatientProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [visitNotes, setVisitNotes] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [fhirOpen, setFhirOpen] = useState(false);
  const [fhirBundle, setFhirBundle] = useState(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const initialAddressRef = useRef('');
  const savedBaselineRef = useRef(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [homeCoords, setHomeCoords] = useState(null);
  const [addressDraftMeta, setAddressDraftMeta] = useState(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [docPendingDelete, setDocPendingDelete] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    medical_notes: '',
    emergency_contact: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    allergies: '',
    chronic_conditions: '',
    past_surgeries: '',
    is_profile_complete: false,
    created_at: ''
  });

  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (!userId) return;
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email, created_at')
          .eq('id', userId)
          .single();
          
        if (userError) throw userError;

        const { data: patData, error: patError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (patError && patError.code !== 'PGRST116') {
          throw patError;
        }

        const initialCoords =
          patData?.latitude != null && patData?.longitude != null
            ? { lat: patData.latitude, lng: patData.longitude }
            : null;
        if (initialCoords) {
          setHomeCoords(initialCoords);
        }
        initialAddressRef.current = patData?.address || '';
        const emergencyParts = resolveEmergencyContactParts(patData);
        let hydratedProfile = {
          full_name: userData.full_name,
          email: userData.email,
          phone: patData?.phone || '',
          address: patData?.address || '',
          medical_notes: patData?.medical_notes || '',
          emergency_contact: formatEmergencyContact(emergencyParts.name, emergencyParts.phone),
          emergency_contact_name: emergencyParts.name,
          emergency_contact_phone: emergencyParts.phone,
          allergies: '',
          chronic_conditions: '',
          past_surgeries: '',
          is_profile_complete: patData?.is_profile_complete || false,
          created_at: userData.created_at
        };
        if (cancelled) return;
        setProfile(hydratedProfile);
        try {
          const { data: avData } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single();
          if (!cancelled && avData?.avatar_url) setAvatarUrl(avData.avatar_url);
        } catch {} // column may not exist yet

        // Fetch Medical History
        const { data: histRows, error: histError } = await supabase
          .from('medical_histories')
          .select('allergies, chronic_conditions, past_surgeries')
          .eq('patient_id', userId);
        if (cancelled) return;
        if (histError) {
          console.error('Error fetching medical history:', histError);
        } else {
          setHistoryLoaded(true);
          const mh = histRows?.[0];
          if (mh) {
            hydratedProfile = {
              ...hydratedProfile,
              allergies: mh.allergies || '',
              chronic_conditions: mh.chronic_conditions || '',
              past_surgeries: mh.past_surgeries || '',
            };
            setProfile(hydratedProfile);
          }
        }

        savedBaselineRef.current = {
          profile: hydratedProfile,
          homeCoords: initialCoords,
          addressDraftMeta: null,
        };
        setSavedSnapshot(buildProfileSnapshot(hydratedProfile, initialCoords));

        // Fetch Documents
        const { data: docs, error: docsError } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', userId)
          .order('uploaded_at', { ascending: false });
          
        if (!cancelled && !docsError && docs) {
          setDocuments(docs);
        }

        // Fetch Visit Notes
        const { data: notes, error: notesError } = await supabase
          .from('visit_notes')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', userId)
          .order('created_at', { ascending: false });

        if (!notesError && notes && !cancelled) {
          setVisitNotes(notes);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const emergencyCombined = formatEmergencyContact(
        profile.emergency_contact_name,
        profile.emergency_contact_phone,
      );
      const isComplete = Boolean(profile.phone?.trim() && profile.address?.trim() && emergencyCombined);
      const initialAddress = initialAddressRef.current;
      const addressChanged = Boolean(initialAddress && initialAddress.trim() !== (profile.address || '').trim());

      const patientPayload = {
        user_id: user.id,
        phone: profile.phone,
        address: profile.address,
        medical_notes: profile.medical_notes,
        emergency_contact: emergencyCombined,
        is_profile_complete: isComplete,
        emergency_contact_name: (profile.emergency_contact_name || '').trim(),
        emergency_contact_phone: (profile.emergency_contact_phone || '').trim(),
      };

      if (homeCoords?.lat != null && homeCoords?.lng != null) {
        patientPayload.latitude = homeCoords.lat;
        patientPayload.longitude = homeCoords.lng;
        patientPayload.geocoded_at = new Date().toISOString();
      } else if (addressChanged) {
        patientPayload.latitude = null;
        patientPayload.longitude = null;
        patientPayload.geocoded_at = null;
      }

      let { error } = await supabase
        .from('patients')
        .upsert(patientPayload, { onConflict: 'user_id' });

      if (error && isMissingColumnError(error)) {
        const legacyPayload = { ...patientPayload };
        delete legacyPayload.emergency_contact_name;
        delete legacyPayload.emergency_contact_phone;
        ({ error } = await supabase
          .from('patients')
          .upsert(legacyPayload, { onConflict: 'user_id' }));
      }

      if (error) throw error;

      initialAddressRef.current = profile.address || '';

      const { data: existingMH } = await supabase
        .from('medical_histories')
        .select('id')
        .eq('patient_id', user.id);
      const hasExisting = existingMH && existingMH.length > 0;

      if (shouldSkipMedicalHistoryWrite(historyLoaded, hasExisting)) {
        toast('Medical history was not updated because your saved history could not be loaded. Please refresh and try again.', { icon: '⚠️' });
      } else {
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
      }

      const nextSavedProfile = {
        ...profile,
        emergency_contact: emergencyCombined,
        is_profile_complete: isComplete,
      };
      setProfile(nextSavedProfile);
      savedBaselineRef.current = {
        profile: nextSavedProfile,
        homeCoords,
        addressDraftMeta,
      };
      setSavedSnapshot(buildProfileSnapshot(nextSavedProfile, homeCoords));

      if (activeTab === 'medical' && !isComplete) {
        toast('Medical history saved, but contact information is incomplete. Please complete your contact details in Personal Information.', { icon: 'ℹ️' });
      } else {
        toast.success('Profile updated successfully!');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const dirty = useMemo(
    () => isProfileDirty(savedSnapshot, profile, homeCoords),
    [savedSnapshot, profile, homeCoords],
  );

  const handleDiscardChanges = () => {
    const baseline = savedBaselineRef.current;
    if (!baseline) return;
    setProfile(baseline.profile);
    setHomeCoords(baseline.homeCoords);
    setAddressDraftMeta(baseline.addressDraftMeta);
    toast('Unsaved changes discarded.', { icon: '↩️' });
  };

  const handleClearNotes = () => {
    const previousNotes = profile.medical_notes;
    if (!previousNotes?.trim()) return;
    setProfile((prev) => ({ ...prev, medical_notes: '' }));
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-semibold">Medical notes cleared.</span>
          <button
            type="button"
            onClick={() => {
              setProfile((prev) => ({ ...prev, medical_notes: previousNotes }));
              toast.dismiss(t.id);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      ),
      { duration: 6000 },
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const requestLogout = () => {
    if (dirty) {
      setLogoutConfirmOpen(true);
      return;
    }
    handleLogout();
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docPendingDelete) return;
    setDeletingDoc(true);
    try {
      await supabase.storage.from('medical_documents').remove([docPendingDelete.file_path]);
      const { error } = await supabase.from('patient_documents').delete().eq('id', docPendingDelete.id);
      if (error) throw error;
      setDocuments((prev) => prev.filter((d) => d.id !== docPendingDelete.id));
      toast.success('Document deleted!');
      setDocPendingDelete(null);
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document.');
    } finally {
      setDeletingDoc(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 3MB Limit Check
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large! Maximum limit is 3MB.");
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

  const completion = getProfileCompletion(profile);
  const completionPercent = completion.percentage;
  const addressSummary = summarizeAddressForCard(profile.address, homeCoords, addressDraftMeta);
  const memberSinceLabel = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'N/A';
  const emergencySummary =
    formatEmergencyContact(profile.emergency_contact_name, profile.emergency_contact_phone) ||
    profile.emergency_contact;

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
        ['Emergency Contact', emergencySummary || 'Not provided'],
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

      const safeName = (profile.full_name || 'Patient').trim().replace(/\s+/g, '_');
      doc.save(`MuntiCares_MedicalSummary_${safeName}.pdf`);
      toast.success('Medical Summary downloaded!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const MEDICAL_SECTIONS = [
    {
      field: 'allergies',
      id: 'profile-allergies',
      label: 'Known Allergies',
      critical: true,
      placeholder: 'List any medication, food, or contact allergies...',
      chips: ['No known allergies', 'Penicillin', 'Sulfa', 'Iodine', 'Latex', 'Peanuts'],
      chipClass: 'text-danger dark:text-danger-dark',
    },
    {
      field: 'chronic_conditions',
      id: 'profile-chronic-conditions',
      label: 'Chronic Conditions',
      critical: false,
      placeholder: 'e.g. Hypertension, Type 2 Diabetes, Asthma...',
      chips: ['Diabetes', 'High Blood Pressure', 'Asthma', 'Heart Disease', 'Arthritis', 'None'],
      chipClass: 'text-link',
    },
    {
      field: 'past_surgeries',
      id: 'profile-past-surgeries',
      label: 'Past Surgeries or Procedures',
      critical: false,
      placeholder: 'List any past surgeries and approximate year...',
      chips: ['Appendectomy', 'C-Section', 'Gallbladder Removal', 'Knee Surgery', 'Tonsillectomy', 'None'],
      chipClass: 'text-link dark:text-primary-400',
    },
  ];

  const renderUnsavedBanner = () =>
    dirty ? (
      <div
        role="status"
        className="mx-4 sm:mx-6 md:mx-7 mt-4 rounded-xl px-3.5 py-2.5 flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-800 dark:text-warning-dark"
      >
        <AlertCircle className="w-4 h-4 text-warning shrink-0" />
        <span>You have unsaved changes — save below to keep your updates.</span>
      </div>
    ) : null;

  const renderSaveFooter = (submitLabel) => (
    <div className="px-4 sm:px-6 md:px-7 py-4 border-t border-slate-200/60 dark:border-white/5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold">
        {dirty ? (
          <>
            <AlertCircle className="w-4 h-4 text-warning shrink-0" />
            <span className="text-amber-800 dark:text-warning-dark">
              Save below to apply edits
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span className="text-tertiary dark:text-tertiary">
              All profile changes saved
            </span>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
        {dirty && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={handleDiscardChanges}
            className="neu-btn min-h-[44px] px-4 py-2.5 text-tertiary dark:text-tertiary font-bold rounded-xl text-xs sm:text-sm cursor-pointer"
          >
            Discard
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="submit"
          disabled={saving}
          className="neu-btn-primary min-h-[44px] px-6 py-2.5 font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 flex-1 sm:flex-initial"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : submitLabel}</span>
        </motion.button>
      </div>
    </div>
  );

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <>
    <DashboardLayout role="patient">
      <div className="space-y-4 sm:space-y-6 relative w-full max-w-full pb-8 select-text">
        
        {/* Clean Patient Profile Header */}
        <div className="pt-1 pb-1">
          <h1 className="font-display font-black tracking-tight text-xl sm:text-2xl md:text-3xl text-slate-900 dark:text-white">
            Patient Profile
          </h1>
          <p className="text-sm text-tertiary dark:text-tertiary mt-0.5 font-medium">
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
                <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-warning shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-amber-800 dark:text-warning-dark font-extrabold text-sm sm:text-base">Complete Your Profile</h2>
                  <p className="text-warning dark:text-warning-dark text-xs mt-0.5">Add your phone, emergency contact, and home visit pin so providers know where to deliver care.</p>
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
                <span className="text-warning dark:text-warning-dark font-black text-xs sm:text-sm">{completionPercent}%</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Mobile Account Hub Compact Strip (keeps Tabs above the fold on < lg) */}
        <section aria-label="Account summary" className="lg:hidden neu-flat rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="neu-flat-sm rounded-2xl p-1 shrink-0">
              <ProfilePhotoUpload
                compact
                userId={user.id}
                fullName={profile.full_name}
                currentUrl={avatarUrl}
                onUpdate={setAvatarUrl}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                    {profile.full_name}
                  </h2>
                  <p className="text-xs text-tertiary dark:text-tertiary font-semibold truncate">
                    {profile.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountSheetOpen(true)}
                  aria-label="Open account and exports menu"
                  className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-link shrink-0 cursor-pointer"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="neu-flat-sm px-2.5 py-0.5 text-link font-black text-2xs uppercase tracking-widest rounded-md">
                  Patient
                </span>
                {profile.is_profile_complete ? (
                  <span className="neu-flat-sm px-2.5 py-0.5 text-success dark:text-success-dark font-black text-2xs uppercase tracking-widest rounded-md inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </span>
                ) : (
                  <span className="neu-flat-sm px-2.5 py-0.5 text-warning dark:text-warning-dark font-black text-2xs uppercase tracking-widest rounded-md">
                    {completionPercent}% Setup
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAccountSheetOpen(true)}
            className="neu-inset w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200 text-left cursor-pointer"
          >
            <span className="truncate font-semibold">
              {profile.phone || 'Add phone'} •{' '}
              {addressSummary.hasCoords
                ? 'Home pin saved'
                : addressSummary.hasAddress
                ? 'Pin needed'
                : 'No address'}
            </span>
            <span className="text-link font-bold shrink-0">
              PDF / FHIR &amp; Account
            </span>
          </button>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-7">
          {/* Desktop Sticky Identity Rail */}
          <div className="hidden lg:block lg:col-span-1">
            <motion.div 
              className="neu-flat rounded-[2.25rem] overflow-hidden lg:sticky lg:top-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Neumorphic Header Accent */}
              <div className="h-24 neu-convex relative flex items-center justify-center overflow-hidden border-b border-white/50 dark:border-white/5">
                <div className="absolute inset-0 bg-primary/10 dark:bg-primary/5" />
              </div>

              {/* Avatar overlapping the banner */}
              <div className="px-6 -mt-14 relative z-10 flex justify-center">
                <div className="neu-flat rounded-2xl p-1.5 shadow-lg">
                  <ProfilePhotoUpload
                    userId={user.id}
                    fullName={profile.full_name}
                    currentUrl={avatarUrl}
                    onUpdate={setAvatarUrl}
                  />
                </div>
              </div>

              <div className="px-6 pt-3 pb-7 text-center">
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 truncate">{profile.full_name}</h2>
                <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5 truncate">{profile.email}</p>
                
                <div className="flex items-center justify-center gap-2 mt-3">
                  <span className="neu-flat-sm px-3 py-1 text-link font-black text-2xs uppercase tracking-widest rounded-md">
                    Patient
                  </span>
                  {profile.is_profile_complete && (
                    <span className="neu-flat-sm px-3 py-1 text-success dark:text-success-dark font-black text-2xs uppercase tracking-widest rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-success" /> Complete
                    </span>
                  )}
                </div>

                {/* Quick Info - Unified Single Card */}
                <div className="mt-5 neu-inset p-4 rounded-2xl text-left space-y-2.5">
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">Email</span>
                    <span className="truncate font-semibold max-w-[65%] text-right">{profile.email}</span>
                  </div>

                  {profile.phone && (
                    <>
                      <div className="border-t border-slate-200/50 dark:border-white/5" />
                      <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-2xs uppercase font-extrabold text-tertiary">Phone</span>
                        <span className="font-semibold">{profile.phone}</span>
                      </div>
                    </>
                  )}

                  {profile.address && (
                    <>
                      <div className="border-t border-slate-200/50 dark:border-white/5" />
                      <div className="flex items-start justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                        <span className="text-2xs uppercase font-extrabold text-tertiary shrink-0 pt-0.5">Address</span>
                        <span className="font-semibold text-right leading-relaxed max-w-[70%] break-words">{profile.address}</span>
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-200/50 dark:border-white/5" />
                  <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                    <span className="text-2xs uppercase font-extrabold text-tertiary">Member Since</span>
                    <span className="font-semibold">{memberSinceLabel}</span>
                  </div>
                </div>

                {/* Data Export Section */}
                <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-white/5">
                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-widest text-center mb-3">Health Data Export</p>
                  <div className="neu-inset p-2 rounded-2xl space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={generatePDF}
                      disabled={generatingPdf}
                      className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-link transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{generatingPdf ? 'Generating...' : 'Medical Summary (PDF)'}</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={handleFhirExport}
                      disabled={fhirLoading}
                      className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-success dark:text-success-dark transition-all text-xs cursor-pointer disabled:opacity-50"
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
                    type="button"
                    onClick={requestLogout}
                    className="neu-btn w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-danger dark:text-danger-dark hover:text-danger transition-all text-xs cursor-pointer active:scale-95"
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
              {/* Neumorphic Tabs Header - Stacked icons on mobile prevent label truncation ("Docume...") */}
              <Tabs.List className="neu-inset p-1 sm:p-1.5 rounded-2xl mb-4 sm:mb-5 grid grid-cols-4 gap-1 sm:gap-1.5">
                {[
                  { value: 'overview', icon: User, label: 'Overview' },
                  { value: 'medical', icon: Stethoscope, label: 'Medical' },
                  { value: 'documents', icon: FolderOpen, label: 'Documents' },
                  { value: 'history', icon: Clock, label: 'History' },
                ].map(tab => (
                  <Tabs.Trigger
                    key={tab.value}
                    value={tab.value}
                    className={`min-h-[52px] sm:min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-bold leading-tight transition-all cursor-pointer select-none ${
                      activeTab === tab.value
                        ? 'neu-flat text-link font-black shadow-sm'
                        : 'text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${activeTab === tab.value ? 'text-link' : 'text-tertiary'}`} />
                    <span>{tab.label}</span>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              {/* Overview Tab */}
              <Tabs.Content value="overview" className="outline-none">
                <form onSubmit={handleSave} className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-4 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Personal Information</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">Your contact details, home pin, and general care notes.</p>
                  </div>

                  {renderUnsavedBanner()}

                  <div className="p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <div className="space-y-1.5 md:col-span-2">
                          <label htmlFor="profile-phone" className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1 block">
                            Phone Number
                          </label>
                          <input 
                            id="profile-phone"
                            type="tel"
                            inputMode="tel"
                            name="phone"
                            autoComplete="tel"
                            value={profile.phone}
                            onChange={e => setProfile({...profile, phone: e.target.value})}
                            placeholder="e.g., 09123456789"
                            className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 min-h-[44px] text-base sm:text-sm font-semibold outline-none transition-all"
                          />
                        </div>

                        {/* Split Emergency Contact */}
                        <div className="space-y-1.5">
                          <label htmlFor="profile-emergency-name" className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1 block">
                            Emergency Contact Name
                          </label>
                          <input
                            id="profile-emergency-name"
                            type="text"
                            name="emergency_contact_name"
                            autoComplete="name"
                            value={profile.emergency_contact_name}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                emergency_contact_name: e.target.value,
                                emergency_contact: formatEmergencyContact(
                                  e.target.value,
                                  prev.emergency_contact_phone,
                                ),
                              }))
                            }
                            placeholder="e.g., Maria Cruz"
                            className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 min-h-[44px] text-base sm:text-sm font-semibold outline-none transition-all"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="profile-emergency-phone" className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1 block">
                            Emergency Contact Number
                          </label>
                          <input
                            id="profile-emergency-phone"
                            type="tel"
                            inputMode="tel"
                            name="emergency_contact_phone"
                            autoComplete="tel"
                            value={profile.emergency_contact_phone}
                            onChange={(e) =>
                              setProfile((prev) => ({
                                ...prev,
                                emergency_contact_phone: e.target.value,
                                emergency_contact: formatEmergencyContact(
                                  prev.emergency_contact_name,
                                  e.target.value,
                                ),
                              }))
                            }
                            placeholder="e.g., 09187654321"
                            className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 px-4 min-h-[44px] text-base sm:text-sm font-semibold outline-none transition-all"
                          />
                        </div>

                        {/* Scoped Saved Home Visit Pin Summary Card */}
                        <div className="md:col-span-2">
                          <div className="neu-inset rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-white/5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center text-link shrink-0">
                                  <MapPin className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                                      Permanent Home &amp; Visit Address
                                    </span>
                                    {addressSummary.hasAddress && addressSummary.hasCoords ? (
                                      <span className="neu-flat-sm px-2.5 py-0.5 text-success dark:text-success-dark font-black text-2xs uppercase tracking-wider rounded-md">
                                        Default Home Pin
                                      </span>
                                    ) : addressSummary.hasAddress ? (
                                      <span className="neu-flat-sm px-2.5 py-0.5 text-warning dark:text-warning-dark font-black text-2xs uppercase tracking-wider rounded-md">
                                        Map Pin Needed
                                      </span>
                                    ) : (
                                      <span className="neu-flat-sm px-2.5 py-0.5 text-tertiary font-black text-2xs uppercase tracking-wider rounded-md">
                                        Not Set
                                      </span>
                                    )}
                                  </div>

                                  {addressSummary.hasAddress ? (
                                    <div className="mt-1.5 space-y-1">
                                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">
                                        {addressSummary.street}
                                      </p>
                                      {addressSummary.detailsLine && (
                                        <p className="text-xs text-tertiary dark:text-tertiary font-medium">
                                          {addressSummary.detailsLine}
                                        </p>
                                      )}
                                      {addressSummary.instructions && (
                                        <p className="text-xs text-link dark:text-primary-400 font-semibold">
                                          Gate note: {addressSummary.instructions}
                                        </p>
                                      )}
                                      {addressSummary.coordsLabel ? (
                                        <p className="text-2xs font-bold text-tertiary dark:text-tertiary">
                                          GPS Pin: {addressSummary.coordsLabel}
                                        </p>
                                      ) : (
                                        <p className="text-2xs font-semibold text-amber-700 dark:text-amber-300">
                                          Add a map pin so healthcare providers locate your exact home entrance.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-xs sm:text-sm text-tertiary dark:text-tertiary mt-1">
                                      Add your home visit street, barangay, and map pin for future bookings.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <motion.button
                                whileTap={{ scale: 0.96 }}
                                type="button"
                                onClick={() => setAddressModalOpen(true)}
                                className="neu-btn min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-link text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer w-full sm:w-auto"
                              >
                                <MapPin className="w-4 h-4" />
                                <span>Edit Pin &amp; Address</span>
                              </motion.button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor="profile-medical-notes" className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1">
                              General Medical Notes
                            </label>
                            <button
                              type="button"
                              onClick={handleClearNotes}
                              disabled={!profile.medical_notes?.trim()}
                              className="neu-btn min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold text-tertiary dark:text-tertiary hover:text-slate-800 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Clear Notes
                            </button>
                          </div>
                          <textarea
                            id="profile-medical-notes"
                            name="medical_notes"
                            value={profile.medical_notes}
                            onChange={e => setProfile({...profile, medical_notes: e.target.value})}
                            placeholder="Special needs, mobility notes, or care instructions..."
                            rows={3}
                            className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-base sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                  {renderSaveFooter('Save Profile')}
                </form>
              </Tabs.Content>

              {/* Medical Tab */}
              <Tabs.Content value="medical" className="outline-none">
                <form onSubmit={handleSave} className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-4 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Medical History</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">Your allergies, chronic conditions, and past surgeries.</p>
                  </div>

                  {renderUnsavedBanner()}

                  <div className="p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
                      {MEDICAL_SECTIONS.map((section) => {
                        const currentValue = profile[section.field] || '';
                        const availableChips = section.chips.filter(
                          (chip) => !currentValue.toLowerCase().includes(chip.toLowerCase()),
                        );

                        return (
                          <div key={section.field} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={section.id}
                                className="text-xs font-bold text-slate-700 dark:text-slate-200 ml-1"
                              >
                                {section.label}
                              </label>
                              {section.critical && (
                                <span className="text-2xs font-extrabold text-danger uppercase">Critical</span>
                              )}
                            </div>
                            <textarea
                              id={section.id}
                              name={section.field}
                              value={currentValue}
                              onChange={(e) =>
                                setProfile((prev) => ({ ...prev, [section.field]: e.target.value }))
                              }
                              placeholder={section.placeholder}
                              rows={2}
                              className="w-full neu-inset neu-input text-slate-800 dark:text-slate-100 rounded-xl sm:rounded-2xl p-3 text-base sm:text-sm font-semibold outline-none transition-all resize-none leading-relaxed"
                            />
                            {availableChips.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {availableChips.map((chip) => (
                                  <motion.button
                                    key={chip}
                                    type="button"
                                    whileTap={{ scale: 0.94 }}
                                    onClick={() =>
                                      setProfile((prev) => {
                                        const existing = (prev[section.field] || '').trim();
                                        return {
                                          ...prev,
                                          [section.field]: existing
                                            ? `${prev[section.field].replace(/,\s*$/, '')}, ${chip}`
                                            : chip,
                                        };
                                      })
                                    }
                                    className={`neu-btn min-h-[38px] px-3 py-1.5 ${section.chipClass} rounded-lg text-xs font-bold cursor-pointer`}
                                  >
                                    + {chip}
                                  </motion.button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  {renderSaveFooter('Save Medical History')}
                </form>
              </Tabs.Content>

              {/* Documents Tab */}
              <Tabs.Content value="documents" className="outline-none">
                <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                  <div className="p-5 sm:p-6 md:p-7 border-b border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">Medical Documents</h3>
                      <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">Upload lab results, prescriptions, or imaging (Max 3MB)</p>
                    </div>
                    <div>
                      <input type="file" id="doc-upload" className="hidden" accept="image/jpeg, image/png, application/pdf"
                        onChange={handleFileUpload} disabled={uploading} />
                      <label htmlFor="doc-upload"
                        className={`neu-btn min-h-[44px] px-4 py-2.5 text-link font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                      </label>
                    </div>
                  </div>

                  {uploading && (
                    <div className="px-5 sm:px-7 py-3 neu-inset mx-5 sm:mx-7 my-4 rounded-xl">
                      <div className="flex justify-between text-xs text-tertiary dark:text-tertiary font-bold mb-1">
                        <span>Uploading document...</span>
                        <span className="text-link animate-pulse">Processing</span>
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
                          <div key={doc.id} className="neu-flat-sm p-3.5 sm:p-4 rounded-xl sm:rounded-2xl flex items-center gap-2.5 select-text">
                            <div className="neu-flat-sm w-10 h-10 rounded-xl flex items-center justify-center text-link shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 pr-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  const url = await getSignedUrl(doc.file_path, 3600);
                                  if (url) window.open(url, '_blank');
                                  else toast.error('Could not open document.');
                                }}
                                className="font-bold text-slate-800 dark:text-slate-100 hover:text-link text-xs sm:text-sm truncate block text-left w-full cursor-pointer transition-colors"
                                title="Open Document"
                              >
                                {doc.document_title}
                              </button>
                              <p className="text-xs text-tertiary dark:text-tertiary mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                            </div>
                            <motion.button whileTap={{ scale: 0.9 }} type="button"
                              className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-tertiary hover:text-link transition-colors shrink-0 cursor-pointer"
                              aria-label={`Open ${doc.document_title}`}
                              title="Open Document"
                              onClick={async () => {
                                const url = await getSignedUrl(doc.file_path, 3600);
                                if (url) window.open(url, '_blank');
                                else toast.error('Could not open document.');
                              }}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} type="button"
                              className="neu-btn w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-tertiary hover:text-danger dark:hover:text-rose-400 transition-colors shrink-0 cursor-pointer"
                              aria-label={`Delete ${doc.document_title}`}
                              title="Delete Document"
                              onClick={() => setDocPendingDelete(doc)}
                            >
                              <Trash2 className="w-4 h-4" />
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
                    <p className="text-tertiary dark:text-tertiary text-xs mt-0.5">Past medical visits, vital signs, and provider clinical notes.</p>
                  </div>

                  <div className="p-5 sm:p-6 md:p-7">
                    {visitNotes.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="neu-flat-sm w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-tertiary">
                          <Activity className="w-6 h-6" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 font-bold text-sm">No past visits recorded.</p>
                        <p className="text-tertiary text-xs mt-1">Consultation summaries will appear here after provider appointments.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 sm:space-y-5">
                        {visitNotes.map((note) => (
                          <div key={note.id} className="neu-flat-sm p-4 sm:p-5 rounded-2xl space-y-3.5 select-text">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-3">
                              <div>
                                <p className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base">Dr. {note.provider?.full_name || 'Healthcare Provider'}</p>
                                <div className="flex items-center gap-1.5 text-sm text-tertiary dark:text-tertiary mt-0.5">
                                  <Calendar className="w-3.5 h-3.5 text-link" />
                                  <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                              </div>
                              {note.services_rendered && (
                                <span className="neu-flat-sm px-3 py-1 text-link font-black text-2xs uppercase tracking-widest rounded-full self-start sm:self-auto">
                                  {note.services_rendered}
                                </span>
                              )}
                            </div>

                            {/* Vitals Grid with Inset or Flat-sm Tiles */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                              {note.vitals_bp && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">Blood Pressure</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_bp}</p>
                                </div>
                              )}
                              {note.vitals_temp && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">Temperature</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_temp}°C</p>
                                </div>
                              )}
                              {note.vitals_hr && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">Heart Rate</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_hr} bpm</p>
                                </div>
                              )}
                              {note.vitals_spo2 && (
                                <div className="neu-flat-sm p-2.5 sm:p-3 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">Oxygen (SpO2)</p>
                                  <p className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_spo2}%</p>
                                </div>
                              )}
                            </div>

                            {note.notes && (
                              <div className="neu-inset p-3 sm:p-4 rounded-xl">
                                <p className="text-2xs font-black text-tertiary uppercase tracking-wider mb-1">Clinical Notes</p>
                                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{note.notes}</p>
                              </div>
                            )}

                            {note.attachment_url && (
                              <motion.button whileTap={{ scale: 0.96 }} type="button"
                                onClick={async () => { const url = await getSignedUrl(note.attachment_url, 3600); if (url) window.open(url, '_blank'); }}
                                className="neu-btn min-h-[44px] px-4 py-2 rounded-xl inline-flex items-center gap-2 text-xs text-link font-bold transition-all cursor-pointer"
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

      <ProfileAddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        address={profile.address}
        coords={homeCoords}
        draftMeta={addressDraftMeta}
        onApply={({ address, coords, street, unit, subdivision, instructions }) => {
          setProfile((prev) => ({ ...prev, address }));
          setHomeCoords(coords || null);
          setAddressDraftMeta({ street, unit, subdivision, instructions });
        }}
      />

      <ProfileMobileAccountSheet
        open={accountSheetOpen}
        onClose={() => setAccountSheetOpen(false)}
        fullName={profile.full_name}
        email={profile.email}
        phone={profile.phone}
        address={profile.address}
        memberSince={memberSinceLabel}
        isComplete={profile.is_profile_complete}
        completionPercentage={completionPercent}
        generatingPdf={generatingPdf}
        fhirLoading={fhirLoading}
        hasUnsavedChanges={dirty}
        onExportPdf={generatePDF}
        onExportFhir={handleFhirExport}
        onLogout={requestLogout}
      />

      <ProfileConfirmDialog
        open={Boolean(docPendingDelete)}
        title="Delete Medical Document?"
        description={
          docPendingDelete
            ? `"${docPendingDelete.document_title}" will be permanently deleted from your medical records.`
            : ''
        }
        confirmLabel={deletingDoc ? 'Deleting...' : 'Delete Permanently'}
        cancelLabel="Keep File"
        loading={deletingDoc}
        danger
        onCancel={() => {
          if (!deletingDoc) setDocPendingDelete(null);
        }}
        onConfirm={handleConfirmDeleteDoc}
      />

      <ProfileConfirmDialog
        open={logoutConfirmOpen}
        title="Discard Unsaved Changes & Sign Out?"
        description="You have unsaved edits on your profile. Signing out now will discard those unsaved updates."
        confirmLabel="Discard & Sign Out"
        cancelLabel="Keep Editing"
        danger={false}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          handleLogout();
        }}
      />

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
