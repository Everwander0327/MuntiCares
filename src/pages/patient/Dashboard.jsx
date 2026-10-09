import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, CheckCircle2, AlertCircle, Search, FileText, Calendar, Navigation, Home, Stethoscope, MessageSquare, MessageCircle, RefreshCw, Star, RotateCcw, ArrowRight, Sparkles, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp';
import usePatientRequests from '../../hooks/usePatientRequests';
import { SkeletonPage } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const muntiHighlights = [
  {
    id: 1,
    tag: 'Barangay Health Caravan',
    title: 'Free Checkups & Medical Caravan in Muntinlupa',
    description: 'City health units conducting blood pressure monitoring, consultations, and doctor visits across all 9 barangays.',
    image: '/images/carousel/caravan.jpg',
  },
  {
    id: 2,
    tag: 'Mobile Health Clinic',
    title: 'Libreng Gamot at Serbisyong Pangkalusugan',
    description: 'The Muntinlupa Community Mobile Clinic visits barangay plazas to distribute maintenance medicine and essential vitamins.',
    image: '/images/carousel/mobile-clinic.jpg',
  },
  {
    id: 3,
    tag: 'Home Healthcare',
    title: 'Compassionate In-Home Senior Care & Therapy',
    description: 'Certified nurses and caregivers providing gentle physical therapy and vitals monitoring in the comfort of your home.',
    image: '/images/carousel/home-care.jpg',
  },
  {
    id: 4,
    tag: 'Citywide Network',
    title: 'MuntiCares Certified Healthcare Network',
    description: 'Over 250+ vetted doctors, nurses, and caregivers connected through the city’s unified digital care platform.',
    image: '/images/landing/hero-wash.jpg',
  },
];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const StatItem = ({ label, value, icon, iconColor }) => {
  const { count, ref } = useCountUp(parseInt(value) || 0, 1200, false);

  return (
    <div className="flex items-center gap-3.5 sm:gap-4 p-2 transition-all">
      {/* Left side: Raised Icon Container */}
      <div className="neu-flat-sm w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center p-3 shrink-0">
        {React.cloneElement(icon, { className: `w-5 h-5 sm:w-6 sm:h-6 ${iconColor}` })}
      </div>

      {/* Right side: Label and Count */}
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

const PatientDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, accepted: 0, pending: 0 });
  const [activeVisit, setActiveVisit] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartY = React.useRef(0);
  const pullDistRef = React.useRef(0);
  const isPulling = React.useRef(false);
  const mainRef = React.useRef(null);
  const prevStatusesRef = useRef({});
  const { user } = useAuth();

  const carouselTrackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const isInteractingRef = useRef(false);

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
        if (slide !== currentSlide && slide >= 0 && slide < muntiHighlights.length) {
          setCurrentSlide(slide);
        }
      }
    }
  };

  const onMouseDownTrack = (e) => {
    isDraggingRef.current = true;
    isInteractingRef.current = true;
    dragStartXRef.current = e.pageX - carouselTrackRef.current.offsetLeft;
    dragScrollLeftRef.current = carouselTrackRef.current.scrollLeft;
  };

  const onMouseMoveTrack = (e) => {
    if (!isDraggingRef.current || !carouselTrackRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselTrackRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.4;
    carouselTrackRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const onMouseUpTrack = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setTimeout(() => { isInteractingRef.current = false; }, 1500);
    // snap to nearest slide on release
    if (carouselTrackRef.current) {
      const width = carouselTrackRef.current.clientWidth;
      const targetSlide = Math.round(carouselTrackRef.current.scrollLeft / width);
      scrollToSlide(Math.max(0, Math.min(targetSlide, muntiHighlights.length - 1)));
    }
  };

  // Auto-advance carousel every 6 seconds when not interacting
  useEffect(() => {
    const timer = setInterval(() => {
      if (carouselTrackRef.current && !isInteractingRef.current && !isDraggingRef.current) {
        const nextSlide = (currentSlide + 1) % muntiHighlights.length;
        scrollToSlide(nextSlide);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  // Use shared hook for requests + realtime
  const { requests: fetchedRequests, loading: requestsLoading } = usePatientRequests(user?.id || null);

  useEffect(() => {
    let channel;

    // map fetchedRequests into local structures used by this component
    if (!requestsLoading) {
      if (fetchedRequests && fetchedRequests.length > 0) {
      const formattedRequests = (fetchedRequests || []).map(req => {
        let timeStr = '';
        try { if (req.time) timeStr = new Date(`2000-01-01T${req.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeStr = req.time || ''; }
        return {
          provider: req.provider || 'Unknown',
          service: req.service,
          date: new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: timeStr,
          status: req.status,
        };
      });

      setRequests(formattedRequests);

      const accepted = (fetchedRequests || []).filter(r => ['Accepted', 'On The Way', 'Arrived'].includes(r.status)).length;
      const pending = (fetchedRequests || []).filter(r => r.status === 'Pending').length;
      setStats({ active: accepted + pending, accepted, pending });

      const priorityOrder = ['On The Way', 'Arrived', 'Accepted'];
      let activeReq = null;
      for (const status of priorityOrder) {
        activeReq = (fetchedRequests || []).find(r => r.status === status);
        if (activeReq) break;
      }

      if (activeReq) {
        let timeLabel = '';
        try { if (activeReq.time) timeLabel = new Date(`2000-01-01T${activeReq.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeLabel = activeReq.time || ''; }
        setActiveVisit({
          providerId: activeReq.providerId,
          provider: activeReq.provider || 'Unknown',
          service: activeReq.service,
          date: new Date(activeReq.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: timeLabel,
          status: activeReq.status,
        });
      } else {
        setActiveVisit(null);
      }

      (fetchedRequests || []).forEach(req => {
        const prev = prevStatusesRef.current[req.id];
        if (prev && prev !== req.status) {
          const providerName = req.provider || 'A provider';
          const msgMap = {
            'Accepted': `${providerName} accepted your request!`,
            'Cancelled': `${providerName} cancelled your request.`,
            'Rejected': `${providerName} declined your request.`,
            'On The Way': `${providerName} is on the way!`,
            'Arrived': `${providerName} has arrived!`,
            'Completed': `Your session with ${providerName} is complete.`,
          };
          const msg = msgMap[req.status];
          if (msg) toast(msg, { icon: '🔄', duration: 4000 });
        }
        prevStatusesRef.current[req.id] = req.status;
      });

      setLoading(false);
      } else {
        // no requests
        setRequests([]);
        setStats({ active: 0, accepted: 0, pending: 0 });
        setActiveVisit(null);
        setLoading(false);
      }
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchedRequests, requestsLoading, user]);

  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .gte('created_at', yesterday);

      if (!error) {
        const readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        const unreadCount = (data || []).filter(m => !readIds.has(m.id)).length;
        setUnreadCount(unreadCount);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('dashboard-unread-msg')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchUnreadCount())
      .subscribe();

    const onMessagesRead = () => fetchUnreadCount();
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') fetchUnreadCount(); };
    const onWindowFocus = () => fetchUnreadCount();
    window.addEventListener('messages-read', onMessagesRead);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    const pollInterval = setInterval(fetchUnreadCount, 2000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      window.removeEventListener('messages-read', onMessagesRead);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [user]);

  const getScrollContainer = () => {
    if (!mainRef.current) return null;
    let el = mainRef.current.parentElement;
    while (el) {
      if (window.getComputedStyle(el).overflowY === 'auto') return el;
      el = el.parentElement;
    }
    return null;
  };

  const handleTouchStart = (e) => {
    // If the touch originated inside the carousel track, don't trigger pull-to-refresh
    if (carouselTrackRef.current && carouselTrackRef.current.contains(e.target)) {
      return;
    }
    const scrollContainer = getScrollContainer();
    if (scrollContainer && scrollContainer.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling.current) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) {
      const clamped = Math.min(dist * 0.5, 80);
      pullDistRef.current = clamped;
      setPullDistance(clamped);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistRef.current >= 60 && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      pullDistRef.current = 0;
      isPulling.current = false;
      window.location.reload();
    } else {
      setPullDistance(0);
      pullDistRef.current = 0;
      isPulling.current = false;
    }
  };

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ height: pullDistance + 20, paddingTop: pullDistance > 30 ? pullDistance * 0.3 : 0 }}
        >
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: pullDistance >= 60 ? 180 : 0 }}
            className="w-9 h-9 neu-flat rounded-full flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
          </motion.div>
        </div>
      )}
      <div
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="space-y-6 md:space-y-8"
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance}px)`, transition: 'transform 0.1s ease-out' } : { transition: 'transform 0.3s ease-out' }}
      >
        {/* Top Section: Greeting Card (Left) and Quick Actions Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-stretch">
          {/* Greeting Card (lg:col-span-7) */}
          <section className="lg:col-span-7 neu-flat p-6 md:p-8 rounded-[2.25rem] flex flex-col justify-between gap-5">
            <div className="min-w-0">
              <h1 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white">
                Good day, {firstName}
              </h1>
              {activeVisit && (
                <p className="text-sm font-medium text-primary mt-1 leading-snug">
                  {activeVisit.provider} is {activeVisit.status.toLowerCase()} for {activeVisit.service}.
                </p>
              )}
            </div>

            {/* Muntinlupa Health Progress & Community Highlights Carousel (Effortless Native Swipe Track) */}
            <div className="relative overflow-hidden rounded-2xl neu-flat-sm p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
              <div
                ref={carouselTrackRef}
                onScroll={handleCarouselScroll}
                onMouseDown={onMouseDownTrack}
                onMouseMove={onMouseMoveTrack}
                onMouseUp={onMouseUpTrack}
                onMouseLeave={onMouseUpTrack}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  isInteractingRef.current = true;
                }}
                onTouchEnd={() => {
                  setTimeout(() => { isInteractingRef.current = false; }, 2000);
                }}
                className="relative h-56 sm:h-64 md:h-72 w-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar rounded-xl select-none cursor-grab active:cursor-grabbing touch-pan-x overscroll-x-contain"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
              >
                {muntiHighlights.map((slide) => (
                  <div
                    key={slide.id}
                    className="w-full flex-shrink-0 h-full relative snap-center rounded-xl overflow-hidden"
                  >
                    <img
                      src={slide.image}
                      alt={slide.title}
                      draggable={false}
                      className="w-full h-full object-cover rounded-xl pointer-events-none"
                    />
                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent rounded-xl pointer-events-none" />

                    {/* Content / Badge & Caption */}
                    <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between pointer-events-none">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-primary text-white backdrop-blur-md shadow-md">
                          <Sparkles className="w-3 h-3" />
                          {slide.tag}
                        </span>
                      </div>

                      <div className="space-y-1.5 max-w-xl">
                        <h3 className="text-base sm:text-lg md:text-xl font-display font-bold text-white drop-shadow-md line-clamp-1">
                          {slide.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 leading-relaxed drop-shadow-sm">
                          {slide.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dots indicator (Interactive, clicks scroll instantly) */}
              <div className="flex items-center justify-center pt-2.5 pb-1 gap-2">
                {muntiHighlights.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentSlide === idx
                        ? 'w-7 bg-primary shadow-sm'
                        : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons: Expanded across full width */}
            <div className="grid grid-cols-2 gap-3.5 w-full shrink-0">
              <Link
                to="/patient/providers"
                className="neu-btn-primary w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-center shadow-sm"
              >
                <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                <span>Find a Provider</span>
              </Link>
              <Link
                to="/patient/requests"
                className="neu-btn w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform text-center"
              >
                <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-primary shrink-0" />
                <span>View Requests</span>
              </Link>
            </div>
          </section>

          {/* Quick Actions Card with Combined Horizontal Stats on Top (lg:col-span-5) */}
          <div className="lg:col-span-5 neu-flat rounded-[2.25rem] p-6 flex flex-col justify-between gap-5">
            <div>
              {/* Horizontal Stats Row on Top */}
              <div className="mb-4 pb-4 border-b border-slate-200/60 dark:border-white/5">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-display font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Request Status
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="flex flex-col items-center text-center p-2.5 rounded-2xl neu-flat-sm transition-transform hover:-translate-y-0.5">
                    <div className="neu-flat-sm w-8 h-8 rounded-xl flex items-center justify-center mb-1 text-blue-500 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <p className="text-base sm:text-lg font-display font-black text-slate-800 dark:text-slate-100 leading-none">
                      {stats.active}
                    </p>
                    <p className="text-3xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate mt-1">
                      Active
                    </p>
                  </div>

                  <div className="flex flex-col items-center text-center p-2.5 rounded-2xl neu-flat-sm transition-transform hover:-translate-y-0.5">
                    <div className="neu-flat-sm w-8 h-8 rounded-xl flex items-center justify-center mb-1 text-emerald-500 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-base sm:text-lg font-display font-black text-slate-800 dark:text-slate-100 leading-none">
                      {stats.accepted}
                    </p>
                    <p className="text-3xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate mt-1">
                      Accepted
                    </p>
                  </div>

                  <div className="flex flex-col items-center text-center p-2.5 rounded-2xl neu-flat-sm transition-transform hover:-translate-y-0.5">
                    <div className="neu-flat-sm w-8 h-8 rounded-xl flex items-center justify-center mb-1 text-amber-500 shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <p className="text-base sm:text-lg font-display font-black text-slate-800 dark:text-slate-100 leading-none">
                      {stats.pending}
                    </p>
                    <p className="text-3xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-tighter truncate mt-1">
                      Pending
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
                  to="/patient/providers"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">Find a Provider</span>
                    <span className="block text-[11px] text-slate-400 truncate">Browse verified caregivers</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/requests"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-slate-800 dark:text-slate-200"
                >
                  <div className="neu-flat-sm w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold">View Requests</span>
                    <span className="block text-[11px] text-slate-400 truncate">Track appointments status</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/messages"
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
                    <span className="block text-[11px] text-slate-400 truncate">Direct chat with providers</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>

            {/* Suggested Suggestions Section */}
            <div className="pt-3 border-t border-slate-200/50 dark:border-white/5 space-y-2">
              <p className="text-3xs font-extrabold uppercase tracking-widest text-slate-400 px-1 mb-1">Recommended for you</p>
              {activeVisit && stats.accepted > 0 && (
                <Link
                  to={`/patient/messages?provider=${activeVisit.providerId}`}
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Message {activeVisit.provider}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
              {fetchedRequests?.some(r => r.status === 'Completed') && (
                <Link
                  to="/patient/providers"
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  <RotateCcw className="w-4 h-4 text-primary shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Book a follow-up visit</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
              {fetchedRequests?.some(r => ['Completed', 'Accepted'].includes(r.status)) && (
                <Link
                  to="/patient/requests"
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  <Star className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">View visit receipts & history</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              )}
              {!fetchedRequests?.some(r => ['Accepted', 'On The Way', 'Arrived', 'Completed'].includes(r.status)) && (
                <p className="neu-flat-sm p-3 rounded-xl text-2xs text-slate-500 text-center font-medium">
                  Connect with local healthcare pros for assistance.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live Visit Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <div className="w-full neu-flat rounded-[2.25rem] p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
            {activeVisit ? (() => {
              const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];
              const STEP_LABELS = ['Confirmed', 'En Route', 'Arrived', 'Done'];
              const STEP_ICONS = [
                <CheckCircle2 key="confirmed" className="w-4 h-4" />,
                <Navigation key="enroute" className="w-4 h-4" />,
                <Home key="arrived" className="w-4 h-4" />,
                <Stethoscope key="done" className="w-4 h-4" />,
              ];
              const currentStep = STATUS_STEPS.indexOf(activeVisit.status);

              const STATUS_MESSAGES = {
                Accepted: 'Your provider has confirmed the visit. Please ensure someone is ready at your location.',
                'On The Way': 'Your provider is traveling towards your address. Keep your phone accessible.',
                Arrived: 'Your healthcare provider is currently on-site. The session has commenced.',
                Completed: 'Your home visit is completed. You can view session summary or medical notes anytime.',
              };

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="neu-flat-sm inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-3xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Active Home Care Visit
                      </div>
                      <h3 className="text-lg sm:text-xl font-display font-extrabold text-slate-900 dark:text-white">
                        {activeVisit.provider}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                      <Link 
                        to={`/patient/messages?provider=${activeVisit.providerId}`}
                        className="neu-btn p-3 rounded-2xl text-primary transition-all flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0.5"
                        title="Chat with Provider"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Link>
                      <span className="neu-flat-sm text-xs font-bold text-primary px-4 py-2 rounded-2xl">
                        {activeVisit.service}
                      </span>
                    </div>
                  </div>

                  {/* Visit Time and Date Neumorphic Raised Chips */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="neu-flat-sm px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>{activeVisit.date}</span>
                    </div>
                    {activeVisit.time && (
                      <div className="neu-flat-sm px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>{activeVisit.time}</span>
                      </div>
                    )}
                  </div>

                  {/* Stepper Progress Bar (Recessed Track with Raised/Extruded Interactive Nodes) */}
                  <div className="neu-inset-deep p-4 sm:p-5 rounded-2xl">
                    <div className="flex items-center justify-between relative px-2 mb-3">
                      {/* Background Recessed Track */}
                      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-2 rounded-full neu-inset z-0" />
                      
                      {STATUS_STEPS.map((step, i) => {
                        const isPassed = i < currentStep;
                        const isCurrent = i === currentStep;
                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                              isPassed 
                                ? 'neu-flat-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' 
                                : isCurrent 
                                  ? 'neu-btn-primary text-white scale-110 shadow-lg' 
                                  : 'neu-flat-sm text-slate-400 dark:text-slate-500 opacity-90'
                            }`}>
                              {isPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : STEP_ICONS[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between px-1">
                      {STEP_LABELS.map((label, i) => (
                        <span key={label} className={`text-3xs sm:text-2xs font-extrabold uppercase tracking-wider text-center transition-colors ${
                          i <= currentStep ? 'text-primary dark:text-primary-300 font-bold' : 'text-slate-400 dark:text-slate-600'
                        }`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="neu-flat-sm p-4 rounded-2xl flex items-center gap-3.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <div className="w-3 h-3 rounded-full bg-primary shrink-0 animate-ping" />
                    <p className="leading-relaxed text-xs sm:text-sm">{STATUS_MESSAGES[activeVisit.status]}</p>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-10 sm:py-12 my-auto">
                <div className="neu-flat w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 text-primary">
                  <Calendar className="w-8 h-8" />
                </div>
                <h4 className="text-slate-800 dark:text-slate-100 font-display font-extrabold text-lg sm:text-xl">
                  No Active Visits Scheduled
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  You do not have any appointments in progress. Explore trusted health providers in Muntinlupa and book a consultation in minutes.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/patient/providers"
                    className="neu-btn-primary px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Search className="w-4 h-4" />
                    Find a Provider
                  </Link>
                  <Link
                    to="/patient/requests"
                    className="neu-btn px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-2 active:scale-95"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    Past Requests
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Requests Section with Neumorphic Table / List */}
        <section className="neu-flat rounded-[2.25rem] p-6 sm:p-7 overflow-hidden">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200/50 dark:border-white/5">
            <div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 dark:text-white">
                Recent Requests
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {Math.min(requests.length, 5)} of {requests.length} records
              </p>
            </div>
            <Link
              to="/patient/requests"
              className="neu-btn px-4 py-2 rounded-xl text-xs font-bold text-primary inline-flex items-center gap-1.5"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {requests.length > 0 ? (
            <div className="space-y-3">
              {requests.slice(0, 5).map((req, idx) => (
                <div
                  key={idx}
                  className="neu-flat-sm p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="neu-flat-sm w-11 h-11 rounded-2xl flex items-center justify-center text-primary text-xs font-black shrink-0">
                      {req.provider.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {req.provider}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {req.service} &bull; {req.date} {req.time ? `(${req.time})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <span className={`neu-flat-sm text-2xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                      ['Accepted', 'Completed'].includes(req.status)
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : req.status === 'Pending'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="neu-flat-sm p-8 rounded-2xl text-center">
              <div className="neu-flat w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                <FileText className="w-5 h-5" />
              </div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No Requests Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Find a certified provider in your area to book your first home healthcare visit.
              </p>
              <Link
                to="/patient/providers"
                className="neu-btn-primary mt-4 text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5" /> Browse Providers
              </Link>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
