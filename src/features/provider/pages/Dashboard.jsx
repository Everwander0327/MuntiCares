import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Clock, Users, CheckCircle, Check, X, Calendar, ChevronRight, ChevronLeft,
  Star, MessageCircle, ArrowRight, ArrowUpRight, Activity, Sparkles, 
  UserCheck, Stethoscope, CheckCircle2, Navigation, Home, MessageSquare, 
  Search, FileText, RotateCcw, AlertCircle, ShieldCheck, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '@/hooks/useCountUp';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import { ReviewCard } from '@/shared/components';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const providerHighlights = [
  {
    id: 1,
    tag: 'Care Protocol',
    title: 'Muntinlupa Citywide Home Care Network',
    description: 'Ensure accurate biometric tracking, update digital patient records on-site, and follow standard hygiene protocol during home visits.',
    image: '/images/carousel/provider-home-visit.jpg',
  },
  {
    id: 2,
    tag: 'Barangay Outreach',
    title: 'Community Mobile Clinic & Senior Care',
    description: 'Coordinate with local barangay health stations for priority scheduling and maintenance medicine distribution.',
    image: '/images/carousel/mobile-clinic.jpg',
  },
  {
    id: 3,
    tag: 'Clinical Support',
    title: 'Compassionate Physical Therapy & Home Care',
    description: 'Gentle rehabilitation and vitals logging for bedridden seniors and post-operative recovery patients across Muntinlupa.',
    image: '/images/carousel/home-care.jpg',
  },
  {
    id: 4,
    tag: 'Digital Health',
    title: 'FHIR Health Records & Unified Patient Consent',
    description: 'Review patient medical histories, lab records, and doctor notes safely governed by city patient data privacy policies.',
    image: '/images/carousel/provider-digital-records.jpg',
  },
];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const StatItem = ({ label, value, icon, iconColor }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1200, false);

  return (
    <div className="flex items-center gap-3.5 sm:gap-4 p-2 transition-all">
      <div className="neu-flat-sm w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center p-3 shrink-0">
        {React.cloneElement(icon, { className: `w-5 h-5 sm:w-6 sm:h-6 ${iconColor}` })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wide truncate">
          {label}
        </p>
        <p className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mt-0.5 leading-none" ref={ref}>
          {count}
        </p>
      </div>
    </div>
  );
};

