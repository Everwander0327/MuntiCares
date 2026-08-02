import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Mail, Phone, MapPin, Award, BookOpen, Calendar, Shield, Star, CheckCircle2, Clock, MessageCircle, CalendarDays, ArrowLeft, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

const getTrustLevel = (score) => {
  if (score >= 90) return { label: 'Highly Trusted', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-900/50' };
  if (score >= 70) return { label: 'Trusted', color: 'text-green-600 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-900/50' };
  if (score >= 40) return { label: 'Developing', color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-900/50' };
  return { label: 'Needs Improvement', color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-900/50' };
};

const ProviderProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({
    completed_requests: 0,
    cancelled_requests: 0,
    unique_patients: 0,
    review_count: 0,
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name, email, created_at, avatar_url')
          .eq('id', id)
          .single();
        if (userError) throw userError;

        const { data: provData, error: provError } = await supabase
          .from('providers')
          .select('*')
          .eq('user_id', id)
          .single();
        if (provError) throw provError;

        setProvider({ ...userData, ...provData });

        const { data: revData } = await supabase
          .from('provider_reviews')
          .select('*, patient:patient_id(full_name)')
          .eq('provider_id', id)
          .order('created_at', { ascending: false });
        if (revData) setReviews(revData);

        const { count: completed } = await supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'Completed');

        const { count: cancelled } = await supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'Cancelled');

        const { count: uniquePats } = await supabase
          .from('requests')
          .select('patient_id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'Completed');

        setStats({
          completed_requests: completed || 0,
          cancelled_requests: cancelled || 0,
          unique_patients: uniquePats || 0,
          review_count: revData?.length || 0,
        });
      } catch (err) {
        console.error('Error fetching provider:', err);
        navigate('/patient/providers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  if (!provider) return null;

  const trustLevel = getTrustLevel(provider.trust_score || 0);
  const completionRate = stats.completed_requests + stats.cancelled_requests > 0
    ? Math.round((stats.completed_requests / (stats.completed_requests + stats.cancelled_requests)) * 100)
    : 0;

  return (
    <DashboardLayout role="patient">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/patient/providers')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Providers
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Sidebar Card */}
          <div className="lg:col-span-1">
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="h-28 md:h-32 bg-gradient-to-br from-primary via-blue-500 to-blue-400 relative">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              </div>

              <div className="px-6 md:px-8 -mt-14 md:-mt-16 relative z-10">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white dark:border-slate-800 shadow-lg mx-auto overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                  {provider.avatar_url ? (
                    <img src={provider.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl md:text-4xl font-bold text-primary">
                      {provider.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 md:px-8 pt-4 pb-6 md:pb-8 text-center">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{provider.full_name}</h2>
                <p className="text-primary text-sm font-semibold mt-1">{provider.bio}</p>

                <div className="flex items-center justify-center gap-1 mt-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{provider.rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">({stats.review_count})</span>
                </div>

                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl ${trustLevel.bg} ${trustLevel.border} border`}>
                  <Shield className={`w-4 h-4 ${trustLevel.color}`} />
                  <span className={`text-sm font-bold ${trustLevel.color}`}>{trustLevel.label}</span>
                </div>

                {/* Quick Info */}
                <div className="mt-6 space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>{provider.location || 'Muntinlupa City'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">₱{provider.price_per_service || '0'}/service</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg shrink-0">
                      <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>Member since {new Date(provider.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/patient/providers?book=${id}`)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 transition-all text-sm shadow-lg shadow-primary/20"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Book Appointment
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/patient/messages?user=${id}`)}
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
                    { value: 'overview', icon: Award, label: 'Overview' },
                    { value: 'reviews', icon: Star, label: `Reviews (${stats.review_count})` },
                    { value: 'stats', icon: Users, label: 'Stats' },
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
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">About</h3>
                    </div>
                    <div className="p-6 md:p-8 space-y-6">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Bio</p>
                        <p className="text-slate-700 dark:text-slate-200">{provider.bio || 'No bio provided.'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Specializations</p>
                        <div className="flex flex-wrap gap-2">
                          {(provider.services || []).length > 0 ? (
                            provider.services.map((s, i) => (
                              <span key={i} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-primary rounded-xl text-sm font-bold border border-blue-100 dark:border-blue-900/50">
                                {s}
                              </span>
                            ))
                          ) : (
                            <p className="text-slate-500 dark:text-slate-400 text-sm">No specializations listed.</p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Email</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium truncate">{provider.email}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Phone</p>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                            <p className="text-slate-700 dark:text-slate-200 font-medium">{provider.phone || 'Not provided'}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider mb-2">Professional ID</p>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg"><Shield className="w-4 h-4 text-slate-400 dark:text-slate-500" /></div>
                          {provider.professional_id_status === 'verified' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 text-sm">Pending verification</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Tabs.Content>

                {/* Reviews Tab */}
                <Tabs.Content value="reviews" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Patient Reviews</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                        {stats.review_count > 0
                          ? `Based on ${stats.review_count} review${stats.review_count !== 1 ? 's' : ''}`
                          : 'No reviews yet'}
                      </p>
                    </div>
                    <div className="p-6 md:p-8">
                      {reviews.length === 0 ? (
                        <EmptyState icon="star" title="No reviews yet" message="This provider hasn't received any reviews." variant="compact" />
                      ) : (
                        <div className="space-y-4">
                          {reviews.map((review) => (
                            <div key={review.id} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                                  {review.patient?.full_name || 'Anonymous'}
                                </p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                                  ))}
                                </div>
                              </div>
                              {review.review_text && (
                                <p className="text-sm text-slate-600 dark:text-slate-300">{review.review_text}</p>
                              )}
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Tabs.Content>

                {/* Stats Tab */}
                <Tabs.Content value="stats" className="outline-none">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">Performance Stats</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Provider statistics and history</p>
                    </div>
                    <div className="p-6 md:p-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                          <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.unique_patients}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Patients Served</p>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                          <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.completed_requests}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Completed Requests</p>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                          <Star className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{stats.review_count}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Total Reviews</p>
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                          <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                          <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">{completionRate}%</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Completion Rate</p>
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

export default ProviderProfileView;
