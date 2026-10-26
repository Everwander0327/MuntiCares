import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  MapPin, Calendar, Shield, ShieldCheck, 
  Star, CheckCircle2, Clock, MessageCircle, CalendarDays, ArrowLeft, Users, 
  ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import { ReviewCard } from '@/shared/components';
import { usePresence } from '@/contexts/PresenceContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const getTrustLevel = (score) => {
  if (score >= 90) return { label: 'Highly Trusted', color: 'text-success dark:text-success-dark', bg: 'bg-emerald-500/10' };
  if (score >= 70) return { label: 'Trusted', color: 'text-success dark:text-success-dark', bg: 'bg-green-500/10' };
  if (score >= 40) return { label: 'Developing', color: 'text-warning dark:text-warning-dark', bg: 'bg-amber-500/10' };
  return { label: 'Needs Improvement', color: 'text-danger dark:text-danger-dark', bg: 'bg-rose-500/10' };
};

const ProviderProfileView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isUserOnline } = usePresence();
  const { user } = useAuth();
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [stats, setStats] = useState({
    completed_requests: 0,
    cancelled_requests: 0,
    unique_patients: 0,
    review_count: 0,
  });

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

        if (user?.id) {
          const { data: ongoingReq } = await supabase
            .from('requests')
            .select('id, status')
            .eq('patient_id', user.id)
            .eq('provider_id', id)
            .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived'])
            .maybeSingle();
          setActiveBooking(ongoingReq || null);
        }

        const { data: revData } = await supabase
          .from('provider_reviews')
          .select('*, patient:patient_id(full_name)')
          .eq('provider_id', id)
          .order('created_at', { ascending: false });
        if (revData) setReviews(revData);

        const { data: compRows } = await supabase
          .from('requests')
          .select('patient_id')
          .eq('provider_id', id)
          .eq('status', 'Completed');

        const { count: cancelled } = await supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('provider_id', id)
          .eq('status', 'Cancelled');

        const completed = compRows?.length || 0;
        const uniquePats = new Set((compRows || []).map(r => r.patient_id).filter(Boolean)).size;

        setStats({
          completed_requests: completed,
          cancelled_requests: cancelled || 0,
          unique_patients: uniquePats,
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
  }, [id, navigate, user?.id]);

  useEffect(() => {
    if (!user?.id || !id) return;
    const ch = supabase
      .channel(`provider-profile-booking-${user.id}-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `patient_id=eq.${user.id}` },
        async () => {
          const { data: ongoingReq } = await supabase
            .from('requests')
            .select('id, status')
            .eq('patient_id', user.id)
            .eq('provider_id', id)
            .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived'])
            .maybeSingle();
          setActiveBooking(ongoingReq || null);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, id]);

  if (loading) {
    return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;
  }

  if (!provider) return null;

  const trustLevel = getTrustLevel(provider.trust_score || 0);
  const completionRate = stats.completed_requests + stats.cancelled_requests > 0
    ? Math.round((stats.completed_requests / (stats.completed_requests + stats.cancelled_requests)) * 100)
    : 0;

  const servicesList = provider.services || [];
  const displayedServices = showAllServices ? servicesList : servicesList.slice(0, 4);

  return (
    <DashboardLayout role="patient">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-6 w-full">
        {/* Top Header & Breadcrumb */}
        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/patient/providers')}
            className="neu-btn px-4 py-2.5 rounded-2xl inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-link transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Providers</span>
          </motion.button>
          
          <div className="flex items-center gap-2">
            <span className={`neu-flat-sm inline-flex items-center px-3 py-1.5 rounded-full text-2xs font-extrabold uppercase tracking-wider ${
              isUserOnline(id) 
                ? 'text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10' 
                : 'text-tertiary dark:text-tertiary'
            }`}>
              {isUserOnline(id) ? 'Active Online' : 'Offline'}
            </span>
            {provider.professional_id_status === 'verified' && (
              <span className="neu-flat-sm hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified Practitioner
              </span>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* Compressed Left Sidebar: Exact fit without overflowing */}
          <div className="lg:col-span-5 xl:col-span-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="neu-flat rounded-[2.5rem] overflow-hidden"
            >
              {/* Cover Gradient */}
              <div className="h-20 bg-gradient-to-r from-primary via-primary-600 to-primary-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/10 dark:bg-black/20" />
              </div>

              {/* Avatar & Main Identity */}
              <div className="px-5 -mt-10 relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl neu-flat overflow-hidden p-1 shadow-xl relative">
                  {provider.avatar_url ? (
                    <img src={provider.avatar_url} alt={provider.full_name} className="w-full h-full object-cover rounded-[14px]" />
                  ) : (
                    <div className="w-full h-full rounded-[14px] bg-primary/10 flex items-center justify-center text-2xl font-black text-link">
                      {provider.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                    </div>
                  )}
                  <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${isUserOnline(id) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>

                <h1 className="font-display text-lg font-extrabold text-slate-900 dark:text-white mt-2.5 text-center leading-tight">
                  {provider.full_name}
                </h1>
                
                <div className="flex items-center gap-1.5 mt-1 text-warning">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {(provider.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-tertiary">({stats.review_count} reviews)</span>
                  <span className="text-tertiary">•</span>
                  <span className={`text-xs font-extrabold ${trustLevel.color}`}>
                    {trustLevel.label}
                  </span>
                </div>
              </div>

              {/* Compressed Details Panel */}
              <div className="p-5 space-y-3.5">
                {/* 3 Metric Chips */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="neu-flat-sm p-2 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Rating</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">{(provider.rating || 0).toFixed(1)} ★</p>
                  </div>
                  <div className="neu-flat-sm p-2 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Services</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">{servicesList.length}</p>
                  </div>
                  <div className="neu-flat-sm p-2 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Status</p>
                    <p className={`text-xs font-black mt-1 capitalize ${isUserOnline(id) ? 'text-success' : 'text-tertiary'}`}>
                      {isUserOnline(id) ? 'Active' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Trust Score */}
                <div className="neu-flat-sm p-3 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-link" />
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Trust Score</span>
                    </div>
                    <span className="text-xs font-black tabular-nums text-slate-800 dark:text-slate-200">{provider.trust_score || 0}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        (provider.trust_score || 0) >= 70 ? 'bg-emerald-500' : (provider.trust_score || 0) >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${provider.trust_score || 0}%` }}
                    />
                  </div>
                </div>

                {/* Compact Info Badges */}
                <div className="neu-flat-sm p-3 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-tertiary flex items-center gap-1.5 text-xs">
                      <MapPin className="w-3 h-3 text-link shrink-0" /> Location
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[150px]">{provider.location || 'Muntinlupa City'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-tertiary flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3 h-3 text-link shrink-0" /> Member Since
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                      {new Date(provider.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Call to Actions */}
                <div className="pt-1 space-y-2">
                  {activeBooking ? (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/patient/requests')}
                      className="w-full py-3 rounded-2xl neu-btn font-bold text-xs text-success dark:text-success-dark flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span>{activeBooking.status === 'Pending' ? 'Request Pending — View' : 'Ongoing Visit — Track Live'}</span>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/patient/providers?book=${id}`)}
                      className="w-full py-3 rounded-2xl neu-btn-primary font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <CalendarDays className="w-4 h-4" />
                      <span>Book Appointment</span>
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/patient/messages?provider=${id}&name=${encodeURIComponent(provider.full_name || '')}`)}
                    className="w-full py-2.5 rounded-2xl neu-btn font-bold text-xs text-link flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send Direct Message</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Main Column: Holds Bio, Contact, Services, Stats & Reviews */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            {/* Section 1: About Practitioner & Practice Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="neu-flat p-6 md:p-7 rounded-[2.5rem] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm md:text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    About Practitioner
                  </h2>
                  <p className="text-sm text-tertiary mt-0.5">Licensed Healthcare Practitioner • Muntinlupa Health Network</p>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-primary/10 text-link">
                  Official Provider
                </span>
              </div>

              {/* Unified Bio, Practice & Contact Card */}
              <div className="neu-flat-sm p-4 md:p-5 rounded-2xl space-y-4">
                {/* Bio Statement */}
                <div>
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mb-1">Professional Bio</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {provider.bio || 'Dedicated healthcare practitioner serving families in Muntinlupa.'}
                  </p>
                </div>

                {/* Detail Columns with Border Dividers */}
                <div className="pt-3.5 border-t border-slate-200/60 dark:border-white/5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 dark:divide-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-0">
                  <div className="sm:pr-4">
                    <p className="text-2xs uppercase font-extrabold text-tertiary tracking-wider">Practice Hours</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">Mon – Sat • 9AM – 5PM</p>
                    <p className="text-sm text-tertiary mt-0.5">Walk-ins & appointments</p>
                  </div>
                  <div className="pt-3 sm:pt-0 sm:pl-4">
                    <p className="text-2xs uppercase font-extrabold text-tertiary tracking-wider">Contact Direct</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={provider.email}>
                      {provider.email}
                    </p>
                    <p className="text-sm text-tertiary mt-0.5">{provider.phone || 'Verified on platform'}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Section 2: Offered Medical Services (Collapsible) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="neu-flat p-6 md:p-7 rounded-[2.5rem] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm md:text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Offered Services ({servicesList.length})
                  </h2>
                  <p className="text-sm text-tertiary mt-0.5">Click any service to book directly</p>
                </div>
                {servicesList.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllServices(!showAllServices)}
                    className="neu-btn px-3 py-1.5 rounded-xl text-xs font-extrabold text-link flex items-center gap-1 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                  >
                    {showAllServices ? (
                      <>Show Less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Show All ({servicesList.length}) <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedServices.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (activeBooking) {
                        toast(
                          activeBooking.status === 'Pending'
                            ? 'You already have a pending booking request with this provider. View it in My Requests.'
                            : `You already have an ongoing visit (${activeBooking.status}) with this provider. Track it in My Requests.`,
                          { icon: 'ℹ️' }
                        );
                        navigate('/patient/requests');
                        return;
                      }
                      navigate(`/patient/providers?book=${id}&service=${encodeURIComponent(s)}`);
                    }}
                    className="neu-btn p-3.5 rounded-2xl flex items-center justify-between text-left hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-link transition-colors truncate">{s}</p>
                      <p className="text-xs text-tertiary">Available for appointment</p>
                    </div>
                  </button>
                ))}
                {servicesList.length === 0 && (
                  <p className="text-xs text-tertiary italic py-3 col-span-2 text-center">General consultation service only.</p>
                )}
              </div>
            </motion.div>

            {/* Section 3: Performance Statistics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="neu-flat p-6 md:p-7 rounded-[2.5rem] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm md:text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Performance Statistics
                  </h2>
                  <p className="text-sm text-tertiary mt-0.5">Verified track record on MuntiCares</p>
                </div>
                <Activity className="w-4 h-4 text-link" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="neu-flat-sm p-3 rounded-2xl text-center">
                  <Users className="w-4 h-4 text-link mx-auto mb-1" />
                  <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{stats.unique_patients}</p>
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mt-0.5">Patients Served</p>
                </div>
                <div className="neu-flat-sm p-3 rounded-2xl text-center">
                  <CheckCircle2 className="w-4 h-4 text-success mx-auto mb-1" />
                  <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{stats.completed_requests}</p>
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mt-0.5">Completed Visits</p>
                </div>
                <div className="neu-flat-sm p-3 rounded-2xl text-center">
                  <Star className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{stats.review_count}</p>
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mt-0.5">Total Reviews</p>
                </div>
                <div className="neu-flat-sm p-3 rounded-2xl text-center">
                  <Clock className="w-4 h-4 text-link mx-auto mb-1" />
                  <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{completionRate}%</p>
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mt-0.5">Completion Rate</p>
                </div>
              </div>
            </motion.div>

            {/* Section 4: Patient Reviews */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="neu-flat p-6 md:p-7 rounded-[2.5rem] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm md:text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                    Patient Reviews
                  </h2>
                  <p className="text-sm text-tertiary mt-0.5">Feedback from verified appointments</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center text-warning">
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="font-display text-base font-black text-slate-900 dark:text-white">
                    {(provider.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs text-tertiary">({reviews.length})</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <ReviewCard key={rev.id} review={rev} variant="bordered" />
                  ))
                ) : (
                  <div className="neu-inset p-6 rounded-2xl text-center border border-slate-200/50 dark:border-white/5">
                    <EmptyState icon="star" title="No reviews yet" message="This healthcare provider has not received any reviews yet." variant="compact" />
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

export default ProviderProfileView;
