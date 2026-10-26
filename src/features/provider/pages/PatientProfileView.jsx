import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Mail, Phone, MapPin, Calendar, HeartPulse, Activity, FileText, Clock, MessageCircle, ArrowLeft, Lock, Shield, AlertCircle, Stethoscope, FolderOpen, User, FileCode, Loader2, ExternalLink, Paperclip } from 'lucide-react';
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

const PatientProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth(); // need to import useAuth
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

      const { data: consentData } = await supabase
        .from('consent_access')
        .select('*')
        .eq('patient_id', id)
        .eq('provider_id', authUser.id)
        .maybeSingle();
      setConsent(consentData);

      const canAccess = consentData?.is_enabled;
      const perms = consentData?.permissions && Object.keys(consentData.permissions).length > 0
        ? consentData.permissions
        : { medical_history: true, documents: true, visit_notes: true };

      if (canAccess && perms.medical_history) {
        const { data: mh } = await supabase
          .from('medical_histories')
          .select('allergies, chronic_conditions, past_surgeries')
          .eq('patient_id', id)
          .maybeSingle();
        setMedicalHistory(mh || null);
      } else {
        setMedicalHistory(null);
      }

      if (canAccess && perms.documents) {
        const { data: docs } = await supabase
          .from('patient_documents')
          .select('*')
          .eq('patient_id', id)
          .order('uploaded_at', { ascending: false });
        setDocuments(docs || []);
      } else {
        setDocuments([]);
      }

      const { data: notes } = await supabase
        .from('visit_notes')
        .select('*')
        .eq('patient_id', id)
        .eq('provider_id', authUser.id)
        .order('created_at', { ascending: false });
      if (notes) setVisitNotes(notes);
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

    const subscription = supabase
      .channel(`consent-${id}-${authUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consent_access',
        filter: `patient_id=eq.${id}`,
      }, (payload) => {
        if (payload.new?.provider_id === authUser.id) {
          setConsent(payload.new);
          fetchData();
        }
      })
      .subscribe();

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('consent_access')
        .select('*')
        .eq('patient_id', id)
        .eq('provider_id', authUser.id)
        .maybeSingle();
      if (data) setConsent(data);
    }, 5000);

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
        if (perms.medical_history) {
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

        const { data: notesData } = await supabase
          .from('visit_notes')
          .select('*')
          .eq('patient_id', id)
          .eq('provider_id', authUser.id)
          .order('created_at', { ascending: false });

        if (notesData?.length) {
          const vitals = buildVitalSignObservations(notesData, id);
          resources.push(...vitals);
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
      <div className="w-full max-w-full lg:max-w-6xl mx-auto space-y-4 md:space-y-6 pb-12 px-0 sm:px-2">
        {/* Navigation Breadcrumb / Back button */}
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/provider/patients')}
            className="neu-btn px-4 py-2.5 rounded-2xl inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-success dark:text-success-dark" />
            <span>Back to My Patients</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Sidebar Patient Card */}
          <div className="lg:col-span-1">
            <motion.div
              className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Header Banner */}
              <div className="h-24 sm:h-28 md:h-32 bg-gradient-to-br from-ink via-primary-800 to-primary-700 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }} />
              </div>

              {/* Avatar */}
              <div className="px-4 sm:px-8 -mt-12 sm:-mt-14 md:-mt-16 relative z-10">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-4 border-surface-shell shadow-xl mx-auto overflow-hidden bg-gradient-to-br from-surface-subtle to-primary-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center neu-btn p-1">
                  {patient.avatar_url ? (
                    <img src={patient.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-success dark:text-emerald-300">
                      {patient.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                    </span>
                  )}
                </div>
              </div>

              {/* Bio & Details */}
              <div className="px-4 sm:px-8 pt-3 sm:pt-4 pb-5 sm:pb-8 text-center">
                <h1 className="text-lg sm:text-xl md:text-2xl font-display font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-snug">{patient.full_name}</h1>
                <p className="text-tertiary text-xs font-semibold mt-0.5 dark:text-tertiary break-all">{patient.email}</p>

                {!consent?.is_enabled ? (
                  <div className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-2xs sm:text-2xs font-extrabold text-warning dark:text-warning-dark uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Consent Required for Full Records</span>
                  </div>
                ) : (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-2xs sm:text-2xs font-extrabold text-success dark:text-success-dark uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>Active Consent Granted</span>
                  </div>
                )}

                {/* Patient Info Fields */}
                <div className="mt-4 sm:mt-5 space-y-2.5 text-left neu-inset p-3.5 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-1.5 neu-flat-sm rounded-lg shrink-0">
                      <Mail className="w-3.5 h-3.5 text-success dark:text-success-dark" />
                    </div>
                    <span className="truncate font-semibold">{patient.email}</span>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-1.5 neu-flat-sm rounded-lg shrink-0">
                        <Phone className="w-3.5 h-3.5 text-success dark:text-success-dark" />
                      </div>
                      <span className="font-semibold">{patient.phone}</span>
                    </div>
                  )}
                  {patient.address && (
                    <div className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-1.5 neu-flat-sm rounded-lg shrink-0 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-success dark:text-success-dark" />
                      </div>
                      <span className="line-clamp-2 font-semibold">{patient.address}</span>
                    </div>
                  )}
                  {patient.emergency_contact && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-1.5 neu-flat-sm rounded-lg shrink-0">
                        <HeartPulse className="w-3.5 h-3.5 text-danger" />
                      </div>
                      <span className="font-semibold truncate">EC: {patient.emergency_contact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-xs text-tertiary dark:text-tertiary pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                    <div className="p-1.5 neu-flat-sm rounded-lg shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-tertiary" />
                    </div>
                    <span className="text-2xs sm:text-2xs font-extrabold uppercase tracking-wider">Joined {new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-200/50 dark:border-white/5">
                  <p className="text-2xs sm:text-2xs font-black text-tertiary dark:text-tertiary uppercase tracking-widest text-center mb-2.5 sm:mb-3">Quick Actions</p>
                  <div className="space-y-2">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setChartOpen(true)}
                      className="neu-btn-primary w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white text-xs transition-all cursor-pointer shadow-sm"
                    >
                      <Stethoscope className="w-4 h-4" />
                      <span>Open Clinical Chart & Log Note</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => navigate(`/provider/messages?user=${id}`)}
                      className="neu-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-success dark:text-emerald-300 text-xs transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-success" />
                      <span>Send Direct Message</span>
                    </motion.button>

                    <motion.button
                      whileTap={consent?.is_enabled ? { scale: 0.96 } : {}}
                      onClick={consent?.is_enabled ? handleFhirExport : undefined}
                      disabled={fhirLoading || !consent?.is_enabled}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all text-xs ${
                        consent?.is_enabled
                          ? 'neu-btn text-teal-700 dark:text-teal-300 cursor-pointer'
                          : 'neu-inset opacity-50 text-tertiary dark:text-tertiary cursor-not-allowed'
                      }`}
                    >
                      {fhirLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : consent?.is_enabled ? (
                        <FileCode className="w-4 h-4 text-teal-600" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {fhirLoading
                          ? 'Generating Bundle...'
                          : consent?.is_enabled
                            ? 'Export as FHIR (JSON)'
                            : 'FHIR — Consent Required'}
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabbed Content Area */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                {/* Neumorphic Tab Bar */}
                <Tabs.List className="neu-inset p-1.5 rounded-2xl mb-4 sm:mb-6 grid grid-cols-4 gap-1.5">
                  {[
                    { value: 'overview', icon: User, label: 'Overview', shortLabel: 'Info' },
                    { value: 'medical', icon: Stethoscope, label: 'Medical History', shortLabel: 'Medical', locked: !consent?.is_enabled || !consent?.permissions?.medical_history },
                    { value: 'documents', icon: FolderOpen, label: 'Documents', shortLabel: 'Docs', locked: !consent?.is_enabled || !consent?.permissions?.documents },
                    { value: 'history', icon: Clock, label: `Notes (${visitNotes.length})`, shortLabel: `Notes (${visitNotes.length})` },
                  ].map(tab => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={`py-2 px-1 sm:px-3 rounded-xl text-xs sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
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
                      <span className="sm:hidden truncate">{tab.shortLabel}</span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Content value="overview" className="outline-none">
                  <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-8 border-b border-slate-200/50 dark:border-white/5">
                      <h3 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-slate-800 dark:text-slate-100">Patient Demographics</h3>
                      <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Verified profile details & contact info</p>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                        <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                          <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1">Full Legal Name</p>
                          <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm">{patient.full_name}</p>
                        </div>
                        <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                          <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1">Email Address</p>
                          <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm truncate">{patient.email}</p>
                        </div>
                        <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                          <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1">Mobile Contact</p>
                          <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm">{patient.phone || 'Not provided'}</p>
                        </div>
                        <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                          <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1">Emergency Contact</p>
                          <p className="text-slate-800 dark:text-slate-100 font-extrabold text-xs sm:text-sm">{patient.emergency_contact || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                        <p className="text-2xs text-tertiary dark:text-tertiary font-extrabold uppercase tracking-wider mb-1">Registered Address / Barangay</p>
                        <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm leading-relaxed">{patient.address || 'No residential address provided'}</p>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Medical Tab */}
                <Tabs.Content value="medical" className="outline-none">
                  <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-8 border-b border-slate-200/50 dark:border-white/5">
                      <h3 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-slate-800 dark:text-slate-100">Medical History</h3>
                      <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Clinical baseline, allergies, and chronic conditions</p>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8">
                      {!consent?.is_enabled || !consent?.permissions?.medical_history ? (
                        <div className="text-center py-10 neu-inset rounded-2xl p-6">
                          <div className="w-14 h-14 neu-btn rounded-full flex items-center justify-center mx-auto mb-3 text-warning">
                            <Lock className="w-6 h-6" />
                          </div>
                          <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">Patient Consent Required</p>
                          <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">
                            The patient has not granted electronic health access for this category yet under local privacy governance.
                          </p>
                        </div>
                      ) : !medicalHistory ? (
                        <div className="text-center py-10 neu-inset rounded-2xl p-6">
                          <div className="w-14 h-14 neu-btn rounded-full flex items-center justify-center mx-auto mb-3 text-tertiary">
                            <Activity className="w-6 h-6" />
                          </div>
                          <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">No Medical History Recorded</p>
                          <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">No recorded baseline history available for this patient.</p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 sm:space-y-4">
                          <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                            <p className="text-2xs text-danger font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Known Allergies
                            </p>
                            <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm">{medicalHistory.allergies || 'None reported'}</p>
                          </div>
                          <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
                            <p className="text-2xs text-success dark:text-success-dark font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <HeartPulse className="w-3.5 h-3.5" />
                              Chronic Conditions
                            </p>
                            <p className="text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm">{medicalHistory.chronic_conditions || 'None reported'}</p>
                          </div>
                          <div className="neu-inset p-3.5 sm:p-4 rounded-2xl">
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
                  <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-8 border-b border-slate-200/50 dark:border-white/5">
                      <h3 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-slate-800 dark:text-slate-100">Medical Documents</h3>
                      <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Uploaded laboratory results & prescriptions</p>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8">
                      {!consent?.is_enabled || !consent?.permissions?.documents ? (
                        <div className="text-center py-10 neu-inset rounded-2xl p-6">
                          <div className="w-14 h-14 neu-btn rounded-full flex items-center justify-center mx-auto mb-3 text-warning">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
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
                  <div className="neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden">
                    <div className="p-4 sm:p-6 md:p-8 border-b border-slate-200/50 dark:border-white/5">
                      <h3 className="text-base sm:text-lg md:text-xl font-display font-extrabold text-slate-800 dark:text-slate-100">Visit Notes History</h3>
                      <p className="text-tertiary dark:text-tertiary text-xs font-semibold mt-0.5">Recorded consultations and vital assessments</p>
                    </div>
                    <div className="p-4 sm:p-6 md:p-8">
                      {visitNotes.length === 0 ? (
                        <div className="text-center py-10 neu-inset rounded-2xl p-6">
                          <div className="w-14 h-14 neu-btn rounded-full flex items-center justify-center mx-auto mb-3 text-tertiary">
                            <Clock className="w-6 h-6" />
                          </div>
                          <p className="text-slate-700 dark:text-slate-200 font-extrabold text-sm sm:text-base">No past visits recorded</p>
                          <p className="text-xs text-tertiary dark:text-tertiary mt-1 max-w-sm mx-auto">Use the patient card modal to log new clinical notes.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {visitNotes.map((note) => (
                            <div key={note.id} className="neu-flat p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] space-y-3.5 sm:space-y-4">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                                  <Calendar className="w-4 h-4 text-success" />
                                  <span>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {note.services_rendered && (
                                  <span className="px-3 py-1 neu-inset rounded-xl text-2xs sm:text-2xs font-extrabold text-success dark:text-emerald-300 uppercase tracking-wider">
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
        </div>
      </div>
    </DashboardLayout>

      <PatientRecordModal
        isOpen={chartOpen}
        onClose={() => { setChartOpen(false); fetchData(); }}
        patientId={id}
        patientName={patient.full_name}
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
