
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { parseLocalDate } from '@/lib/localDate';
import { 
  Calendar, ChevronRight, ChevronLeft,
  Star, MessageCircle, ArrowRight,
  Stethoscope, CheckCircle2, Navigation, Home,
  FileText, Clock, MessageSquare,
  Filter, ChevronDown, Check, Search, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { Link } from 'react-router-dom';
import useCountUp from '@/hooks/useCountUp';
import { SkeletonPage } from '@/shared/ui';
import { ReviewCard } from '@/shared/components';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import PatientRecordModal from '../components/PatientRecordModal';

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

const _staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const _staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

const _StatItem = ({ label, value, icon, iconColor }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1200, false);

  return (
    <div className="flex items-center gap-3.5 sm:gap-4 p-2 transition-all">
      <div className="neu-flat-sm w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center p-3 shrink-0">
        {React.cloneElement(icon, { className: `w-5 h-5 sm:w-6 sm:h-6 ${iconColor}` })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-tertiary dark:text-tertiary text-xs font-semibold tracking-wide truncate">
          {label}
        </p>
        <p className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mt-0.5 leading-none" ref={ref}>
          {count}
        </p>
      </div>
    </div>
  );
};

const _STATUS_FLOW = {
  Accepted: { next: 'On The Way', icon: <Navigation className="w-4 h-4" />, label: 'Start Travel (On The Way)', color: 'neu-btn-primary text-white' },
  'On The Way': { next: 'Arrived', icon: <Home className="w-4 h-4" />, label: 'Mark Arrived on Site', color: 'neu-btn bg-amber-500 text-white hover:bg-amber-600' },
  Arrived: { next: 'Completed', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Complete Home Visit', color: 'neu-btn bg-emerald-600 text-white hover:bg-emerald-700' },
};

const getStatusBadge = (status, rawStatus) => {
  const displayStatus = rawStatus || status;
  if (status === 'Completed' || displayStatus === 'Completed') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-success dark:text-success-dark bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30">
        Completed
      </span>
    );
  }
  if (['Arrived', 'On The Way', 'Accepted', 'Active'].includes(displayStatus) || status === 'Active') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-link dark:text-primary-300 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30">
        {displayStatus}
      </span>
    );
  }
  if (displayStatus === 'Pending') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-warning dark:text-warning-dark bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30">
        Pending
      </span>
    );
  }
  if (displayStatus === 'Rejected') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-danger dark:text-danger-dark bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/30">
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-2xs font-extrabold uppercase tracking-wider text-tertiary bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-white/10">
      {displayStatus}
    </span>
  );
};

const ProviderDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState({});
  
  const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0 });
  const [activeVisit, setActiveVisit] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Patient Medical Record & Chart Modal state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const recordTriggerRef = useRef(null);

  const handleOpenRecord = (patientId, patientName, avatarUrl = '', triggerEl = null) => {
    recordTriggerRef.current = triggerEl;
    setSelectedPatient({ id: patientId, name: patientName, avatarUrl });
    setIsRecordModalOpen(true);
  };

  // Pagination & Filter Dropdown states
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsFilter, setRequestsFilter] = useState('all');
  const [requestsSearch, setRequestsSearch] = useState('');
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);
  const requestsDropdownRef = useRef(null);
  const REQUESTS_PER_PAGE = 4;
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 3;

  // Close requests filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (requestsDropdownRef.current && !requestsDropdownRef.current.contains(event.target)) {
        setShowRequestsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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
        .select('id, patient_id, service, date, time, status, created_at, notes, patient:patient_id(full_name, avatar_url)')
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
      setRecentRequests(allRequests.slice(0, 20).map(r => {
        let formattedTime = '';
        try {
          if (r.time) {
            formattedTime = new Date(`2000-01-01T${r.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          }
        } catch { formattedTime = r.time || ''; }

        return {
          id: r.id,
          patientId: r.patient_id,
          patient: r.patient?.full_name || 'Unknown Patient',
          patientAvatarUrl: r.patient?.avatar_url || '',
          service: r.service,
          date: parseLocalDate(r.date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || 'Unscheduled',
          time: formattedTime,
          status: r.status,
          notes: r.notes || '',
        };
      }));

      // Fetch reviews (up to 20 for in-card pagination)
      const { data: reviewData } = await supabase
        .from('provider_reviews')
        .select('id, rating, review_text, created_at, patient_id, request_id, patient:patient_id(full_name, avatar_url)')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const enrichedReviews = (reviewData || []).map((rev) => {
        const reqMatch = allRequests.find((r) => r.id === rev.request_id || r.patient_id === rev.patient_id);
        const serviceName = reqMatch?.service || 'Wound Care';
        const pId = rev.patient_id || reqMatch?.patient_id || '';
        const pName = rev.patient?.full_name || reqMatch?.patient?.full_name || 'Patient';
        return {
          ...rev,
          service: serviceName,
          patientId: pId,
          contactUrl: pId ? `/provider/messages?partner=${pId}&name=${encodeURIComponent(pName)}` : '/provider/messages',
        };
      });
      setReviews(enrichedReviews);

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

  const _providerName = user?.user_metadata?.full_name?.split(' ')[0] || 'Doctor';

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];
  const _STEP_LABELS = ['Confirmed', 'On Route', 'Arrived', 'Done'];
  const _STEP_ICONS = [
    <CheckCircle2 key="confirmed" className="w-4 h-4" />,
    <Navigation key="enroute" className="w-4 h-4" />,
    <Home key="arrived" className="w-4 h-4" />,
    <Stethoscope key="done" className="w-4 h-4" />,
  ];

  const _currentStep = activeVisit ? STATUS_STEPS.indexOf(activeVisit.status) : -1;

  const _STATUS_MESSAGES = {
    Accepted: 'You confirmed this visit. Head to the patient address at the scheduled appointment time.',
    'On The Way': 'You are currently on route to the patient location. Patient has been notified.',
    Arrived: 'You are on-site at the patient home. Conduct care and logging.',
    Completed: 'Home care visit is fully rendered and logged in the city records.',
  };

  const filteredRequests = recentRequests.filter(req => {
    const matchesSearch = !requestsSearch.trim() || 
      (req.patient && req.patient.toLowerCase().includes(requestsSearch.toLowerCase())) || 
      (req.service && req.service.toLowerCase().includes(requestsSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (requestsFilter === 'all') return true;
    if (requestsFilter === 'completed') return req.status === 'Completed';
    if (requestsFilter === 'accepted') return ['Accepted', 'On The Way', 'Arrived'].includes(req.status);
    if (requestsFilter === 'pending') return req.status === 'Pending';
    return true;
  });

  const totalRequestsPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE));
  const pagedRequests = filteredRequests.slice((requestsPage - 1) * REQUESTS_PER_PAGE, requestsPage * REQUESTS_PER_PAGE);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)
    : '0.0';

  const starCounts = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => Math.round(Number(r.rating) || 5) === stars).length;
    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { stars, count, pct };
  });

  const totalReviewsPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const pagedReviews = reviews.slice((reviewsPage - 1) * REVIEWS_PER_PAGE, reviewsPage * REVIEWS_PER_PAGE);

  return (
    <DashboardLayout role="provider">
      <div className="space-y-4 sm:space-y-6 md:space-y-7 pb-10">

        {/* HERO ROW: CAROUSEL (7 cols) + QUICK ACTIONS (5 cols) */}
        <h1 className="sr-only">Dashboard</h1>
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
                        <p className="text-sm text-slate-200 line-clamp-2 leading-relaxed drop-shadow-sm font-medium">
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
                        currentSlide === idx ? 'w-3.5 bg-white shadow-sm' : 'w-1 bg-white/40 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3.5 w-full">
                <Link
                  to="/provider/schedule"
                  className="neu-btn-primary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer shadow-lg shadow-blue-950/40 text-white"
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white" />
                  <span className="truncate">My Schedule</span>
                </Link>
                <Link
                  to="/provider/requests"
                  className="btn-glass-neu-secondary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer text-white"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
                  <span className="truncate">Manage Requests</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Quick Actions Card with Combined Request Status on Top (lg:col-span-5) */}
          <div className="lg:col-span-5 neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 flex flex-col justify-start gap-4 sm:gap-5">
            <div>
              {/* Horizontal Status Strip */}
              <div className="mb-3.5 pb-3.5 border-b border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-display font-extrabold uppercase tracking-wider text-tertiary dark:text-tertiary">
                    Patient Requests
                  </h4>
                  <Link
                    to="/provider/requests"
                    className="text-xs font-bold text-link hover:text-primary-600 dark:hover:text-primary-300 transition-colors inline-flex items-center gap-0.5"
                  >
                    View all &rarr;
                  </Link>
                </div>

                {/* Priority Active Card with Live Beacon or Clean Empty State */}
                {activeVisit ? (
                  <Link
                    to="/provider/schedule"
                    className="mb-3 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col gap-1.5 sm:gap-2 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-2xs font-black text-success dark:text-success-dark uppercase tracking-wider">
                          {activeVisit.status} Visit
                        </span>
                      </div>
                      <span className="text-2xs sm:text-xs font-bold text-success dark:text-success-dark neu-flat-sm px-2 py-0.5 rounded-md">
                        {activeVisit.time || 'Today'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-[#17283B] dark:text-[#E6EEF6] truncate group-hover:text-link transition-colors">
                          {activeVisit.patient}
                        </p>
                        <p className="text-2xs sm:text-xs text-txt-secondary dark:text-txt-darkSecondary truncate">
                          {activeVisit.service || 'Home Consultation'}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl neu-flat-sm flex items-center justify-center text-txt-secondary group-hover:text-link group-hover:scale-105 transition-all shrink-0">
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="mb-3 px-3 py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-tertiary">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      <p className="text-2xs sm:text-xs font-semibold text-tertiary dark:text-tertiary truncate">
                        No active visits scheduled today
                      </p>
                    </div>
                    <Link
                      to="/provider/requests"
                      className="text-2xs sm:text-xs font-bold text-link hover:underline shrink-0"
                    >
                      Check requests
                    </Link>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-link dark:text-primary-300 leading-none">
                      {stats.active}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-link dark:text-primary-300 uppercase tracking-wider mt-1 sm:mt-1.5">
                      Active
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-warning dark:text-warning-dark leading-none">
                      {stats.pending}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-warning dark:text-warning-dark uppercase tracking-wider mt-1 sm:mt-1.5">
                      Pending
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-success dark:text-success-dark leading-none">
                      {stats.completed}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-success dark:text-success-dark uppercase tracking-wider mt-1 sm:mt-1.5">
                      Done
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions List */}
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <h3 className="text-sm sm:text-base font-display font-extrabold text-slate-900 dark:text-white">
                  Quick Actions
                </h3>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                <Link
                  to="/provider/schedule"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">Today&apos;s Schedule</span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">View calendar & bookings</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/provider/requests"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">Incoming Requests {stats.pending > 0 && `(${stats.pending})`}</span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">Accept or decline visits</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/provider/messages"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform relative">
                    <MessageCircle className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white rounded-full text-xs font-extrabold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">
                      Messages {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">Chat with active patients</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>
          </div>

        </div>

        {/* RECENT REQUESTS LIST (OPTION 1 - CLEAN CLINICAL TRIAGE, NO PILLS, NO EMOJIS) */}
        <section className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-3.5 sm:p-6 overflow-hidden">
          <div className="space-y-3 mb-3.5 pb-3 border-b border-slate-200/50 dark:border-white/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                Recent Patient Requests
              </h2>

              {/* Desktop Filter Tabs (hidden on mobile, visible on md and up) */}
              <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100/70 dark:bg-[#0E1724] border border-slate-200/80 dark:border-slate-800 overflow-x-auto no-scrollbar">
                {[
                  { key: 'all', label: 'All', count: recentRequests.length },
                  { key: 'completed', label: 'Completed', count: recentRequests.filter(r => r.status === 'Completed').length },
                  { key: 'accepted', label: 'Accepted', count: recentRequests.filter(r => ['Accepted', 'On The Way', 'Arrived'].includes(r.status)).length },
                  { key: 'pending', label: 'Pending', count: recentRequests.filter(r => r.status === 'Pending').length },
                ].map(tab => {
                  const isActive = requestsFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setRequestsFilter(tab.key); setRequestsPage(1); }}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        isActive
                          ? 'neu-pressed bg-white dark:bg-blue-600 text-link dark:text-white shadow-sm'
                          : 'text-tertiary hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/40 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                        isActive ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MOBILE TOOLBAR (< md): Searchbox + Custom Neumorphic Filter Dropdown side-by-side in 1 Row */}
            <div className="md:hidden flex items-center gap-2 w-full">
              {/* Searchbox taking flexible space */}
              <div className="neu-inset px-2.5 py-1.5 rounded-xl flex items-center gap-2 h-10 flex-1 min-w-0 border border-slate-200/50 dark:border-white/5">
                <Search className="w-3.5 h-3.5 text-link shrink-0" />
                <input
                  type="text"
                  aria-label="Search requests"
                  placeholder="Search patient, service..."
                  value={requestsSearch}
                  onChange={(e) => { setRequestsSearch(e.target.value); setRequestsPage(1); }}
                  className="w-full bg-transparent border-0 px-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {requestsSearch && (
                  <button
                    type="button"
                    onClick={() => setRequestsSearch('')}
                    className="p-0.5 text-tertiary hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Custom Neumorphic Filter Dropdown beside Searchbox (Matching Image 2) */}
              <div className="relative shrink-0" ref={requestsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowRequestsDropdown((prev) => !prev)}
                  className={`neu-btn rounded-xl flex items-center h-10 px-2.5 sm:px-3 gap-1.5 cursor-pointer border transition-all active:scale-95 select-none ${
                    showRequestsDropdown
                      ? 'border-link text-link neu-pressed'
                      : 'border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 hover:border-link'
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={showRequestsDropdown}
                  title="Filter requests by status"
                >
                  <Filter className="w-3.5 h-3.5 text-link shrink-0" />
                  <span className="text-xs font-bold whitespace-nowrap">
                    {requestsFilter === 'all'
                      ? 'All'
                      : requestsFilter === 'completed'
                      ? 'Completed'
                      : requestsFilter === 'accepted'
                      ? 'Accepted'
                      : 'Pending'} ({
                        requestsFilter === 'all'
                          ? recentRequests.length
                          : requestsFilter === 'completed'
                          ? recentRequests.filter(r => r.status === 'Completed').length
                          : requestsFilter === 'accepted'
                          ? recentRequests.filter(r => ['Accepted', 'On The Way', 'Arrived'].includes(r.status)).length
                          : recentRequests.filter(r => r.status === 'Pending').length
                      })
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-tertiary shrink-0 transition-transform duration-200 ${
                      showRequestsDropdown ? 'rotate-180 text-link' : ''
                    }`}
                  />
                </button>

                {/* Neumorphic Floating Dropdown Menu */}
                <AnimatePresence>
                  {showRequestsDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="neu-flat absolute right-0 top-full mt-2 w-48 rounded-2xl p-1.5 z-50 shadow-2xl border border-white/80 dark:border-white/10 bg-surface-shell"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-200/60 dark:border-white/5 mb-1 flex items-center justify-between">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                          Patient Status
                        </span>
                        <span className="text-xs text-link font-extrabold capitalize">
                          {requestsFilter}
                        </span>
                      </div>

                      <div className="space-y-1" role="listbox">
                        {[
                          { value: 'all', label: 'All Requests', count: recentRequests.length },
                          { value: 'accepted', label: 'Active Consults', count: recentRequests.filter(r => ['Accepted', 'On The Way', 'Arrived'].includes(r.status)).length },
                          { value: 'completed', label: 'Completed Visits', count: recentRequests.filter(r => r.status === 'Completed').length },
                          { value: 'pending', label: 'Pending Requests', count: recentRequests.filter(r => r.status === 'Pending').length },
                        ].map((opt) => {
                          const isSelected = requestsFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setRequestsFilter(opt.value);
                                setRequestsPage(1);
                                setShowRequestsDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'neu-inset text-link font-black bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20'
                                  : 'text-slate-700 dark:text-slate-200 hover:text-link hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{opt.label}</span>
                                <span className={`px-1.5 py-0.2 rounded text-2xs font-extrabold ${
                                  isSelected ? 'bg-blue-100 dark:bg-blue-800 text-link dark:text-white' : 'bg-slate-200/60 dark:bg-slate-800 text-tertiary'
                                }`}>
                                  {opt.count}
                                </span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-link shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Table Header Row (Desktop only) */}
          {filteredRequests.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3.5 py-1 text-2xs font-black uppercase tracking-wider text-tertiary mb-1">
              <div className="col-span-4">Patient</div>
              <div className="col-span-3">Service</div>
              <div className="col-span-2">Schedule</div>
              <div className="col-span-3 text-right">Status & Action</div>
            </div>
          )}

          {filteredRequests.length > 0 ? (
            <>
              <div className="space-y-3 sm:space-y-2.5">
              {pagedRequests.map((req) => {
                const initials = req.patient
                  ? req.patient.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'P';
                const isActive = ['Accepted', 'On The Way', 'Arrived'].includes(req.status);

                return (
                  <div key={req.id}>
                    {/* MOBILE CARD (< sm) — EXACT MATCH TO MY PATIENTS PAGE CARD */}
                    <div 
                      className={`sm:hidden neu-flat rounded-2xl p-4 flex flex-col justify-between space-y-3 select-text transition-all ${
                        isActive ? 'border-l-4 border-l-primary' : ''
                      }`}
                    >
                      {/* Top Bar: Patient Avatar + Name & Service + Rectangular Status Badge */}
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            to={`/provider/patients/${req.patientId}/profile`}
                            className="flex items-center gap-2.5 min-w-0 group"
                          >
                            <div className="neu-flat-sm w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-link font-black text-xs shrink-0 p-0.5">
                              {req.patientAvatarUrl ? (
                                <img src={req.patientAvatarUrl} alt="" className="w-full h-full object-cover rounded-[10px]" />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display font-extrabold text-slate-900 dark:text-white group-hover:text-link transition-colors text-xs truncate">
                                {req.patient}
                              </h3>
                              <p className="text-2xs font-semibold text-link truncate mt-0.5">
                                {req.service}
                              </p>
                            </div>
                          </Link>

                          {/* Rectangular Status Badge */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getStatusBadge(req.status)}
                          </div>
                        </div>

                        {/* Middle Meta Details: Combined Clinical Schedule Strip */}
                        <div className="mt-3 py-2 px-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5">
                          <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 font-medium text-xs">
                            <span className="flex items-center gap-1.5 shrink-0">
                              <Calendar className="w-3.5 h-3.5 text-link shrink-0" />
                              <span>{req.date}</span>
                            </span>
                            {req.time && (
                              <>
                                <span className="text-tertiary">&bull;</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-link shrink-0" />
                                  <span>{req.time}</span>
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-2xs font-extrabold text-tertiary uppercase tracking-wider">
                            Home Visit
                          </span>
                        </div>

                        {/* Patient Booking Note: Clean Left Accent Line */}
                        <div className="mt-2.5 pl-3 border-l-2 border-slate-300 dark:border-slate-700 py-0.5 space-y-0.5">
                          <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                            Patient Booking Note
                          </p>
                          {req.notes && req.notes.trim() ? (
                            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed italic line-clamp-3">
                              &ldquo;{req.notes}&rdquo;
                            </p>
                          ) : (
                            <p className="text-xs text-tertiary italic">
                              No additional booking notes provided by patient.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card Action Bar */}
                      <div className="pt-2.5 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between gap-2">
                        {/* Medical Chart Trigger (Left) */}
                        <button
                          type="button"
                          onClick={(event) => handleOpenRecord(req.patientId, req.patient, req.patientAvatarUrl, event.currentTarget)}
                          className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-link hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="Open Medical Record & Chart"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Medical Chart</span>
                        </button>

                        {/* Chat Patient Button (Right / Sa Gilid) */}
                        <Link
                          to={`/provider/messages?partner=${req.patientId}&name=${encodeURIComponent(req.patient)}`}
                          className="neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="Chat with Patient"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-link" />
                          <span>Chat</span>
                        </Link>
                      </div>

                      {/* Quick action buttons if Pending */}
                      {req.status === 'Pending' && (
                        <div className="flex items-center gap-1.5 w-full pt-2">
                          <button
                            type="button"
                            onClick={() => handleQuickAction(req.id, 'accepted')}
                            disabled={!!actionStates[req.id]}
                            className="flex-1 neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-success hover:bg-emerald-500 hover:text-white transition-all cursor-pointer text-center"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(req.id, 'rejected')}
                            disabled={!!actionStates[req.id]}
                            className="flex-1 neu-btn px-3 py-1.5 rounded-lg text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all cursor-pointer text-center"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DESKTOP TABLE ROW (sm: and up) */}
                    <div 
                      className={`hidden sm:grid sm:grid-cols-12 neu-flat-sm p-3 sm:p-4 rounded-xl sm:rounded-2xl gap-2.5 sm:gap-3 items-center hover:translate-x-0.5 transition-all group ${
                        isActive ? 'border-l-4 border-l-primary' : ''
                      }`}
                    >
                      {/* Col 1: Patient Avatar & Name */}
                      <Link
                        to={`/provider/patients/${req.patientId}/profile`}
                        className="sm:col-span-4 flex items-center gap-2.5 sm:gap-3 min-w-0"
                      >
                        <div className="neu-flat-sm w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center text-xs font-black text-link shrink-0 p-0.5">
                          {req.patientAvatarUrl ? (
                            <img src={req.patientAvatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-link transition-colors truncate">
                            {req.patient}
                          </p>
                          <p className="text-2xs sm:text-xs text-tertiary truncate">
                            Verified Patient
                          </p>
                        </div>
                      </Link>

                      {/* Col 2: Service */}
                      <div className="sm:col-span-3 min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-link truncate">
                          {req.service}
                        </p>
                        <p className="text-2xs text-tertiary truncate">
                          Home Visit
                        </p>
                      </div>

                      {/* Col 3: Schedule Date & Time */}
                      <div className="sm:col-span-2 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {req.date}
                        </p>
                        {req.time && (
                          <p className="text-2xs text-tertiary truncate">
                            {req.time}
                          </p>
                        )}
                      </div>

                      {/* Col 4: Status Indicator & Action Buttons */}
                      <div className="sm:col-span-3 flex items-center justify-end gap-2.5">
                        <div className="shrink-0">
                          {getStatusBadge(req.status)}
                        </div>

                        {req.status === 'Pending' ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleQuickAction(req.id, 'accepted')}
                              disabled={!!actionStates[req.id]}
                              className="neu-btn px-2.5 py-1 rounded-lg text-xs font-bold text-success hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAction(req.id, 'rejected')}
                              disabled={!!actionStates[req.id]}
                              className="neu-btn px-2.5 py-1 rounded-lg text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(event) => handleOpenRecord(req.patientId, req.patient, req.patientAvatarUrl, event.currentTarget)}
                              className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-link hover:text-primary transition-all flex items-center gap-1 cursor-pointer shrink-0"
                              title="Medical Chart"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Chart</span>
                            </button>
                            <Link
                              to={`/provider/messages?partner=${req.patientId}&name=${encodeURIComponent(req.patient)}`}
                              className="neu-btn px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-link hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                              title="Chat with Patient"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-link" />
                              <span className="hidden xl:inline">Chat</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* BOTTOM PAGINATION CONTROLS (EXACT MATCH TO MY PATIENTS PAGE) */}
            {totalRequestsPages > 1 && (
              <div className="neu-flat p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 mt-3">
                <p className="text-2xs sm:text-xs font-semibold text-tertiary truncate">
                  Showing {pagedRequests.length} of {filteredRequests.length} requests
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                    disabled={requestsPage === 1}
                    className="neu-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all flex items-center gap-1 cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <span className="neu-inset px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-extrabold text-slate-800 dark:text-slate-200 select-none">
                    {requestsPage} / {totalRequestsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRequestsPage(p => Math.min(totalRequestsPages, p + 1))}
                    disabled={requestsPage >= totalRequestsPages}
                    className="neu-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all flex items-center gap-1 cursor-pointer"
                    title="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
          ) : (
            <div className="neu-flat-sm p-8 rounded-2xl text-center">
              <div className="neu-flat w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-tertiary">
                <FileText className="w-5 h-5 text-link" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">No {requestsFilter !== 'all' ? requestsFilter : 'Recent'} Requests</p>
              <p className="text-sm text-tertiary mt-1 max-w-xs mx-auto">
                No patient requests found matching the current filter.
              </p>
            </div>
          )}
        </section>

        {/* RECENT PATIENT REVIEWS & FEEDBACK (OPTION 1 - OPHELIA CLINICAL SPLIT) */}
        <section className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-[2.25rem] space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-white/5">
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                Patient Reviews & Feedback
              </h3>
            </div>

            {reviews.length > REVIEWS_PER_PAGE && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setReviewsPage(p => Math.max(1, p - 1))}
                  disabled={reviewsPage === 1}
                  className="neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-extrabold text-tertiary px-1 select-none">
                  {reviewsPage} / {totalReviewsPages}
                </span>
                <button
                  type="button"
                  onClick={() => setReviewsPage(p => Math.min(totalReviewsPages, p + 1))}
                  disabled={reviewsPage >= totalReviewsPages}
                  className="neu-btn w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:text-link transition-all cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              
              {/* LEFT: Overall Practice Rating & Breakdown (4 cols on lg) */}
              <div className="lg:col-span-4 neu-flat-sm p-4 sm:p-5 rounded-xl sm:rounded-2xl space-y-3.5">
                <div>
                  <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                    Overall Rating
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl sm:text-4xl font-display font-black text-slate-900 dark:text-white">
                      {avgRating}
                    </span>
                    <span className="text-xs text-tertiary font-bold">/ 5.0</span>
                  </div>

                  {/* Stars Row */}
                  <div className="flex items-center gap-1 mt-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.round(Number(avgRating))
                            ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                            : 'text-tertiary/30 fill-none'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-2xs sm:text-xs text-tertiary mt-1">
                    Based on {reviews.length} verified patient visit{reviews.length > 1 ? 's' : ''}
                  </p>
                </div>

                {/* Star Distribution Breakdown */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200/50 dark:border-white/5 text-2xs font-bold text-tertiary">
                  {starCounts.map(({ stars, count, pct }) => (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="w-5 text-right">{stars}★</span>
                      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-4 text-right text-slate-700 dark:text-slate-300 font-extrabold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: Patient Review Cards Feed (8 cols on lg) */}
              <div className="lg:col-span-8 space-y-3 sm:space-y-3.5">
                {pagedReviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>

            </div>
          ) : (
            <div className="neu-flat-sm p-6 sm:p-8 rounded-2xl text-center">
              <Star className="w-8 h-8 text-tertiary mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">No patient reviews yet</p>
              <p className="text-xs text-tertiary mt-0.5">Ratings and comments left by patients will display here.</p>
            </div>
          )}
        </section>

      </div>

      {/* Patient Medical Record & Chart Modal */}
      {selectedPatient && (
        <PatientRecordModal 
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          patientAvatar={selectedPatient.avatarUrl}
        />
      )}
    </DashboardLayout>
  );
};

export default ProviderDashboard;
