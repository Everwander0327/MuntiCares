import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Mail, Phone, MapPin, Calendar, HeartPulse, Activity, FileText, Clock, MessageCircle, ArrowLeft, Lock, Shield, AlertCircle, Stethoscope, FolderOpen, User } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../contexts/AuthContext';

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

  useEffect(() => {
    const fetchData = async () => {
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
        const perms = consentData?.permissions || {};

        if (canAccess && perms.medical_history) {
          const { data: mh } = await supabase
            .from('medical_histories')
            .select('allergies, chronic_conditions, past_surgeries')
            .eq('patient_id', id)
            .maybeSingle();
          if (mh) setMedicalHistory(mh);
        }

        if (canAccess && perms.documents) {
          const { data: docs } = await supabase
            .from('patient_documents')
            .select('*')
            .eq('patient_id', id)
            .order('uploaded_at', { ascending: false });
          if (docs) setDocuments(docs);
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
    };
    fetchData();
  }, [id, authUser, navigate]);

  if (loading) {
    return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;
  }

  if (!patient) return null;

  return (
    <DashboardLayout role="provider">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/provider/patients')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Patients
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="h-28 md:h-32 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              </div>

              <div className="px-6 md:px-8 -mt-14 md:-mt-16 relative z-10">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white dark:border-slate-800 shadow-lg mx-auto overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                  {patient.avatar_url ? (
                    <img src={patient.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold text-emerald-600 dark:text-emerald-300">
                      {patient.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{patient.full_name}</h2>
                <p className="text-slate-500 text-sm font-medium mt-1 dark:text-slate-400">{patient.email}</p>

                {!consent?.is_enabled && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Lock className="w-3.5 h-3.5" />
                    Waiting for patient consent
                  </div>
                )}

                <div className="mt-4 space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span className="truncate">{patient.email}</span>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <span>{patient.phone}</span>
                    </div>
                  )}
                  {patient.address && (
                    <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <span className="line-clamp-2">{patient.address}</span>
                    </div>
                  )}
                  {patient.emergency_contact && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                        <HeartPulse className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                      </div>
                      <span>EC: {patient.emergency_contact}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>Member since {new Date(patient.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/provider/messages?user=${id}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-primary bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send Message
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabbed Content */}
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
                    { value: 'medical', icon: Stethoscope, label: 'Medical', locked: !consent?.is_enabled || !consent?.permissions?.medical_history },
                    { value: 'documents', icon: FolderOpen, label: 'Documents', locked: !consent?.is_enabled || !consent?.permissions?.documents },
                    { value: 'history', icon: Clock, label: `Visit Notes (${visitNotes.length})` },
                  ].map(tab => (
                    <Tabs.Trigger
                      key={tab.value}
                      value={tab.value}
                      className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 rounded-xl text-2xs md:text-sm font-medium transition-all whitespace-nowrap flex-1 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500 dark:data-[state=inactive]:text-slate-400`}
                    >
                      {tab.locked ? (
                        <Lock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      ) : (
                        <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === tab.value ? 'text-primary' : ''}`} />
                      )}
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                {/* Overview Tab */}
                <Tabs.Content value="overview" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Patient Information</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Basic contact details</p>
                    </div>
                    <div className="p-6 md:p-8 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Full Name</p>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">{patient.full_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Email</p>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">{patient.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Phone</p>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">{patient.phone || 'Not provided'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Emergency Contact</p>
                          <p className="text-slate-700 dark:text-slate-200 font-medium">{patient.emergency_contact || 'Not provided'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Home Address</p>
                        <p className="text-slate-700 dark:text-slate-200">{patient.address || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Medical Tab */}
                <Tabs.Content value="medical" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Medical History</h3>
                    </div>
                    <div className="p-6 md:p-8">
                      {!consent?.is_enabled ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Lock className="w-6 h-6 text-amber-500" />
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">Patient consent required</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">The patient hasn't granted access to their medical records yet.</p>
                        </div>
                      ) : !medicalHistory ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Activity className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">No medical history recorded</p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Allergies</p>
                            <p className="text-slate-700 dark:text-slate-200">{medicalHistory.allergies || 'None reported'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Chronic Conditions</p>
                            <p className="text-slate-700 dark:text-slate-200">{medicalHistory.chronic_conditions || 'None reported'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Past Surgeries</p>
                            <p className="text-slate-700 dark:text-slate-200">{medicalHistory.past_surgeries || 'None reported'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Documents Tab */}
                <Tabs.Content value="documents" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Medical Documents</h3>
                    </div>
                    <div className="p-6 md:p-8">
                      {!consent?.is_enabled || !consent?.permissions?.documents ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Lock className="w-6 h-6 text-amber-500" />
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">Document access not granted</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">The patient hasn't granted access to their documents.</p>
                        </div>
                      ) : documents.length === 0 ? (
                        <EmptyState icon="document" title="No documents uploaded" message="The patient hasn't uploaded any medical documents." variant="compact" />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {documents.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-primary">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{doc.document_title}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* History Tab */}
                <Tabs.Content value="history" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Visit History</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your past visits with this patient</p>
                    </div>
                    <div className="p-6 md:p-8">
                      {visitNotes.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Clock className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">No past visits recorded</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {visitNotes.map((note) => (
                            <div key={note.id} className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-3">
                              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                <Calendar className="w-4 h-4" />
                                <span className="font-medium">
                                  {new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {note.vitals_bp && (
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase">BP</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{note.vitals_bp}</p>
                                  </div>
                                )}
                                {note.vitals_temp && (
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase">Temp</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{note.vitals_temp}°C</p>
                                  </div>
                                )}
                                {note.vitals_hr && (
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase">HR</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{note.vitals_hr} bpm</p>
                                  </div>
                                )}
                                {note.vitals_spo2 && (
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <p className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase">SpO2</p>
                                    <p className="font-bold text-slate-700 dark:text-slate-200">{note.vitals_spo2}%</p>
                                  </div>
                                )}
                              </div>
                              {note.services_rendered && (
                                <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-primary font-semibold text-2xs uppercase tracking-widest rounded-full">
                                  {note.services_rendered}
                                </div>
                              )}
                              {note.notes && (
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                  <p className="text-2xs font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Notes</p>
                                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{note.notes}</p>
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
  );
};

export default PatientProfileView;
