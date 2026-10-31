import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  CheckCircle2, MessageCircle, CalendarDays, ArrowLeft,
  ChevronDown, ChevronUp
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
  const displayedServices = showAllServices ? servicesList : servicesList.slice(0, 6);
  const online = isUserOnline(id);

  return (
    <DashboardLayout role="patient">
      <div className="w-full max-w-full space-y-5 md:space-y-6 pb-8">
        {/* Top Bar: Back Button */}
        <div className="flex items-center justify-between gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/patient/providers')}
            className="neu-btn px-4 py-2.5 rounded-2xl inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-link transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Providers</span>
          </motion.button>
        </div>

        {/* 1. Unified Top Hero Profile Banner (Option 1) */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="neu-flat rounded-3xl p-5 sm:p-7 md:p-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Avatar + Identity */}
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl neu-flat-sm overflow-hidden p-1 shadow-sm relative shrink-0">
                {provider.avatar_url ? (
                  <img src={provider.avatar_url} alt={provider.full_name} className="w-full h-full object-cover rounded-[12px]" />
                ) : (
                  <div className="w-full h-full rounded-[12px] bg-primary/10 flex items-center justify-center text-xl sm:text-2xl font-black text-link">
                    {provider.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'P'}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {provider.full_name}
                  </h1>
                </div>

                <p className="text-xs sm:text-sm font-medium text-txt-secondary dark:text-txt-darkSecondary">
                  {provider.location || 'Muntinlupa City'} &bull; Mon–Sat, 9:00 AM – 5:00 PM &bull; Member since {new Date(provider.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>

                <p className="text-xs text-tertiary truncate">
                  {provider.email}{provider.phone ? ` • ${provider.phone}` : ''}
                </p>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/patient/messages?provider=${id}&name=${encodeURIComponent(provider.full_name || '')}`)}
                className="px-4 py-3 rounded-2xl neu-btn font-bold text-xs sm:text-sm text-link flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Send Message</span>
              </motion.button>

              {activeBooking ? (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/patient/requests')}
                  className="px-5 py-3 rounded-2xl neu-btn font-bold text-xs sm:text-sm text-success dark:text-success-dark flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>{activeBooking.status === 'Pending' ? 'Request Pending — View' : 'Ongoing Visit — Track Live'}</span>
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/patient/providers?book=${id}`)}
                  className="px-5 py-3 rounded-2xl neu-btn-primary font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>Book Appointment</span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Bio Row */}
          <div className="mt-5 pt-5 border-t border-slate-200/70 dark:border-white/10">
            <p className="text-2xs font-extrabold uppercase tracking-widest text-tertiary mb-1.5">
              About Practitioner
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-4xl">
              {provider.bio || 'Dedicated healthcare practitioner serving families in Muntinlupa City.'}
            </p>
          </div>
        </motion.section>

        {/* 2. 4-KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          <div className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Trust Score</span>
              <span className={`text-2xs font-extrabold ${trustLevel.color}`}>{trustLevel.label}</span>
            </div>
            <p className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-2">
              {provider.trust_score || 0}<span className="text-xs font-bold text-tertiary">/100</span>
            </p>
            <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden mt-2.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  (provider.trust_score || 0) >= 70 ? 'bg-emerald-500' : (provider.trust_score || 0) >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                }`}
                style={{ width: `${provider.trust_score || 0}%` }}
              />
            </div>
          </div>

          <div className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Overall Rating</span>
            <p className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-2">
              {(provider.rating || 0).toFixed(1)} <span className="text-amber-400">★</span>
            </p>
            <p className="text-xs text-tertiary mt-1">{stats.review_count} verified reviews</p>
          </div>

          <div className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Completed Visits</span>
            <p className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-2">
              {stats.completed_requests}
            </p>
            <p className="text-xs text-tertiary mt-1">{stats.unique_patients} patients served</p>
          </div>

          <div className="neu-flat rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Success Rate</span>
            <p className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-2">
              {completionRate}%
            </p>
            <p className="text-xs text-tertiary mt-1">Visit completion rate</p>
          </div>
        </div>

        {/* 3. 2-Column Split: Offered Services (Left) + Patient Reviews (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">
          {/* Left Column: Offered Services */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-5 neu-flat p-5 sm:p-7 rounded-3xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Offered Services ({servicesList.length})
                </h2>
                <p className="text-xs text-tertiary mt-0.5">Select any service to book directly</p>
              </div>
              {servicesList.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllServices(!showAllServices)}
                  className="neu-btn px-3 py-1.5 rounded-xl text-xs font-extrabold text-link flex items-center gap-1 cursor-pointer"
                >
                  {showAllServices ? (
                    <>Less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>All ({servicesList.length}) <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
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
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-link transition-colors truncate">
                      {s}
                    </p>
                    <p className="text-xs text-tertiary mt-0.5">Available for home visit</p>
                  </div>
                  <span className="text-xs font-extrabold text-link shrink-0 group-hover:translate-x-0.5 transition-transform">
                    Book &rarr;
                  </span>
                </button>
              ))}
              {servicesList.length === 0 && (
                <p className="text-xs text-tertiary italic py-4 text-center">
                  General consultation service available.
                </p>
              )}
            </div>
          </motion.section>

          {/* Right Column: Verified Patient Reviews */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-7 neu-flat p-5 sm:p-7 rounded-3xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Patient Reviews ({reviews.length})
                </h2>
                <p className="text-xs text-tertiary mt-0.5">Feedback from verified home visits</p>
              </div>
            </div>

            <div className="space-y-3">
              {reviews.length > 0 ? (
                reviews.map((rev) => (
                  <ReviewCard key={rev.id} review={rev} variant="bordered" />
                ))
              ) : (
                <div className="neu-inset p-6 rounded-2xl text-center border border-slate-200/50 dark:border-white/5">
                  <EmptyState
                    icon="star"
                    title="No reviews yet"
                    message="This healthcare provider has not received any patient reviews yet."
                    variant="compact"
                  />
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderProfileView;
