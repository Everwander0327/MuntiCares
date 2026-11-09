import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Mail, Phone, MapPin, Calendar, HeartPulse, Activity, FileText, Clock, MessageCircle, ArrowLeft, Lock, Shield, AlertCircle, Stethoscope, FolderOpen, User, FileCode, Loader2, ExternalLink, Paperclip, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { supabase } from '@/lib/supabase';
import { getSignedUrl } from '@/lib/supabaseHelpers';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { FhirExportModal } from '@/shared/components';
import { buildPatientResource, buildVitalSignObservations, buildConditionResources, buildAllergyResources, buildBundle } from '@/lib/fhir';
import PatientRecordModal from '../components/PatientRecordModal';
import { fetchConsentGrant } from '../lib/consent';

const PatientProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth(); // need to import useAuth
  const consentRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [consent, setConsent] = useState(null);
  const [medicalHistory, setMedicalHistory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [visitNotes, setVisitNotes] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [fhirOpen, setFhirOpen] = useState(false);
  const [fhirBundle, setFhirBundle] = useState(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const handleOpenFile = async (filePath) => {
    try {
      const url = await getSignedUrl(filePath, 3600);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Unable to open document.');
      }
    } catch (err) {
      console.error('Error opening file:', err);
      toast.error('Unable to open document.');
    }
  };

  const fetchData = useCallback(async () => {
    if (!authUser || !id) return;
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, email, created_at, avatar_url')
        .eq('id', id)
        .single();
      if (userError) throw userError;

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      setPatient({
        full_name: userData.full_name,
        email: userData.email,
        created_at: userData.created_at,
        avatar_url: userData.avatar_url || '',
        phone: patData?.phone || '',
        address: patData?.address || '',
        emergency_contact: patData?.emergency_contact || '',
      });

      const grant = await fetchConsentGrant(id, authUser.id);
      consentRef.current = grant;
      setConsent(grant);

      const canAccess = Boolean(grant);
      // Deny by default: only an explicit true grants a category.
      const perms = grant?.permissions || {};

      if (canAccess && perms.medical_history === true) {
        const { data: mh } = await supabase
          .from('medical_histories')
          .select('allergies, chronic_conditions, past_surgeries')
          .eq('patient_id', id)
          .maybeSingle();
        setMedicalHistory(mh || null);
      } else {
        setMedicalHistory(null);
      }

      if (canAccess && perms.documents === true) {
        const { data: docs } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', id)
          .order('uploaded_at', { ascending: false })
          .limit(50);
        setDocuments(docs || []);
      } else {
        setDocuments([]);
      }

      if (canAccess && perms.visit_notes === true) {
        const { data: notes } = await supabase
          .from('visit_notes')
          .select('*')
          .eq('patient_id', id)
          .eq('provider_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(100);
        setVisitNotes(notes || []);
      } else {
        setVisitNotes([]);
      }
    } catch (err) {
      console.error('Error fetching patient profile:', err);
      navigate('/provider/patients');
    } finally {
      setLoading(false);
    }
  }, [id, authUser, navigate]);

  useEffect(() => {
    if (!authUser || !id) return;
    fetchData();

    const refreshConsent = async () => {
      let grant;
      try {
        grant = await fetchConsentGrant(id, authUser.id);
      } catch {
        return;
      }
      if (JSON.stringify(grant) === JSON.stringify(consentRef.current)) return;
      consentRef.current = grant;
      setConsent(grant);
      // Re-run the gated fetch so revoked or expired categories stop showing.
      fetchData();
    };

    const subscription = supabase
      .channel(`consent-${id}-${authUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consent_access',
        filter: `patient_id=eq.${id}`,
      }, (payload) => {
        if (payload.new?.provider_id === authUser.id) {
          refreshConsent();
        }
      })
      .subscribe();

    const pollInterval = setInterval(refreshConsent, 20000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(pollInterval);
    };
  }, [id, authUser, fetchData]);

  if (loading) {
    return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;
  }

  if (!patient) return null;

  const handleFhirExport = async () => {
    setFhirLoading(true);
    try {
      const resources = [];

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      const { data: patData } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      const patientRes = buildPatientResource(userData, patData);
      resources.push(patientRes);

      const canAccess = consent?.is_enabled;
      const perms = consent?.permissions || {};

      if (canAccess) {
        if (perms.medical_history === true) {
          const { data: mh } = await supabase
            .from('medical_histories')
            .select('*')
            .eq('patient_id', id)
            .maybeSingle();

          if (mh) {
            const conditions = buildConditionResources(mh, id);
            resources.push(...conditions);
            const allergies = buildAllergyResources(mh, id);
            resources.push(...allergies);
          }
        }

        if (perms.visit_notes === true) {
          const { data: notesData } = await supabase
            .from('visit_notes')
            .select('*')
            .eq('patient_id', id)
            .eq('provider_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(100);

          if (notesData?.length) {
            const vitals = buildVitalSignObservations(notesData, id);
            resources.push(...vitals);
          }
        }
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

  return (
    <>
    <DashboardLayout role="provider">
      <div className="w-full max-w-full space-y-4 md:space-y-6 pb-12 px-0 sm:px-2">
        {/* Navigation Breadcrumb / Back button */}
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/provider/patients')}
            className="neu-btn px-3.5 py-2 rounded-xl inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-primary dark:text-primary-400" />
            <span>Back to My Patients</span>
          </motion.button>
        </div>

        {/* Option 1: Compact Horizontal Patient Identity Hero Banner */}
        <motion.div
          className="neu-flat rounded-2xl p-4 sm:p-5 border border-slate-200/60 dark:border-white/5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Patient Squircle Avatar + Identity + Status Badges */}
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-surface-subtle to-primary-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-700 shadow-sm">
                {patient.avatar_url ? (
                  <img src={patient.avatar_url} alt={patient.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl sm:text-2xl font-black text-primary dark:text-primary-300">
                    {patient.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-display font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">
                    {patient.full_name}
                  </h1>
                  {!consent?.is_enabled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-extrabold text-warning dark:text-warning-dark uppercase tracking-wider">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>Consent Required</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold text-success dark:text-success-dark uppercase tracking-wider">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span>Active Consent Granted</span>
                    </span>
                  )}
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-extrabold text-primary dark:text-primary-300 uppercase tracking-wider">
                    Patient
                  </span>
                </div>

                {/* Single-line Metadata Summary (No Duplicate Clutter) */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-none">
                    <Mail className="w-3.5 h-3.5 text-primary dark:text-primary-400 shrink-0" />
                    <span className="truncate">{patient.email}</span>
                  </span>
                  {patient.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <Phone className="w-3.5 h-3.5 text-primary dark:text-primary-400 shrink-0" />
                      <span>{patient.phone}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Joined {new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Top-Level Clinical Action Bar (Thumb-Friendly on Mobile) */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-white/5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setChartOpen(true)}
                className="col-span-2 sm:col-span-1 neu-btn-primary px-4 py-2.5 rounded-xl font-bold text-white text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Stethoscope className="w-4 h-4 shrink-0" />
                <span>Open Clinical Chart</span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(`/provider/messages?user=${id}`)}
                className="neu-btn px-3.5 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-primary dark:text-primary-400 shrink-0" />
                <span>Message</span>
              </motion.button>

              <motion.button
                whileTap={consent?.is_enabled ? { scale: 0.96 } : {}}
                onClick={consent?.is_enabled ? handleFhirExport : undefined}
                disabled={fhirLoading || !consent?.is_enabled}
                title={consent?.is_enabled ? 'Export Patient Record as FHIR R4 JSON' : 'Patient Consent Required for FHIR Export'}
                className={`px-3.5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all ${
                  consent?.is_enabled
                    ? 'neu-btn text-teal-700 dark:text-teal-300 cursor-pointer'
                    : 'neu-inset opacity-50 text-tertiary dark:text-tertiary cursor-not-allowed'
                }`}
              >
                {fhirLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : consent?.is_enabled ? (
                  <FileCode className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {fhirLoading
                    ? 'Exporting...'
                    : consent?.is_enabled
                      ? 'FHIR JSON'
                      : 'FHIR Locked'}
                </span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Above-the-Fold Clinical Tabs & Structured Content */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
            {/* Segmented Squircle Tab Bar */}
            <Tabs.List className="neu-inset p-1.5 rounded-2xl mb-4 sm:mb-5 grid grid-cols-4 gap-1.5">
              {[
                { value: 'overview', icon: User, label: 'Overview', shortLabel: 'Overview' },
                { value: 'medical', icon: Stethoscope, label: 'Medical History', shortLabel: 'Medical', locked: !consent?.is_enabled || !consent?.permissions?.medical_history },
                { value: 'documents', icon: FolderOpen, label: `Documents (${documents.length})`, shortLabel: `Docs (${documents.length})`, locked: !consent?.is_enabled || !consent?.permissions?.documents },
                { value: 'history', icon: Clock, label: `Notes (${visitNotes.length})`, shortLabel: `Notes (${visitNotes.length})` },
              ].map(tab => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={`py-2.5 px-2 sm:px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                    activeTab === tab.value
                      ? 'neu-pressed text-link font-extrabold shadow-inner'
                      : 'neu-btn text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.locked ? (
                    <Lock className="w-3.5 h-3.5 text-tertiary shrink-0" />
                  ) : (
                    <tab.icon className={`w-3.5 h-3.5 shrink-0 ${activeTab === tab.value ? 'text-link' : 'text-tertiary'}`} />
                  )}
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                  <span className="sm:hidden truncate text-[11px]">{tab.shortLabel}</span>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Overview Tab: 2-Card Structured Clinical Overview Hub */}
            <Tabs.Content value="overview" className="outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
                {/* Card 1: Contact & Residence (7 cols on desktop) */}
                <div className="lg:col-span-7 neu-flat rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-white/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-slate-200/60 dark:border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-300 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-display font-extrabold text-slate-800 dark:text-slate-100">Contact & Residence</h3>
                          <p className="text-[11px] font-semibold text-tertiary">Verified patient identity & barangay location</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md neu-inset text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Verified Profile
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div className="neu-inset p-3.5 rounded-xl">
                        <p className="text-[10px] text-tertiary font-extrabold uppercase tracking-wider mb-1">Full Legal Name</p>
                        <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm truncate">{patient.full_name}</p>
                      </div>
                      <div className="neu-inset p-3.5 rounded-xl">
                        <p className="text-[10px] text-tertiary font-extrabold uppercase tracking-wider mb-1">Mobile Phone</p>
                        <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm">{patient.phone || 'Not provided'}</p>
                      </div>
                    </div>

                    <div className="neu-inset p-3.5 rounded-xl mb-3">
                      <p className="text-[10px] text-tertiary font-extrabold uppercase tracking-wider mb-1">Email Address</p>
                      <p className="text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm break-all">{patient.email}</p>
                    </div>

                    <div className="neu-inset p-3.5 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-400 shrink-0" />
                        <p className="text-[10px] text-tertiary font-extrabold uppercase tracking-wider">Registered Address / Barangay</p>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm leading-relaxed">
                        {patient.address || 'No residential address provided'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Emergency Contact & Data Consent Governance (5 cols on desktop) */}
                <div className="lg:col-span-5 neu-flat rounded-2xl p-4 sm:p-6 border border-slate-200/60 dark:border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-slate-200/60 dark:border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-danger shrink-0">
                          <HeartPulse className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-display font-extrabold text-slate-800 dark:text-slate-100">Emergency & Consent</h3>
                          <p className="text-[11px] font-semibold text-tertiary">ICE responder & data sharing permissions</p>
                        </div>
                      </div>
                    </div>

                    {/* Highlighted Emergency Contact (ICE) Card */}
                    <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 mb-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-danger flex items-center gap-1.5">
                          <HeartPulse className="w-3.5 h-3.5 shrink-0" />
                          In Case of Emergency (ICE)
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-[9px] font-extrabold uppercase tracking-wider text-danger">
                          Priority
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1">
                        {patient.emergency_contact || 'No emergency contact listed'}
                      </p>
                    </div>

                    {/* Granted Clinical Permissions Matrix */}
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-tertiary mb-2.5">
                        Granted Clinical Permissions
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            label: 'Medical History',
                            granted: Boolean(consent?.is_enabled && consent?.permissions?.medical_history),
                          },
                          {
                            label: 'Lab Documents',
                            granted: Boolean(consent?.is_enabled && consent?.permissions?.documents),
                          },
                          {
                            label: 'FHIR Bundle',
                            granted: Boolean(consent?.is_enabled),
                          },
                        ].map((perm) => (
                          <div
                            key={perm.label}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              perm.granted
                                ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20'
                                : 'neu-inset border-transparent opacity-75'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-lg mx-auto mb-1.5 flex items-center justify-center ${
                                perm.granted
                                  ? 'bg-emerald-500/15 text-success dark:text-success-dark'
                                  : 'bg-slate-200/70 dark:bg-slate-700 text-tertiary'
                              }`}
                            >
                              {perm.granted ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                            </div>
                            <p className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 leading-tight">{perm.label}</p>
                            <p
                              className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                                perm.granted ? 'text-success dark:text-success-dark' : 'text-tertiary'
                              }`}
                            >
                              {perm.granted ? 'Allowed' : 'Restricted'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick Record Summary Footer */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                    <span className="text-tertiary font-semibold">Clinical Chart Records</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md neu-inset font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                        {documents.length} {documents.length === 1 ? 'Doc' : 'Docs'}
                      </span>
                      <span className="px-2.5 py-1 rounded-md neu-inset font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                        {visitNotes.length} {visitNotes.length === 1 ? 'Note' : 'Notes'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Tabs.Content>

            {/* Medical Tab */}
            <Tabs.Content value="medical" className="outline-none">
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/5">
                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-white/5">
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-slate-800 dark:text-slate-100">Medical History</h3>
                  <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Clinical baseline, allergies, and chronic conditions</p>
                </div>
                <div className="p-4 sm:p-6">
                  {!consent?.is_enabled || !consent?.permissions?.medical_history ? (
                    <div className="text-center py-10 neu-inset rounded-2xl p-6">
                      <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center mx-auto mb-3 text-warning">
                        <Lock className="w-6 h-6" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">Patient Consent Required</p>
                      <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">
                        The patient has not granted electronic health access for this category yet under local privacy governance.
                      </p>
                    </div>
                  ) : !medicalHistory ? (
                    <div className="text-center py-10 neu-inset rounded-2xl p-6">
                      <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center mx-auto mb-3 text-tertiary">
                        <Activity className="w-6 h-6" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">No Medical History Recorded</p>
                      <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">No recorded baseline history available for this patient.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                      <div className="neu-inset p-4 rounded-2xl">
                        <p className="text-2xs text-danger font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Known Allergies
                        </p>
                        <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm">{medicalHistory.allergies || 'None reported'}</p>
                      </div>
                      <div className="neu-inset p-4 rounded-2xl">
                        <p className="text-2xs text-success dark:text-success-dark font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <HeartPulse className="w-3.5 h-3.5" />
                          Chronic Conditions
                        </p>
                        <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm">{medicalHistory.chronic_conditions || 'None reported'}</p>
                      </div>
                      <div className="neu-inset p-4 rounded-2xl">
                        <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" />
                          Past Surgeries / Procedures
                        </p>
                        <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm">{medicalHistory.past_surgeries || 'None reported'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Content>

            {/* Documents Tab */}
            <Tabs.Content value="documents" className="outline-none">
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/5">
                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-white/5">
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-slate-800 dark:text-slate-100">Medical Documents</h3>
                  <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Uploaded laboratory results & prescriptions</p>
                </div>
                <div className="p-4 sm:p-6">
                  {!consent?.is_enabled || !consent?.permissions?.documents ? (
                    <div className="text-center py-10 neu-inset rounded-2xl p-6">
                      <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center mx-auto mb-3 text-warning">
                        <Lock className="w-6 h-6" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">Document Access Restricted</p>
                      <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">
                        The patient has not granted document inspection permissions.
                      </p>
                    </div>
                  ) : documents.length === 0 ? (
                    <EmptyState icon="document" title="No documents uploaded" message="The patient hasn't uploaded any medical documents yet." variant="compact" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                      {documents.map((doc) => (
                        <div key={doc.id} className="neu-inset p-3.5 sm:p-4 rounded-2xl flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl neu-btn flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-slate-800 dark:text-slate-100 text-xs truncate">{doc.document_title}</p>
                            <p className="text-xs text-tertiary dark:text-tertiary mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                          </div>
                          {doc.file_path && (
                            <button
                              type="button"
                              onClick={() => handleOpenFile(doc.file_path)}
                              title="Open Document"
                              className="neu-btn p-2 rounded-xl text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-all cursor-pointer shrink-0"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Tabs.Content>

            {/* History / Visit Notes Tab */}
            <Tabs.Content value="history" className="outline-none">
              <div className="neu-flat rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/5">
                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-display font-extrabold text-slate-800 dark:text-slate-100">Visit Notes History</h3>
                    <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Recorded consultations and vital assessments</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setChartOpen(true)}
                    className="neu-btn px-3.5 py-2 rounded-xl text-xs font-bold text-primary dark:text-primary-300 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Log Clinical Note</span>
                  </motion.button>
                </div>
                <div className="p-4 sm:p-6">
                  {visitNotes.length === 0 ? (
                    <div className="text-center py-10 neu-inset rounded-2xl p-6">
                      <div className="w-14 h-14 neu-btn rounded-2xl flex items-center justify-center mx-auto mb-3 text-tertiary">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">No past visits recorded</p>
                      <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">Use the Open Clinical Chart button to log new clinical notes.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visitNotes.map((note) => (
                        <div key={note.id} className="neu-flat p-4 sm:p-6 rounded-2xl space-y-3.5 sm:space-y-4 border border-slate-200/50 dark:border-white/5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                              <Calendar className="w-4 h-4 text-success" />
                              <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {note.services_rendered && (
                              <span className="px-3 py-1 neu-inset rounded-lg text-2xs font-extrabold text-success dark:text-emerald-300 uppercase tracking-wider">
                                {note.services_rendered}
                              </span>
                            )}
                          </div>

                          {/* Vitals Grid */}
                          {(note.vitals_bp || note.vitals_temp || note.vitals_hr || note.vitals_spo2) && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                              {note.vitals_bp && (
                                <div className="neu-inset p-2.5 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-wider">BP</p>
                                  <p className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_bp}</p>
                                </div>
                              )}
                              {note.vitals_temp && (
                                <div className="neu-inset p-2.5 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-wider">Temp</p>
                                  <p className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_temp}°C</p>
                                </div>
                              )}
                              {note.vitals_hr && (
                                <div className="neu-inset p-2.5 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-wider">Heart Rate</p>
                                  <p className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_hr} bpm</p>
                                </div>
                              )}
                              {note.vitals_spo2 && (
                                <div className="neu-inset p-2.5 rounded-xl text-center">
                                  <p className="text-2xs font-extrabold text-tertiary dark:text-tertiary uppercase tracking-wider">SpO2</p>
                                  <p className="font-display font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm mt-0.5">{note.vitals_spo2}%</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Doctor's Note */}
                          {note.notes && (
                            <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                              <p className="text-2xs font-extrabold text-success dark:text-success-dark uppercase tracking-wider mb-1">Doctor&apos;s Clinical Assessment</p>
                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">{note.notes}</p>
                            </div>
                          )}

                          {note.attachment_url && (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleOpenFile(note.attachment_url)}
                                className="neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-success dark:text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>View Attachment</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
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
    </DashboardLayout>

      <PatientRecordModal
        isOpen={chartOpen}
        onClose={() => { setChartOpen(false); fetchData(); }}
        patientId={id}
        patientName={patient.full_name}
        patientAvatar={patient.avatar_url}
      />

      <FhirExportModal
        open={fhirOpen}
        onClose={() => setFhirOpen(false)}
        bundle={fhirBundle}
        patientName={patient?.full_name}
      />
    </>
  );
};

export default PatientProfileView;