const STATUS_FLOW = {
  Accepted: { next: 'On The Way', icon: <Navigation className="w-4 h-4" />, label: 'Start Travel (On The Way)', color: 'neu-btn-primary text-white' },
  'On The Way': { next: 'Arrived', icon: <Home className="w-4 h-4" />, label: 'Mark Arrived on Site', color: 'neu-btn bg-amber-500 text-white hover:bg-amber-600' },
  Arrived: { next: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Complete Home Visit', color: 'neu-btn bg-emerald-600 text-white hover:bg-emerald-700' },
};

const ProviderDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  const [updatingVisitId, setUpdatingVisitId] = useState(null);
  
  const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0 });
  const [activeVisit, setActiveVisit] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination states
  const [requestsPage, setRequestsPage] = useState(1);
  const REQUESTS_PER_PAGE = 4;
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 4;

  // Carousel State & Touch/Drag handlers
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const carouselTrackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const isInteractingRef = useRef(false);

  const { user } = useAuth();

  const scrollToSlide = (index) => {
    if (carouselTrackRef.current) {
      const width = carouselTrackRef.current.clientWidth;
      carouselTrackRef.current.scrollTo({
        left: width * index,
        behavior: 'smooth',
      });
      setCurrentSlide(index);
    }
  };

  const handleCarouselScroll = () => {
    if (carouselTrackRef.current) {
      const width = carouselTrackRef.current.clientWidth;
      if (width > 0) {
        const slide = Math.round(carouselTrackRef.current.scrollLeft / width);
        if (slide !== currentSlide && slide >= 0 && slide < providerHighlights.length) {
          setCurrentSlide(slide);
        }
      }
    }
  };

  // Carousel auto-advance
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      if (!isInteractingRef.current) {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % providerHighlights.length;
          scrollToSlide(next);
          return next;
        });
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const onMouseDownTrack = (e) => {
    isDraggingRef.current = true;
    isInteractingRef.current = true;
    dragStartXRef.current = e.pageX - carouselTrackRef.current.offsetLeft;
    dragScrollLeftRef.current = carouselTrackRef.current.scrollLeft;
  };

  const onMouseMoveTrack = (e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselTrackRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.5;
    carouselTrackRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const onMouseUpTrack = () => {
    isDraggingRef.current = false;
    setTimeout(() => { isInteractingRef.current = false; }, 2000);
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('id, patient_id, service, date, time, status, created_at, notes, price, patient:patient_id(full_name, avatar_url)')
        .eq('provider_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;

      const allRequests = data || [];

      // Calculate stats
      const todayStr = new Date().toLocaleDateString('en-CA');
      const pendingCount = allRequests.filter(r => r.status === 'Pending').length;
      const activeCount = allRequests.filter(r => 
        ['On The Way', 'Arrived'].includes(r.status) ||
        (r.status === 'Accepted' && (!r.date || r.date >= todayStr))
      ).length;
      const completedCount = allRequests.filter(r => r.status === 'Completed').length;

      setStats({
        pending: pendingCount,
        active: activeCount,
        completed: completedCount
      });

      // Find current active visit (priority: 'On The Way' > 'Arrived' > next upcoming 'Accepted')
      // Only show visits for today or future dates (past dates are excluded so expired/done visits don't linger)
      const activeVisitsList = allRequests.filter(r => 
        ['On The Way', 'Arrived', 'Accepted'].includes(r.status) &&
        (!r.date || r.date >= todayStr)
      );

      let ongoing = activeVisitsList.find(r => r.status === 'On The Way')
        || activeVisitsList.find(r => r.status === 'Arrived')
        // For accepted visits, get the earliest upcoming appointment
        || [...activeVisitsList.filter(r => r.status === 'Accepted')].sort((a, b) => {
          const dateComp = (a.date || '').localeCompare(b.date || '');
          if (dateComp !== 0) return dateComp;
          return (a.time || '').localeCompare(b.time || '');
        })[0]
        || null;

      if (ongoing) {
        let timeLabel = '';
        try {
          if (ongoing.time) {
            timeLabel = new Date(`2000-01-01T${ongoing.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch { timeLabel = ongoing.time || ''; }

        // Fetch patient address
        let patAddress = 'Muntinlupa City';
        if (ongoing.patient_id) {
          const { data: patProfile } = await supabase
            .from('patients')
            .select('address')
            .eq('user_id', ongoing.patient_id)
            .maybeSingle();
          if (patProfile?.address) patAddress = patProfile.address;
        }

        setActiveVisit({
          id: ongoing.id,
          patientId: ongoing.patient_id,
          patient: ongoing.patient?.full_name || 'Patient',
          patientAvatarUrl: ongoing.patient?.avatar_url || '',
          service: ongoing.service,
          date: new Date(ongoing.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: timeLabel,
          status: ongoing.status,
          address: patAddress,
          notes: ongoing.notes || '',
        });
      } else {
        setActiveVisit(null);
      }

      // Recent requests formatted (store all up to 20 for in-card pagination)
      setRecentRequests(allRequests.slice(0, 20).map(r => ({
        id: r.id,
        patientId: r.patient_id,
        patient: r.patient?.full_name || 'Unknown Patient',
        patientAvatarUrl: r.patient?.avatar_url || '',
        service: r.service,
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: r.status,
        notes: r.notes || '',
      })));

      // Fetch reviews (up to 20 for in-card pagination)
      const { data: reviewData } = await supabase
        .from('provider_reviews')
        .select('id, rating, review_text, created_at, patient:patient_id(full_name, avatar_url)')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setReviews(reviewData || []);

    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let channel;
    if (user) {
      fetchDashboardData();

      channel = supabase
        .channel('provider-dashboard-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requests', filter: `provider_id=eq.${user.id}` },
          () => fetchDashboardData()
        )
        .subscribe();
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  // Unread messages
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('messages')
        .select('id, is_read')
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .gte('created_at', yesterday);
      let readIds = new Set();
      try {
        readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
      } catch {}
      const count = (data || []).filter(m => !m.is_read && !readIds.has(m.id)).length;
      setUnreadCount(count);
    };
    fetchUnread();

    const channel = supabase
      .channel(`provider-dashboard-unread-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => fetchUnread()
      )
      .subscribe();

    const onMessagesRead = () => fetchUnread();
    window.addEventListener('messages-read', onMessagesRead);

    return () => {
      window.removeEventListener('messages-read', onMessagesRead);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Quick Action on Request (Accept / Reject)
  const handleQuickAction = async (id, action) => {
    setActionStates(prev => ({ ...prev, [id]: action }));
    try {
      const newStatus = action === 'accepted' ? 'Accepted' : 'Rejected';
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(action === 'accepted' ? 'Request accepted!' : 'Request declined.');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update request.');
    } finally {
      setActionStates(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Live Visit Stepper update
  const handleAdvanceVisit = async (visitId, nextStatus) => {
    setUpdatingVisitId(visitId);
    try {
      const payload = { status: nextStatus };
      const nowIso = new Date().toISOString();
      if (nextStatus === 'On The Way') payload.route_started_at = nowIso;
      if (nextStatus === 'Arrived') payload.arrived_at = nowIso;

      const { error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', visitId);

      if (error) throw error;
      toast.success(`Visit updated to "${nextStatus === 'On The Way' ? 'On Route' : nextStatus}"!`);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update visit status.');
    } finally {
      setUpdatingVisitId(null);
    }
  };

  const providerName = user?.user_metadata?.full_name?.split(' ')[0] || 'Doctor';

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];
  const STEP_LABELS = ['Confirmed', 'On Route', 'Arrived', 'Done'];
  const STEP_ICONS = [
    <CheckCircle2 key="confirmed" className="w-4 h-4" />,
    <Navigation key="enroute" className="w-4 h-4" />,
    <Home key="arrived" className="w-4 h-4" />,
    <Stethoscope key="done" className="w-4 h-4" />,
  ];

  const currentStep = activeVisit ? STATUS_STEPS.indexOf(activeVisit.status) : -1;

  const STATUS_MESSAGES = {
    Accepted: 'You confirmed this visit. Head to the patient address at the scheduled appointment time.',
    'On The Way': 'You are currently on route to the patient location. Patient has been notified.',
    Arrived: 'You are on-site at the patient home. Conduct care and logging.',
    Completed: 'Home care visit is fully rendered and logged in the city records.',
  };

  return (
    <DashboardLayout role="provider">
      <div className="space-y-4 sm:space-y-6 md:space-y-7 pb-10">

        {/* HERO ROW: CAROUSEL (7 cols) + QUICK ACTIONS (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          
          {/* Hero Carousel (lg:col-span-7) */}
          <section
            className="lg:col-span-7 neu-flat rounded-2xl sm:rounded-[2.25rem] relative overflow-hidden flex flex-col justify-between min-h-[380px] sm:min-h-[440px] lg:min-h-[480px]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Background Carousel Track */}
            <div className="absolute inset-0 z-0">
              <div
                ref={carouselTrackRef}
                onScroll={handleCarouselScroll}
                onMouseDown={onMouseDownTrack}
                onMouseMove={onMouseMoveTrack}
                onMouseUp={onMouseUpTrack}
                onMouseLeave={onMouseUpTrack}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-x overscroll-x-contain"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
              >
                {providerHighlights.map((slide) => (
                  <div
                    key={slide.id}
                    className="w-full flex-shrink-0 h-full relative snap-center overflow-hidden"
                  >
                    <img
                      src={slide.image}
                      alt={slide.title}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/20 pointer-events-none" />

                    <div className="absolute inset-0 p-5 sm:p-7 md:p-8 flex flex-col justify-end pointer-events-none pb-28 sm:pb-32 lg:pb-36">
                      <div className="space-y-1.5 sm:space-y-2 max-w-xl">
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-black text-white drop-shadow-md line-clamp-2 leading-tight">
                          {slide.title}
                        </h3>
                        <p className="text-2xs sm:text-xs md:text-sm text-slate-200 line-clamp-2 leading-relaxed drop-shadow-sm font-medium">
                          {slide.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Controls: Dots + Action Buttons */}
            <div className="relative z-10 p-4 sm:p-6 space-y-3 mt-auto">
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1.5 py-1">
                  {providerHighlights.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToSlide(idx);
                      }}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                        currentSlide === idx ? 'w-3.5 bg-white shadow-xs' : 'w-1 bg-white/40 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full">
                <Link
                  to="/provider/schedule"
                  className="btn-glass-neu-primary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white" />
                  <span className="truncate">My Schedule</span>
                </Link>
                <Link
                  to="/provider/requests"
                  className="btn-glass-neu-secondary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
                  <span className="truncate">Manage Requests</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Quick Actions Card with Combined Request Status on Top (lg:col-span-5) */}
          <div className="lg:col-span-5 neu-flat rounded-2xl sm:rounded-[2.25rem] p-5 sm:p-6 flex flex-col justify-start gap-5">
            <div>
              {/* Horizontal Status Strip */}
              <div className="mb-4 pb-4 border-b border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-display font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Patient Requests
                  </h4>
                  <Link
                    to="/provider/requests"
                    className="text-3xs font-bold text-primary hover:text-primary-600 dark:hover:text-primary-300 transition-colors inline-flex items-center gap-0.5"
                  >
                    View all &rarr;
                  </Link>
                </div>

                {/* Compact Live Status Pill (Style A) or Empty State */}
                {activeVisit ? (
                  <Link
                    to="/provider/schedule"
                    className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold mr-1.5 uppercase tracking-wide text-3xs">
                          {activeVisit.status}:
                        </span>
                        {activeVisit.patient} &bull; {activeVisit.service}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-primary text-3xs font-semibold">
                      <span className="hidden sm:inline">{activeVisit.time || 'Today'}</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ) : (
                  <div className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between gap-2 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-slate-400">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      <p className="text-3xs sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                        No active or upcoming visits scheduled today
                      </p>
                    </div>
                    <Link
                      to="/provider/requests"
                      className="text-3xs font-bold text-primary hover:underline shrink-0"
                    >
                      Check requests
                    </Link>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl neu-flat-sm select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-blue-600 dark:text-blue-400 leading-none">
                      {stats.active}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider mt-1.5">
                      Active
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl neu-flat-sm select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-amber-600 dark:text-amber-400 leading-none">
                      {stats.pending}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider mt-1.5">
                      Pending
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl neu-flat-sm select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-emerald-600 dark:text-emerald-400 leading-none">
                      {stats.completed}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider mt-1.5">
                      Done
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions List */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-display font-extrabold text-slate-900 dark:text-white">
                  Quick Actions
                </h3>
              </div>

              <div className="space-y-2.5">
                <Link
                  to="/provider/schedule"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">Today's Schedule</span>
                    <span className="block text-[11px] text-slate-400 truncate">View calendar & bookings</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/provider/requests"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">Incoming Requests {stats.pending > 0 && `(${stats.pending})`}</span>
                    <span className="block text-[11px] text-slate-400 truncate">Accept or decline visits</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/provider/messages"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform relative">
                    <MessageCircle className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-3xs font-extrabold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">
                      Messages {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">Chat with active patients</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>
          </div>

        </div>

        {/* RECENT REQUESTS LIST (MATCHING PATIENT RECENT REQUESTS TABLE / CARDS) */}
        <section className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-3.5 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200/50 dark:border-white/5">
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                Recent Patient Requests
              </h2>
              <p className="text-3xs sm:text-xs text-slate-500 mt-0.5">
                {recentRequests.length > 0 
                  ? `Page ${requestsPage} of ${Math.ceil(recentRequests.length / REQUESTS_PER_PAGE)} (${recentRequests.length} total)` 
                  : 'No requests recorded'}
              </p>
            </div>

            {recentRequests.length > REQUESTS_PER_PAGE && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                  disabled={requestsPage === 1}
                  className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-3xs font-extrabold text-slate-500 px-1 select-none">
                  {requestsPage} / {Math.ceil(recentRequests.length / REQUESTS_PER_PAGE)}
                </span>
                <button
                  type="button"
                  onClick={() => setRequestsPage(p => Math.min(Math.ceil(recentRequests.length / REQUESTS_PER_PAGE), p + 1))}
                  disabled={requestsPage >= Math.ceil(recentRequests.length / REQUESTS_PER_PAGE)}
                  className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {recentRequests.length > 0 ? (
            <div className="space-y-2 sm:space-y-2.5">
              {recentRequests
                .slice((requestsPage - 1) * REQUESTS_PER_PAGE, requestsPage * REQUESTS_PER_PAGE)
                .map((req) => (
                <div
                  key={req.id}
                  className="neu-flat-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:translate-x-0.5 transition-all"
                >
                  <Link
                    to={`/provider/patients/${req.patientId}/profile`}
                    className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 group"
                  >
                    <div className="neu-flat-sm w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center text-xs font-black text-primary shrink-0 p-0.5">
                      {req.patientAvatarUrl ? (
                        <img src={req.patientAvatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        (req.patient || 'P')[0]
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors truncate">
                        {req.patient}
                      </p>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-3xs sm:text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-primary truncate max-w-[130px] sm:max-w-none">{req.service}</span>
                        <span>&bull;</span>
                        <span className="shrink-0">{req.date}</span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between sm:justify-end gap-2 self-stretch sm:self-center pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-white/5">
                    {/* Clean Neumorphic Status Badges (No Dots) */}
                    {req.status === 'Completed' && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 shadow-xs">
                        Completed
                      </span>
                    )}
                    {req.status === 'Pending' && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 shadow-xs">
                        Pending
                      </span>
                    )}
                    {['Accepted', 'On The Way', 'Arrived'].includes(req.status) && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 shadow-xs">
                        {req.status}
                      </span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30 shadow-xs">
                        Rejected
                      </span>
                    )}
                    {req.status === 'Cancelled' && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-white/10 shadow-xs">
                        Cancelled
                      </span>
                    )}
                    {!['Completed', 'Pending', 'Accepted', 'On The Way', 'Arrived', 'Rejected', 'Cancelled'].includes(req.status) && (
                      <span className="neu-flat-sm inline-flex items-center px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500 bg-slate-200/50">
                        {req.status}
                      </span>
                    )}

                    {req.status === 'Pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAction(req.id, 'accepted')}
                          disabled={!!actionStates[req.id]}
                          className="neu-btn px-2.5 py-1 rounded-lg text-3xs font-bold text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAction(req.id, 'rejected')}
                          disabled={!!actionStates[req.id]}
                          className="neu-btn px-2.5 py-1 rounded-lg text-3xs font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="neu-flat-sm p-8 rounded-2xl text-center">
              <div className="neu-flat w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No Recent Requests</p>
              <p className="text-3xs sm:text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                No patient requests or visit bookings at the moment.
              </p>
            </div>
          )}
        </section>

        {/* RECENT PATIENT REVIEWS & FEEDBACK */}
        <section className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-[2.25rem] space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-white/5">
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                Patient Reviews & Feedback
              </h3>
              <p className="text-3xs sm:text-xs text-slate-400">
                {reviews.length > 0
                  ? `Page ${reviewsPage} of ${Math.ceil(reviews.length / REVIEWS_PER_PAGE)} (${reviews.length} reviews)`
                  : 'Ratings submitted by verified patients'}
              </p>
            </div>

            {reviews.length > REVIEWS_PER_PAGE && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                  disabled={reviewsPage === 1}
                  className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-3xs font-extrabold text-slate-500 px-1 select-none">
                  {reviewsPage} / {Math.ceil(reviews.length / REVIEWS_PER_PAGE)}
                </span>
                <button
                  type="button"
                  onClick={() => setReviewsPage(p => Math.min(Math.ceil(reviews.length / REVIEWS_PER_PAGE), p + 1))}
                  disabled={reviewsPage >= Math.ceil(reviews.length / REVIEWS_PER_PAGE)}
                  className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-all cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            {reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {reviews
                  .slice((reviewsPage - 1) * REVIEWS_PER_PAGE, reviewsPage * REVIEWS_PER_PAGE)
                  .map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <div className="neu-flat-sm p-6 sm:p-8 rounded-2xl text-center">
                <Star className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">No patient reviews yet</p>
                <p className="text-3xs text-slate-400 mt-0.5">Ratings and comments left by patients will display here.</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
};

export default ProviderDashboard;
