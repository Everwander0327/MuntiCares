import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Clock, CheckCircle2, Search, FileText, Calendar, Navigation, Home, Stethoscope, MessageSquare, MessageCircle, RefreshCw, Star, RotateCcw, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import usePatientRequests from '@/hooks/usePatientRequests';
import { SkeletonPage } from '@/shared/ui';
import { LiveVisitTrackerModal } from '@/features/tracking/components';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

const PatientDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, accepted: 0, pending: 0 });
  const [activeVisit, setActiveVisit] = useState(null);
  const [trackingReq, setTrackingReq] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartY = React.useRef(0);
  const pullDistRef = React.useRef(0);
  const isPulling = React.useRef(false);
  const mainRef = React.useRef(null);
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
  const { requests: fetchedRequests, loading: requestsLoading, refetch } = usePatientRequests(user?.id || null);

  useEffect(() => {
    let channel;

    // map fetchedRequests into local structures used by this component
    if (!requestsLoading) {
      if (fetchedRequests && fetchedRequests.length > 0) {
      const formattedRequests = (fetchedRequests || []).map(req => {
        let timeStr = '';
        try { if (req.time) timeStr = new Date(`2000-01-01T${req.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeStr = req.time || ''; }
        return {
          id: req.id,
          providerId: req.providerId,
          provider: req.provider || 'Unknown',
          providerAvatarUrl: req.providerAvatarUrl || '',
          service: req.service,
          date: req.date ? new Date(req.date.replace(/-/g, '/')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
          time: timeStr,
          status: req.status,
        };
      });

      setRequests(formattedRequests);

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const accepted = (fetchedRequests || []).filter(r => 
        ['On The Way', 'Arrived'].includes(r.status) || 
        (r.status === 'Accepted' && (!r.date || r.date >= todayStr))
      ).length;
      const pending = (fetchedRequests || []).filter(r => r.status === 'Pending').length;
      setStats({ active: accepted + pending, accepted, pending });

      const activeVisitsList = (fetchedRequests || []).filter(r =>
        ['On The Way', 'Arrived'].includes(r.status) ||
        (r.status === 'Accepted' && (!r.date || r.date >= todayStr))
      );

      let activeReq = activeVisitsList.find(r => r.status === 'On The Way')
        || activeVisitsList.find(r => r.status === 'Arrived')
        || [...activeVisitsList.filter(r => r.status === 'Accepted')].sort((a, b) => {
          const dateComp = (a.date || '').localeCompare(b.date || '');
          if (dateComp !== 0) return dateComp;
          return (a.time || '').localeCompare(b.time || '');
        })[0]
        || null;

      if (activeReq) {
        let timeLabel = '';
        try { if (activeReq.time) timeLabel = new Date(`2000-01-01T${activeReq.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { timeLabel = activeReq.time || ''; }
        setActiveVisit({
          id: activeReq.id,
          patientId: activeReq.patientId || user?.id,
          providerId: activeReq.providerId,
          provider: activeReq.provider || 'Unknown',
          providerAvatarUrl: activeReq.providerAvatarUrl || '',
          service: activeReq.service,
          date: activeReq.date ? new Date(activeReq.date.replace(/-/g, '/')).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today',
          time: timeLabel,
          status: activeReq.status,
        });
      } else {
        setActiveVisit(null);
      }

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
        .select('id, is_read')
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .gte('created_at', yesterday);

      if (!error) {
        let readIds = new Set();
        try {
          readIds = new Set(JSON.parse(localStorage.getItem(`read_msgs_${user.id}`) || '[]'));
        } catch {}
        const unreadCount = (data || []).filter(m => !m.is_read && !readIds.has(m.id)).length;
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
      try {
        await refetch();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
      pullDistRef.current = 0;
      isPulling.current = false;
    }
  };

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
        {/* Top Section: Community Highlights Carousel (Left) and Quick Actions Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-stretch">
          {/* Highlights Hero Card (lg:col-span-7) - Image completely covers the entire card */}
          <section className="lg:col-span-7 neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden relative flex flex-col justify-between min-h-[380px] sm:min-h-[440px] md:min-h-[480px]">
            {/* Full-Bleed Carousel Track - Image occupies 100% of the entire card */}
            <div className="absolute inset-0 z-0">
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
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-x overscroll-x-contain"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
              >
                {muntiHighlights.map((slide) => (
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
                    {/* Deep gradient overlay spanning the whole card for high contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/20 pointer-events-none" />

                    {/* Content / Badge & Caption - Balanced nicely just above bottom buttons and dots */}
                    <div className="absolute inset-0 p-5 sm:p-7 md:p-8 flex flex-col justify-end pointer-events-none pb-24 sm:pb-28 md:pb-32">
                      <div className="space-y-2 sm:space-y-2.5 max-w-xl">
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

            {/* Overlaid Bottom Controls: Glassmorphic Dots + Compact Action Buttons */}
            <div className="relative z-10 p-4 sm:p-6 space-y-3 mt-auto">
              {/* Dots indicator inside the image */}
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1.5 py-1">
                  {muntiHighlights.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToSlide(idx);
                      }}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                        currentSlide === idx
                          ? 'w-4 bg-[#8CBDF0] shadow-sm'
                          : 'w-1 bg-white/40 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Action Buttons: Soft Coral #C4623F (CTA / Find) + Soft Sky Blue #2F6FB5 (Requests) */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full">
                <Link
                  to="/patient/providers"
                  className="bg-[#C4623F] hover:bg-[#AA5233] dark:bg-[#F2A98E] dark:hover:bg-[#F6BEA9] text-white dark:text-[#2B1409] shadow-md border border-white/20 w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Find Provider</span>
                </Link>
                <Link
                  to="/patient/requests"
                  className="bg-[#2F6FB5]/90 hover:bg-[#255A94] dark:bg-[#8CBDF0] dark:hover:bg-[#AFD2F6] backdrop-blur-md border border-white/20 text-white dark:text-[#08182A] shadow-md w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#DDEBF8] dark:text-[#08182A] shrink-0" />
                  <span className="truncate">View Requests</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Quick Actions Card with Combined Horizontal Stats on Top (lg:col-span-5) */}
          <div className="lg:col-span-5 neu-flat rounded-[2.25rem] p-6 flex flex-col justify-between gap-5">
            <div>
              {/* Horizontal Stats Row on Top: Light & Airy Semantic Hierarchy */}
              <div className="mb-4 pb-4 border-b border-[#D2E0EE] dark:border-[#2D3F54]">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-display font-extrabold uppercase tracking-wider text-[#52657A] dark:text-[#A5B6C8]">
                    Request Status
                  </h4>
                  <Link
                    to="/patient/requests"
                    className="text-3xs font-bold text-primary hover:text-primary-600 dark:hover:text-primary-300 transition-colors inline-flex items-center gap-0.5"
                  >
                    View all &rarr;
                  </Link>
                </div>

                {/* Slim active-visit banner or empty state */}
                {activeVisit ? (
                  <Link
                    to="/patient/requests"
                    onClick={(e) => {
                      if (['On The Way', 'Arrived'].includes(activeVisit.status)) {
                        e.preventDefault();
                        setTrackingReq({
                          id: activeVisit.id,
                          providerId: activeVisit.providerId,
                          patientId: activeVisit.patientId || user?.id,
                          provider: activeVisit.provider,
                          providerAvatarUrl: activeVisit.providerAvatarUrl,
                          service: activeVisit.service,
                        });
                      }
                    }}
                    className="group mb-3 flex w-full items-center gap-3 rounded-lg border-l-2 border-emerald-500 bg-emerald-500/[0.07] px-3 py-2.5 transition-colors hover:bg-emerald-500/[0.12] dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {activeVisit.status}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {activeVisit.provider} &bull; {activeVisit.service}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 underline underline-offset-4 dark:text-emerald-300">
                      {['On The Way', 'Arrived'].includes(activeVisit.status) ? 'Track live' : (activeVisit.time || 'Today')}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ) : (
                  <div className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between gap-2 bg-[#E9F1F9]/60 dark:bg-[#183049]/40 border border-[#D2E0EE]/60 dark:border-white/5 text-[#52657A]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A5B6C8] shrink-0" />
                      <p className="text-3xs sm:text-xs font-semibold text-[#52657A] dark:text-[#A5B6C8] truncate">
                        No active or upcoming visits scheduled today
                      </p>
                    </div>
                    <Link
                      to="/patient/providers"
                      className="text-3xs font-bold text-primary hover:underline shrink-0"
                    >
                      Book a visit
                    </Link>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Active: Primary Soft (#DDEBF8 bg, #2F6FB5 text) */}
                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl bg-[#DDEBF8] dark:bg-[#183049] border border-[#C5DCF2] dark:border-[#24466B] select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-[#2F6FB5] dark:text-[#8CBDF0] leading-none">
                      {stats.active}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-[#2F6FB5]/90 dark:text-[#8CBDF0]/90 uppercase tracking-wider mt-1.5">
                      Active
                    </p>
                  </div>

                  {/* Accepted: Success (#E1F3EA bg, #2C7A55 text) */}
                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl bg-[#E1F3EA] dark:bg-[#14301F] border border-[#C3E6D4] dark:border-[#214D32] select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-[#2C7A55] dark:text-[#7DD3A3] leading-none">
                      {stats.accepted}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-[#2C7A55]/90 dark:text-[#7DD3A3]/90 uppercase tracking-wider mt-1.5">
                      Accepted
                    </p>
                  </div>

                  {/* Pending: Warning (#FFF1D6 bg, #9C5A06 text) */}
                  <div className="flex flex-col items-center justify-center text-center p-3 sm:p-3.5 rounded-2xl bg-[#FFF1D6] dark:bg-[#34260E] border border-[#FEE1AC] dark:border-[#4F3B16] select-text">
                    <p className="text-xl sm:text-2xl font-display font-black text-[#9C5A06] dark:text-[#F1BD6B] leading-none">
                      {stats.pending}
                    </p>
                    <p className="text-2xs sm:text-xs font-extrabold text-[#9C5A06]/90 dark:text-[#F1BD6B]/90 uppercase tracking-wider mt-1.5">
                      Pending
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions List in Soft Sky Blue + Cloud White */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-display font-extrabold text-[#17283B] dark:text-[#E6EEF6]">
                  Quick Actions
                </h3>
              </div>
              <div className="space-y-2.5">
                <Link
                  to="/patient/providers"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-[#17283B] dark:text-[#E6EEF6] hover:border-[#C4623F] dark:hover:border-[#F2A98E]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FCEBE4] dark:bg-[#3B2219] text-[#C4623F] dark:text-[#F2A98E] border border-[#F8D4C7] dark:border-[#5C3325] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#C4623F] group-hover:text-white dark:group-hover:bg-[#F2A98E] dark:group-hover:text-[#2B1409] transition-all shadow-xs">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold group-hover:text-[#C4623F] dark:group-hover:text-[#F2A98E] transition-colors">Find a Provider</span>
                    <span className="block text-[11px] text-[#52657A] dark:text-[#A5B6C8] truncate">Browse verified caregivers</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#A5B6C8] dark:text-[#52657A] group-hover:text-[#C4623F] dark:group-hover:text-[#F2A98E] group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/requests"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-[#17283B] dark:text-[#E6EEF6] hover:border-[#2F6FB5] dark:hover:border-[#8CBDF0]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#DDEBF8] dark:bg-[#183049] text-[#2F6FB5] dark:text-[#8CBDF0] border border-[#C5DCF2] dark:border-[#24466B] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#2F6FB5] group-hover:text-white dark:group-hover:bg-[#8CBDF0] dark:group-hover:text-[#08182A] transition-all shadow-xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold group-hover:text-[#2F6FB5] dark:group-hover:text-[#8CBDF0] transition-colors">View Requests</span>
                    <span className="block text-[11px] text-[#52657A] dark:text-[#A5B6C8] truncate">Track appointments status</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#A5B6C8] dark:text-[#52657A] group-hover:text-[#2F6FB5] dark:group-hover:text-[#8CBDF0] group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/messages"
                  className="group neu-btn p-3 rounded-2xl flex items-center gap-3 transition-all text-[#17283B] dark:text-[#E6EEF6] hover:border-[#2F6FB5] dark:hover:border-[#8CBDF0]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E9F1F9] dark:bg-[#1F2D3E] text-[#2F6FB5] dark:text-[#8CBDF0] border border-[#D2E0EE] dark:border-[#2D3F54] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-[#2F6FB5] group-hover:text-white dark:group-hover:bg-[#8CBDF0] dark:group-hover:text-[#08182A] transition-all shadow-xs relative">
                    <MessageCircle className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#BC3030] text-white rounded-full text-3xs font-extrabold flex items-center justify-center shadow-xs">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[13px] font-bold group-hover:text-[#2F6FB5] dark:group-hover:text-[#8CBDF0] transition-colors">
                      Messages {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <span className="block text-[11px] text-[#52657A] dark:text-[#A5B6C8] truncate">Direct chat with providers</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#A5B6C8] dark:text-[#52657A] group-hover:text-[#2F6FB5] dark:group-hover:text-[#8CBDF0] group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>

            {/* Suggested Suggestions Section */}
            <div className="pt-3 border-t border-[#D2E0EE] dark:border-[#2D3F54] space-y-2">
              <p className="text-3xs font-extrabold uppercase tracking-widest text-[#52657A] dark:text-[#A5B6C8] px-1 mb-1">Recommended for you</p>
              {activeVisit && stats.accepted > 0 && (
                <Link
                  to={`/patient/messages?provider=${activeVisit.providerId}`}
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-[#17283B] dark:text-[#E6EEF6] text-xs font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2C7A55] dark:text-[#7DD3A3] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Message {activeVisit.provider}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#52657A] dark:text-[#A5B6C8]" />
                </Link>
              )}
              {fetchedRequests?.some(r => r.status === 'Completed') && (
                <Link
                  to="/patient/providers"
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-[#17283B] dark:text-[#E6EEF6] text-xs font-semibold"
                >
                  <RotateCcw className="w-4 h-4 text-[#2F6FB5] dark:text-[#8CBDF0] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Book a follow-up visit</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#52657A] dark:text-[#A5B6C8]" />
                </Link>
              )}
              {fetchedRequests?.some(r => ['Completed', 'Accepted'].includes(r.status)) && (
                <Link
                  to="/patient/requests"
                  className="neu-btn p-2.5 rounded-xl flex items-center gap-2.5 text-[#17283B] dark:text-[#E6EEF6] text-xs font-semibold"
                >
                  <Star className="w-4 h-4 text-[#9C5A06] dark:text-[#F1BD6B] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">View visit receipts & history</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#52657A] dark:text-[#A5B6C8]" />
                </Link>
              )}
              {!fetchedRequests?.some(r => ['Accepted', 'On The Way', 'Arrived', 'Completed'].includes(r.status)) && (
                <p className="neu-flat-sm p-3 rounded-xl text-2xs text-[#52657A] dark:text-[#A5B6C8] text-center font-medium">
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
              const STEP_LABELS = ['Confirmed', 'On Route', 'Arrived', 'Done'];
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

              const providerInitials = (activeVisit.provider || 'PR')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Link
                        to={activeVisit.providerId ? `/patient/providers/${activeVisit.providerId}/profile` : '#'}
                        title="View Provider Profile"
                        className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-primary font-black text-sm overflow-hidden shrink-0 hover:scale-105 transition-transform"
                      >
                        {activeVisit.providerAvatarUrl ? (
                          <img src={activeVisit.providerAvatarUrl} alt={activeVisit.provider} className="w-full h-full object-cover" />
                        ) : (
                          providerInitials
                        )}
                      </Link>
                      <div className="min-w-0">
                        <div className="neu-flat-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-nano font-extrabold uppercase tracking-wider text-[#52657A] dark:text-[#A5B6C8] mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2C7A55] dark:bg-[#7DD3A3] animate-ping" />
                          Active Home Care Visit
                        </div>
                        <Link
                          to={activeVisit.providerId ? `/patient/providers/${activeVisit.providerId}/profile` : '#'}
                          className="text-lg sm:text-xl font-display font-extrabold text-[#17283B] dark:text-[#E6EEF6] hover:text-primary dark:hover:text-[#8CBDF0] transition-colors truncate block"
                        >
                          {activeVisit.provider}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                      {['On The Way', 'Arrived'].includes(activeVisit.status) && (
                        <button
                          type="button"
                          onClick={() => setTrackingReq({
                            id: activeVisit.id,
                            providerId: activeVisit.providerId,
                            patientId: activeVisit.patientId || user?.id,
                            provider: activeVisit.provider,
                            providerAvatarUrl: activeVisit.providerAvatarUrl,
                            service: activeVisit.service,
                          })}
                          className="neu-btn min-h-[44px] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-primary dark:text-[#8CBDF0] transition-all flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
                          title="Open Live GPS Tracker"
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <Navigation className="w-4 h-4" />
                          <span>Track Live</span>
                        </button>
                      )}
                      <Link 
                        to={`/patient/messages?provider=${activeVisit.providerId}`}
                        className="neu-btn w-11 h-11 rounded-2xl text-primary transition-all flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0.5"
                        title="Chat with Provider"
                        aria-label={`Chat with ${activeVisit.provider}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Link>
                      <span className="neu-flat-sm text-xs font-bold text-primary px-4 py-2 rounded-2xl">
                        {activeVisit.service}
                      </span>
                    </div>
                  </div>

                  {/* Visit Time and Date Neumorphic Raised Chips */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#52657A] dark:text-[#A5B6C8]">
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
                                ? 'neu-flat-sm bg-[#E1F3EA] dark:bg-[#14301F] text-[#2C7A55] dark:text-[#7DD3A3] font-bold border border-[#2C7A55]/30' 
                                : isCurrent 
                                  ? 'neu-btn-primary text-white scale-110 shadow-lg' 
                                  : 'neu-flat-sm text-[#52657A] dark:text-[#A5B6C8] opacity-90'
                            }`}>
                              {isPassed ? <CheckCircle2 className="w-4 h-4 text-[#2C7A55] dark:text-[#7DD3A3]" /> : STEP_ICONS[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between px-1">
                      {STEP_LABELS.map((label, i) => (
                        <span key={label} className={`text-nano font-extrabold uppercase tracking-wider text-center transition-colors ${
                          i <= currentStep ? 'text-primary dark:text-[#8CBDF0] font-bold' : 'text-[#52657A]/60 dark:text-[#A5B6C8]/60'
                        }`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="neu-flat-sm p-4 rounded-2xl flex items-center gap-3.5 text-sm font-medium text-[#17283B] dark:text-[#E6EEF6]">
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
                <h4 className="text-[#17283B] dark:text-[#E6EEF6] font-display font-extrabold text-lg sm:text-xl">
                  No Active Visits Scheduled
                </h4>
                <p className="text-sm text-[#52657A] dark:text-[#A5B6C8] mt-2 max-w-sm mx-auto leading-relaxed">
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
                    className="neu-btn px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-[#17283B] dark:text-[#E6EEF6] inline-flex items-center justify-center gap-2 active:scale-95"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    Past Requests
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Requests Section with Neumorphic Table / List (Compact layout) */}
        <section className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-[#D2E0EE] dark:border-[#2D3F54]">
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-[#17283B] dark:text-[#E6EEF6]">
                Recent Requests
              </h2>
              <p className="text-3xs sm:text-xs text-[#52657A] dark:text-[#A5B6C8] mt-0.5">
                Showing {Math.min(requests.length, 5)} of {requests.length} records
              </p>
            </div>
            <Link
              to="/patient/requests"
              className="neu-btn px-3 py-1.5 rounded-xl text-3xs sm:text-xs font-bold text-primary inline-flex items-center gap-1 active:scale-95"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {requests.length > 0 ? (
            <div className="space-y-2 sm:space-y-2.5">
              {requests.slice(0, 5).map((req, idx) => (
                <Link
                  key={req.id || idx}
                  to="/patient/requests"
                  className="neu-flat-sm p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2.5 select-text hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden flex items-center justify-center text-primary text-2xs sm:text-xs font-black shrink-0 p-0.5">
                      {req.providerAvatarUrl ? (
                        <img src={req.providerAvatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        req.provider.split(' ').map(n => n[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs sm:text-sm text-[#17283B] dark:text-[#E6EEF6] group-hover:text-primary transition-colors truncate">
                        {req.provider}
                      </p>
                      <p className="text-3xs sm:text-2xs text-[#52657A] dark:text-[#A5B6C8] truncate mt-0.5">
                        {req.service} &bull; {req.date} {req.time ? `(${req.time})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`neu-flat-sm text-3xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      ['Accepted', 'On The Way', 'Arrived', 'Completed'].includes(req.status)
                        ? 'text-[#2C7A55] dark:text-[#7DD3A3] border border-[#2C7A55]/30 dark:border-[#7DD3A3]/30 bg-[#E1F3EA] dark:bg-[#14301F]'
                        : req.status === 'Pending'
                        ? 'text-[#9C5A06] dark:text-[#F1BD6B] border border-[#9C5A06]/30 dark:border-[#F1BD6B]/30 bg-[#FFF1D6] dark:bg-[#34260E]'
                        : ['Cancelled', 'Rejected'].includes(req.status)
                        ? 'text-[#BC3030] dark:text-[#F4918B] border border-[#BC3030]/30 dark:border-[#F4918B]/30 bg-[#FCE8E6] dark:bg-[#3C1B1A]'
                        : 'text-[#52657A] dark:text-[#A5B6C8] border border-[#D2E0EE] dark:border-[#2D3F54] bg-[#E9F1F9] dark:bg-[#1F2D3E]'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="neu-flat-sm p-8 rounded-2xl text-center">
              <div className="neu-flat w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <p className="font-bold text-[#17283B] dark:text-[#E6EEF6] text-sm">No Requests Yet</p>
              <p className="text-xs text-[#52657A] dark:text-[#A5B6C8] mt-1 max-w-xs mx-auto">
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

      {/* Live GPS Tracker Modal */}
      <LiveVisitTrackerModal
        isOpen={!!trackingReq}
        onClose={() => setTrackingReq(null)}
        request={trackingReq}
      />
    </DashboardLayout>
  );
};

export default PatientDashboard;
