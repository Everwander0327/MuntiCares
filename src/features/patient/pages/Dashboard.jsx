import React, { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  Clock,
  CheckCircle,
  MagnifyingGlass,
  FileText,
  Calendar,
  NavigationArrow,
  House,
  Stethoscope,
  ChatText,
  ChatCircle,
  ArrowsClockwise,
  ArrowRight,
  CaretRight,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import usePatientRequests from '@/hooks/usePatientRequests';
import { SkeletonPage } from '@/shared/ui';
import { LiveVisitTrackerModal } from '@/features/tracking/components';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import {
  useRecentCarouselEvents,
  isExternalEventLink,
  formatEventDateLabel,
} from '@/features/admin/utils/recentEvents';

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
  const { t, isTagalog, translateService, translateStatus } = useLanguage();
  const locale = isTagalog ? 'tl-PH' : 'en-US';
  const navigate = useNavigate();

  const muntiHighlights = useMemo(() => [
    {
      id: 1,
      tag: t('patient.dashboard.slide1Tag'),
      title: t('patient.dashboard.slide1Title'),
      description: t('patient.dashboard.slide1Desc'),
      image: '/images/carousel/caravan.jpg',
    },
    {
      id: 2,
      tag: t('patient.dashboard.slide2Tag'),
      title: t('patient.dashboard.slide2Title'),
      description: t('patient.dashboard.slide2Desc'),
      image: '/images/carousel/mobile-clinic.jpg',
    },
    {
      id: 3,
      tag: t('patient.dashboard.slide3Tag'),
      title: t('patient.dashboard.slide3Title'),
      description: t('patient.dashboard.slide3Desc'),
      image: '/images/carousel/home-care.jpg',
    },
    {
      id: 4,
      tag: t('patient.dashboard.slide4Tag'),
      title: t('patient.dashboard.slide4Title'),
      description: t('patient.dashboard.slide4Desc'),
      image: '/images/landing/hero-wash.jpg',
    },
  ], [t]);

  // Profile-completeness routing lives in DashboardLayout so every patient
  // route is covered by one query instead of one per page.

  const carouselTrackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const pointerDownClientXRef = useRef(0);
  const isInteractingRef = useRef(false);
  const [carouselHeld, setCarouselHeld] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const carouselSlides = useRecentCarouselEvents('patient', muntiHighlights);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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
        if (slide !== currentSlide && slide >= 0 && slide < carouselSlides.length) {
          setCurrentSlide(slide);
        }
      }
    }
  };

  const onMouseDownTrack = (e) => {
    isDraggingRef.current = true;
    isInteractingRef.current = true;
    dragDistanceRef.current = 0;
    pointerDownClientXRef.current = e.pageX;
    dragStartXRef.current = e.pageX - carouselTrackRef.current.offsetLeft;
    dragScrollLeftRef.current = carouselTrackRef.current.scrollLeft;
  };

  const onMouseMoveTrack = (e) => {
    if (!isDraggingRef.current || !carouselTrackRef.current) return;
    e.preventDefault();
    dragDistanceRef.current = Math.max(
      dragDistanceRef.current,
      Math.abs(e.pageX - pointerDownClientXRef.current)
    );
    const x = e.pageX - carouselTrackRef.current.offsetLeft;
    const walk = (x - dragStartXRef.current) * 1.4;
    carouselTrackRef.current.scrollLeft = dragScrollLeftRef.current - walk;
  };

  const handleSlideClick = (slide) => {
    if (!slide?.link || dragDistanceRef.current >= 6) return;
    if (isExternalEventLink(slide.link)) {
      window.open(slide.link, '_blank', 'noopener,noreferrer');
    } else {
      navigate(slide.link);
    }
  };

  const onMouseUpTrack = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setTimeout(() => { isInteractingRef.current = false; }, 1500);
    // snap to nearest slide on release
    if (carouselTrackRef.current) {
      const width = carouselTrackRef.current.clientWidth;
      const targetSlide = Math.round(carouselTrackRef.current.scrollLeft / width);
      scrollToSlide(Math.max(0, Math.min(targetSlide, carouselSlides.length - 1)));
    }
  };

  // Auto-advance carousel every 6 seconds when not interacting (WCAG 2.2.2)
  useEffect(() => {
    if (carouselHeld || reduceMotion) return undefined;
    const timer = setInterval(() => {
      if (carouselTrackRef.current && !isInteractingRef.current && !isDraggingRef.current) {
        const nextSlide = (currentSlide + 1) % carouselSlides.length;
        scrollToSlide(nextSlide);
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [currentSlide, carouselHeld, reduceMotion, carouselSlides.length]);

  // Use shared hook for requests + realtime
  const { requests: fetchedRequests, loading: requestsLoading, refetch } = usePatientRequests(user?.id || null);

  useEffect(() => {
    // map fetchedRequests into local structures used by this component
    if (!requestsLoading) {
      if (fetchedRequests && fetchedRequests.length > 0) {
      const formattedRequests = (fetchedRequests || []).map(req => {
        let timeStr = '';
        try { if (req.time) timeStr = new Date(`2000-01-01T${req.time}`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }); } catch { timeStr = req.time || ''; }
        return {
          id: req.id,
          providerId: req.providerId,
          provider: req.provider || t('patient.dashboard.unknownProvider'),
          providerAvatarUrl: req.providerAvatarUrl || '',
          service: req.service,
          date: req.date ? new Date(req.date.replace(/-/g, '/')).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
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
        try { if (activeReq.time) timeLabel = new Date(`2000-01-01T${activeReq.time}`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }); } catch { timeLabel = activeReq.time || ''; }
        setActiveVisit({
          id: activeReq.id,
          patientId: activeReq.patientId || user?.id,
          providerId: activeReq.providerId,
          provider: activeReq.provider || t('patient.dashboard.unknownProvider'),
          providerAvatarUrl: activeReq.providerAvatarUrl || '',
          service: activeReq.service,
          date: activeReq.date ? new Date(activeReq.date.replace(/-/g, '/')).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }) : t('patient.dashboard.today'),
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
  }, [fetchedRequests, requestsLoading, user, locale, t]);

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
            <ArrowsClockwise className={`w-4 h-4 text-link ${refreshing ? 'animate-spin' : ''}`} />
          </motion.div>
        </div>
      )}
      <div
        ref={mainRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="space-y-4 sm:space-y-6 md:space-y-7 pb-10"
        style={pullDistance > 0 ? { transform: `translateY(${pullDistance}px)`, transition: 'transform 0.1s ease-out' } : { transition: 'transform 0.3s ease-out' }}
      >
        {/* Top Section: Community Highlights Carousel (Left) and Quick Actions Card (Right) */}
        <h1 className="sr-only">{t('patient.dashboard.srTitle')}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          {/* Highlights Hero Card (lg:col-span-7) */}
          <section
            className="lg:col-span-7 neu-flat rounded-2xl sm:rounded-[2.25rem] overflow-hidden relative flex flex-col justify-between min-h-[19rem] sm:min-h-[26rem] lg:min-h-[30rem]"
            onMouseEnter={() => setCarouselHeld(true)}
            onMouseLeave={() => setCarouselHeld(false)}
            onFocusCapture={() => setCarouselHeld(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setCarouselHeld(false);
            }}
          >
            {/* Full-Bleed Carousel Track */}
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
                {carouselSlides.map((slide) => {
                  const hasLink = Boolean(slide.link);
                  return (
                    <div
                      key={slide.id}
                      onClick={hasLink ? () => handleSlideClick(slide) : undefined}
                      onKeyDown={
                        hasLink
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                dragDistanceRef.current = 0;
                                handleSlideClick(slide);
                              }
                            }
                          : undefined
                      }
                      role={hasLink ? 'link' : undefined}
                      tabIndex={hasLink ? 0 : undefined}
                      aria-label={hasLink ? t('patient.dashboard.openLinkAria', { title: slide.title }) : undefined}
                      className={`group w-full flex-shrink-0 h-full relative snap-center overflow-hidden ${
                        hasLink ? 'cursor-pointer' : ''
                      }`}
                    >
                      <img
                        src={slide.image}
                        alt={slide.title}
                        draggable={false}
                        className={`w-full h-full object-cover pointer-events-none ${
                          hasLink ? 'transition-transform duration-500 group-hover:scale-[1.02]' : ''
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/88 via-50% to-slate-950/10 pointer-events-none" />

                      <div className="absolute inset-0 px-5 sm:px-7 md:px-8 pb-24 sm:pb-28 flex flex-col justify-end pointer-events-none">
                        <div className="space-y-1.5 max-w-2xl min-w-0">
                          <h3 className="text-xl sm:text-2xl md:text-[1.75rem] font-display font-black tracking-tight text-white line-clamp-2 leading-[1.18] [overflow-wrap:anywhere]">
                            {slide.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-200/95 line-clamp-2 leading-relaxed font-medium [overflow-wrap:anywhere]">
                            {slide.description}
                          </p>
                          {(slide.eventDate || hasLink) && (
                            <div className="pt-0.5 flex flex-wrap items-center gap-3 text-xs font-bold">
                              {slide.eventDate && (
                                <span className="text-slate-200 tabular-nums">
                                  {formatEventDateLabel(slide.eventDate)}
                                </span>
                              )}
                              {hasLink && (
                                <span className="inline-flex items-center gap-1 text-primary-400 group-hover:text-white transition-colors">
                                  <span>{isExternalEventLink(slide.link) ? t('patient.dashboard.openLink') : t('patient.dashboard.viewPage')}</span>
                                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls: Dots + Action Buttons */}
            <div className="relative z-10 px-5 sm:px-7 md:px-8 pb-5 sm:pb-7 pt-2 space-y-3 mt-auto">
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1.5 py-1">
                  {carouselSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToSlide(idx);
                      }}
                      aria-label={t('patient.dashboard.goToSlideAria', { num: idx + 1 })}
                      className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                        currentSlide === idx ? 'w-3.5 bg-white shadow-sm' : 'w-1 bg-white/40 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3.5 w-full">
                <Link
                  to="/patient/providers"
                  className="neu-btn-primary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer shadow-lg shadow-blue-950/40 text-white"
                >
                  <MagnifyingGlass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white" />
                  <span className="truncate">{t('patient.dashboard.findProviderCta')}</span>
                </Link>
                <Link
                  to="/patient/requests"
                  className="btn-glass-neu-secondary w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] transition-all text-center cursor-pointer text-white"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
                  <span className="truncate">{t('patient.dashboard.myRequestsCta')}</span>
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
                    {t('patient.dashboard.requestStatusCard')}
                  </h4>
                  <Link
                    to="/patient/requests"
                    className="text-xs font-bold text-link hover:text-primary-600 dark:hover:text-primary-300 transition-colors inline-flex items-center gap-0.5"
                  >
                    {t('patient.dashboard.viewAllLink')} &rarr;
                  </Link>
                </div>

                {/* Priority Active Card with Live Beacon or Clean Empty State */}
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
                    className="mb-3 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl flex flex-col gap-1.5 sm:gap-2 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 dark:border-emerald-500/30 transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-2xs font-black text-success dark:text-success-dark uppercase tracking-wider">
                          {t('patient.dashboard.activeVisitBannerTitle', { status: translateStatus(activeVisit.status) })}
                        </span>
                      </div>
                      <span className="text-2xs sm:text-xs font-bold text-success dark:text-success-dark neu-flat-sm px-2 py-0.5 rounded-md">
                        {['On The Way', 'Arrived'].includes(activeVisit.status) ? t('patient.dashboard.trackLiveArrow') : (activeVisit.time || t('patient.dashboard.today'))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-txt-primary dark:text-txt-darkPrimary truncate group-hover:text-link transition-colors">
                          {activeVisit.provider}
                        </p>
                        <p className="text-2xs sm:text-xs text-txt-secondary dark:text-txt-darkSecondary truncate">
                          {activeVisit.service ? translateService(activeVisit.service) : t('patient.dashboard.homeConsultation')}
                        </p>
                      </div>
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl neu-flat-sm flex items-center justify-center text-txt-secondary group-hover:text-link group-hover:scale-105 transition-all shrink-0">
                        <CaretRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="mb-3 px-3 py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 text-tertiary">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      <p className="text-2xs sm:text-xs font-semibold text-tertiary dark:text-tertiary truncate">
                        {t('patient.dashboard.noVisitsToday')}
                      </p>
                    </div>
                    <Link
                      to="/patient/providers"
                      className="text-2xs sm:text-xs font-bold text-link hover:underline shrink-0"
                    >
                      {t('patient.dashboard.bookAVisit')}
                    </Link>
                  </div>
                )}

                {/* 3 Separate Neumorphic Stat Cards */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-link dark:text-primary-300 leading-none">
                      {stats.active}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-link dark:text-primary-300 uppercase tracking-wider mt-1 sm:mt-1.5">
                      {t('patient.dashboard.statActive')}
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-warning dark:text-warning-dark leading-none">
                      {stats.pending}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-warning dark:text-warning-dark uppercase tracking-wider mt-1 sm:mt-1.5">
                      {t('patient.dashboard.statPending')}
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center p-2 sm:p-3 rounded-xl sm:rounded-2xl neu-flat-sm select-text">
                    <p className="text-lg sm:text-2xl font-display font-black text-success dark:text-success-dark leading-none">
                      {stats.accepted}
                    </p>
                    <p className="text-2xs sm:text-xs font-black text-success dark:text-success-dark uppercase tracking-wider mt-1 sm:mt-1.5">
                      {t('patient.dashboard.statConfirmed')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions List with Rounded Icon Badges */}
              <div className="flex items-center justify-between mb-2 sm:mb-2.5">
                <h3 className="text-sm sm:text-base font-display font-extrabold text-slate-900 dark:text-white">
                  {t('patient.dashboard.quickActionsTitle')}
                </h3>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                <Link
                  to="/patient/providers"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform">
                    <MagnifyingGlass className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[0.8125rem] font-bold">{t('patient.dashboard.qaFindProvider')}</span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">{t('patient.dashboard.qaFindProviderDesc')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/requests"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[0.8125rem] font-bold">
                      {t('patient.dashboard.qaMyRequests')} {stats.pending > 0 && `(${stats.pending})`}
                    </span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">{t('patient.dashboard.qaMyRequestsDesc')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>

                <Link
                  to="/patient/messages"
                  className="group neu-btn p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 transition-all text-slate-800 dark:text-slate-200 active:scale-[0.99]"
                >
                  <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-link shrink-0 group-hover:scale-105 transition-transform relative">
                    <ChatCircle className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white rounded-full text-xs font-extrabold flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs sm:text-[0.8125rem] font-bold">
                      {t('patient.dashboard.qaMessages')} {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    <span className="block text-2xs sm:text-xs text-tertiary truncate">{t('patient.dashboard.qaMessagesDesc')}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-tertiary group-hover:text-link group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Live Visit Tracker */}
        {activeVisit && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <div className="w-full neu-flat rounded-2xl sm:rounded-[2.25rem] p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between">
              {(() => {
              const STATUS_STEPS = ['Accepted', 'On The Way', 'Arrived', 'Completed'];
              const STEP_LABELS = [
                t('patient.dashboard.stepConfirmed'),
                t('patient.dashboard.stepOnRoute'),
                t('patient.dashboard.stepArrived'),
                t('patient.dashboard.stepDone'),
              ];
              const STEP_ICONS = [
                <CheckCircle key="confirmed" className="w-4 h-4" />,
                <NavigationArrow key="enroute" className="w-4 h-4" />,
                <House key="arrived" className="w-4 h-4" />,
                <Stethoscope key="done" className="w-4 h-4" />,
              ];
              const currentStep = STATUS_STEPS.indexOf(activeVisit.status);

              const STATUS_MESSAGES = {
                Accepted: t('patient.dashboard.msgAccepted'),
                'On The Way': t('patient.dashboard.msgOnTheWay'),
                Arrived: t('patient.dashboard.msgArrived'),
                Completed: t('patient.dashboard.msgCompleted'),
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
                        title={t('patient.dashboard.viewProviderTitle')}
                        className="neu-flat-sm w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-link font-black text-sm overflow-hidden shrink-0 hover:scale-105 transition-transform"
                      >
                        {activeVisit.providerAvatarUrl ? (
                          <img src={activeVisit.providerAvatarUrl} alt={activeVisit.provider} className="w-full h-full object-cover" />
                        ) : (
                          providerInitials
                        )}
                      </Link>
                      <div className="min-w-0">
                        <div className="neu-flat-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-nano font-extrabold uppercase tracking-wider text-txt-secondary dark:text-txt-darkSecondary mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2C7A55] dark:bg-[#7DD3A3] animate-ping" />
                          {t('patient.dashboard.liveTrackerTitle')}
                        </div>
                        <Link
                          to={activeVisit.providerId ? `/patient/providers/${activeVisit.providerId}/profile` : '#'}
                          className="text-lg sm:text-xl font-display font-extrabold text-txt-primary dark:text-txt-darkPrimary hover:text-link dark:hover:text-link transition-colors truncate block"
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
                          className="neu-btn min-h-[2.75rem] px-3.5 py-2.5 rounded-2xl text-xs font-bold text-link transition-all flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer"
                          title={t('patient.dashboard.openLiveGpsTitle')}
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <NavigationArrow className="w-4 h-4" />
                          <span>{t('patient.dashboard.trackLiveBtn')}</span>
                        </button>
                      )}
                      <Link 
                        to={`/patient/messages?provider=${activeVisit.providerId}`}
                        className="neu-btn w-11 h-11 rounded-2xl text-link transition-all flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0.5"
                        title={t('patient.dashboard.chatProviderTitle')}
                        aria-label={t('patient.dashboard.chatWithAria', { name: activeVisit.provider })}
                      >
                        <ChatText className="w-4 h-4" />
                      </Link>
                      <span className="neu-flat-sm text-xs font-bold text-link px-4 py-2 rounded-2xl">
                        {translateService(activeVisit.service)}
                      </span>
                    </div>
                  </div>

                  {/* Visit Time and Date Neumorphic Raised Chips */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-txt-secondary dark:text-txt-darkSecondary">
                    <div className="neu-flat-sm px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-link" />
                      <span>{activeVisit.date}</span>
                    </div>
                    {activeVisit.time && (
                      <div className="neu-flat-sm px-3.5 py-1.5 rounded-xl flex items-center gap-2 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-link" />
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
                                  : 'neu-flat-sm text-txt-secondary dark:text-txt-darkSecondary opacity-90'
                            }`}>
                              {isPassed ? <CheckCircle className="w-4 h-4 text-[#2C7A55] dark:text-[#7DD3A3]" /> : STEP_ICONS[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between px-1">
                      {STEP_LABELS.map((label, i) => (
                        <span key={label} className={`text-nano font-extrabold uppercase tracking-wider text-center transition-colors ${
                          i <= currentStep ? 'text-link font-bold' : 'text-txt-secondary/60 dark:text-txt-darkSecondary/60'
                        }`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="neu-flat-sm p-4 rounded-2xl flex items-center gap-3.5 text-sm font-medium text-txt-primary dark:text-txt-darkPrimary">
                    <div className="w-3 h-3 rounded-full bg-primary shrink-0 animate-ping" />
                    <p className="leading-relaxed text-xs sm:text-sm">{STATUS_MESSAGES[activeVisit.status]}</p>
                  </div>
                </div>
              );
              })()}
            </div>
          </motion.div>
        )}

        {/* Recent Requests Section with Neumorphic Table / List (Compact layout) */}
        <section className="neu-flat rounded-2xl sm:rounded-[2.25rem] p-3.5 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-surface-border">
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-txt-primary dark:text-txt-darkPrimary">
                {t('patient.dashboard.recentTitle')}
              </h2>
              <p className="text-xs sm:text-xs text-txt-secondary dark:text-txt-darkSecondary mt-0.5">
                {t('patient.dashboard.showingRecords', { shown: Math.min(requests.length, 5), total: requests.length })}
              </p>
            </div>
            <Link
              to="/patient/requests"
              className="neu-btn px-3 py-1.5 rounded-xl text-xs sm:text-xs font-bold text-link inline-flex items-center gap-1 active:scale-95"
            >
              {t('patient.dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
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
                    <div className="neu-flat-sm w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden flex items-center justify-center text-link text-xs sm:text-xs font-black shrink-0 p-0.5">
                      {req.providerAvatarUrl ? (
                        <img src={req.providerAvatarUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        req.provider.split(' ').map(n => n[0]).join('').slice(0, 2)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs sm:text-sm text-txt-primary dark:text-txt-darkPrimary group-hover:text-link transition-colors truncate">
                        {req.provider}
                      </p>
                      <p className="text-xs sm:text-xs text-txt-secondary dark:text-txt-darkSecondary truncate mt-0.5">
                        {translateService(req.service)} &bull; {req.date} {req.time ? `(${req.time})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`neu-flat-sm text-2xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      ['Accepted', 'On The Way', 'Arrived', 'Completed'].includes(req.status)
                        ? 'text-[#2C7A55] dark:text-[#7DD3A3] border border-[#2C7A55]/30 dark:border-[#7DD3A3]/30 bg-[#E1F3EA] dark:bg-[#14301F]'
                        : req.status === 'Pending'
                        ? 'text-[#9C5A06] dark:text-[#F1BD6B] border border-[#9C5A06]/30 dark:border-[#F1BD6B]/30 bg-[#FFF1D6] dark:bg-[#34260E]'
                        : ['Cancelled', 'Rejected'].includes(req.status)
                        ? 'text-[#BC3030] dark:text-[#F4918B] border border-[#BC3030]/30 dark:border-[#F4918B]/30 bg-[#FCE8E6] dark:bg-[#3C1B1A]'
                        : 'text-txt-secondary dark:text-txt-darkSecondary border border-surface-border bg-surface-subtle'
                    }`}>
                      {translateStatus(req.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="neu-flat-sm p-8 rounded-2xl text-center">
              <div className="neu-flat w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 text-link">
                <FileText className="w-5 h-5" />
              </div>
              <p className="font-bold text-txt-primary dark:text-txt-darkPrimary text-sm">{t('patient.dashboard.noRequestsTitle')}</p>
              <p className="text-xs text-txt-secondary dark:text-txt-darkSecondary mt-1 max-w-xs mx-auto">
                {t('patient.dashboard.noRequestsMsg')}
              </p>
              <Link
                to="/patient/providers"
                className="neu-btn-primary mt-4 text-xs font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
              >
                <MagnifyingGlass className="w-3.5 h-3.5" /> {t('patient.dashboard.browseProvidersBtn')}
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
