import React, { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  MagnifyingGlass,
  Star,
  MapPin,
  X,
  Calendar,
  Clock,
  House,
  ArrowRight,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Check,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkeletonPage, EmptyState, Sheet, SheetContent, SheetTitle, SheetDescription, BrandSuccess } from '@/shared/ui';
import { ReviewCard } from '@/shared/components';
import { usePresence } from '@/contexts/PresenceContext';
import { VisitDestinationModal } from '@/features/tracking/components';
import { ensurePatientCoords } from '@/features/tracking/services/geocoding';
import {
  bookVisitWithConsent,
  filterAvailableBookingSlots,
  preserveOpenSlotPeriod,
  shouldClearSelectedBookingSlot,
  startBookingAvailabilityRefresh,
} from '@/features/patient/services/booking';
import { toLocalDateKey, parseLocalDate, formatSlotLabel } from '@/lib/localDate';
import { getServiceDurationMinutes, getServiceSlotsCount } from '@/config/constants';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import useBottomDrawerDrag from '@/hooks/useBottomDrawerDrag';

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;

const getProviderInitials = (fullName = '') => {
  return String(fullName || 'HP')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

const formatSlotParts = (timeStr, durationMinutes = 30, t) => {
  const [hStr, mStr] = String(timeStr || '09:00').split(':');
  const m = Number(hStr) * 60 + Number(mStr);
  const startH = Math.floor(m / 60);
  const startMin = m % 60;
  const startPeriod = startH >= 12 ? 'PM' : 'AM';
  const displayStartH = startH % 12 === 0 ? 12 : startH % 12;
  const startLabel = `${displayStartH}:${String(startMin).padStart(2, '0')} ${startPeriod}`;

  const endM = m + durationMinutes;
  const endH = Math.floor(endM / 60);
  const endMin = endM % 60;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  const displayEndH = endH % 12 === 0 ? 12 : endH % 12;
  const endTimeStr = `${displayEndH}:${String(endMin).padStart(2, '0')} ${endPeriod}`;
  const endLabel = t ? t('patient.providers.endSlotRange', { time: endTimeStr }) : `to ${endTimeStr}`;

  return { startLabel, endLabel };
};

const PatientProviders = () => {
  const { isUserOnline } = usePresence();
  const { t, isTagalog, translateService, translateStatus } = useLanguage();
  const locale = isTagalog ? 'tl-PH' : 'en-US';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [requested, setRequested] = useState([]);
  const [activeRequestsMap, setActiveRequestsMap] = useState({});

  const bookingSchema = useMemo(() => z.object({
    service: z.string().min(1, t('patient.providers.selectServiceError')),
    date: z.string().min(1, t('patient.providers.selectDateError')).refine(d => d >= new Date().toLocaleDateString('en-CA'), t('patient.providers.pastDateError')),
    time: z.string().min(1, t('patient.providers.selectTimeError')),
    notes: z.string().optional(),
    consent: z.literal(true, { errorMap: () => ({ message: t('patient.providers.consentRequiredError') }) }),
  }), [t]);

  // Maps the patient's active request status with a provider to a button label.
  const getBookingButtonLabel = (providerId) => {
    const status = activeRequestsMap[providerId];
    if (!status) return null;
    switch (status) {
      case 'Pending': return t('patient.providers.btnPending');
      case 'Accepted': return t('patient.providers.btnConfirmed');
      case 'On The Way': return t('patient.providers.btnOnTheWay');
      case 'Arrived': return t('patient.providers.btnArrived');
      default: return t('patient.providers.btnOtherVisit', { status: translateStatus(status) });
    }
  };
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setSearchHistory] = useState([]);
  const searchRef = React.useRef(null);
  const availabilityContextRef = React.useRef(null);
  
  // Booking & Viewing Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const bookingTriggerRef = React.useRef(null);
  const sheetTriggerRef = React.useRef(null);
  const [viewingProvider, setViewingProvider] = useState(null);
  const [providerReviews, setProviderReviews] = useState([]);
  const [sheetTab, setSheetTab] = useState('overview');
  const [showAllServices, setShowAllServices] = useState(false);
  const [openServiceMenu, setOpenServiceMenu] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues, reset } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { service: '', date: '', time: '', notes: '', consent: false },
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState('form');
  const [bookingDir, setBookingDir] = useState('right');
  const [showBookingNotes, setShowBookingNotes] = useState(false);
  const [highlightSection, setHighlightSection] = useState(null);
  const [confirmedSnapshot, setConfirmedSnapshot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const bookingScrollRef = React.useRef(null);
  const serviceSectionRef = React.useRef(null);
  const scheduleSectionRef = React.useRef(null);
  const locationSectionRef = React.useRef(null);
  const consentSectionRef = React.useRef(null);
  const [patientHome, setPatientHome] = useState(null);
  const [visitDestination, setVisitDestination] = useState(null);
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [slotPeriod, setSlotPeriod] = useState('am');
  const watchedDate = watch('date');
  const watchedService = watch('service');
  const watchedTime = watch('time');

  const serviceDurationMinutes = useMemo(() => getServiceDurationMinutes(watchedService), [watchedService]);
  const serviceSlotsCount = useMemo(() => getServiceSlotsCount(watchedService), [watchedService]);

  const morningSlots = useMemo(
    () => availableSlots.filter((s) => Number(String(s.time || '').split(':')[0]) < 12),
    [availableSlots]
  );
  const afternoonSlots = useMemo(
    () => availableSlots.filter((s) => Number(String(s.time || '').split(':')[0]) >= 12),
    [availableSlots]
  );

  useEffect(() => {
    if (availableSlots.length === 0) return;
    const nextPeriod = preserveOpenSlotPeriod(slotPeriod, morningSlots, afternoonSlots);
    if (nextPeriod !== slotPeriod) setSlotPeriod(nextPeriod);
  }, [availableSlots, morningSlots, afternoonSlots, slotPeriod]);

  const watchedConsent = watch('consent');
  const watchedNotes = watch('notes');

  const dateOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    const currentHour = now.getHours();

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const key = toLocalDateKey(d);
      const isToday = i === 0;
      const isTomorrow = i === 1;

      if (isToday && currentHour >= WORKING_HOURS_END) {
        continue;
      }

      const weekdayShort = d.toLocaleDateString(locale, { weekday: 'short' });
      const monthShort = d.toLocaleDateString(locale, { month: 'short' });
      const dayNum = d.getDate();
      const fullDate = d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
      const label = isToday
        ? t('patient.cancelReschedule.todayDateLabel', { date: `${monthShort} ${dayNum}` })
        : isTomorrow
          ? t('patient.cancelReschedule.tomorrowDateLabel', { date: fullDate })
          : fullDate;

      list.push({
        key,
        label,
        isToday,
        isTomorrow,
        dayShort: isToday ? t('patient.cancelReschedule.today') : isTomorrow ? t('patient.cancelReschedule.tmrw') : weekdayShort,
        weekdayShort,
        monthShort,
        dayNum,
        fullDate,
      });
    }
    return list;
  }, [locale, t]);

  const formatBookingDateLabel = (dateStr) => {
    if (!dateStr) return t('patient.providers.selectDatePrompt');
    const match = dateOptions.find((d) => d.key === dateStr);
    if (match) return match.label;
    const parsed = parseLocalDate(dateStr);
    if (!parsed) return dateStr;
    return parsed.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const focusSectionByKey = (sectionKey) => {
    if (!sectionKey) return;
    if (sectionKey === 'service') setOpenServiceMenu(true);
    const refMap = {
      service: serviceSectionRef,
      schedule: scheduleSectionRef,
      location: locationSectionRef,
      consent: consentSectionRef,
    };
    const targetRef = refMap[sectionKey];
    setHighlightSection(sectionKey);
    window.setTimeout(() => {
      targetRef?.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }, 90);
    window.setTimeout(() => {
      setHighlightSection((prev) => (prev === sectionKey ? null : prev));
    }, 1050);
  };

  const goToBookingStep = (step, dir = 'right', focusKey = null) => {
    setBookingDir(dir);
    setBookingStep(step);
    if (focusKey) {
      focusSectionByKey(focusKey);
    } else {
      window.setTimeout(() => {
        bookingScrollRef.current?.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
      }, 20);
    }
  };

  const closeBookingModal = () => {
    setSelectedProvider(null);
    setBookingStep('form');
    setBookingDir('right');
    setConfirmedSnapshot(null);
    setHighlightSection(null);
    setOpenServiceMenu(false);
    setShowBookingNotes(false);
  };

  const {
    drawerMotionProps: bookingDrawerMotionProps,
    dragHandleProps: bookingDragHandleProps,
  } = useBottomDrawerDrag({
    onClose: closeBookingModal,
    disabled: bookingStep === 'confirm' || bookingLoading,
  });

  const [sortBy, setSortBy] = useState('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = React.useRef(null);
  const [showSpecialtyMenu, setShowSpecialtyMenu] = useState(false);
  const specialtyMenuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
      if (specialtyMenuRef.current && !specialtyMenuRef.current.contains(e.target)) {
        setShowSpecialtyMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) {
      setPatientHome(null);
      setVisitDestination(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('patients')
        .select('address, latitude, longitude')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;

      const address = data?.address || '';
      setPatientHome({
        address,
        lat: data?.latitude ?? null,
        lng: data?.longitude ?? null,
      });

      if (data?.latitude != null && data?.longitude != null) {
        setVisitDestination((prev) => prev || {
          lat: data.latitude,
          lng: data.longitude,
          address,
          source: 'patient_home',
          confirmed: true,
          version: 0,
        });
      } else if (address) {
        const coords = await ensurePatientCoords(user.id);
        if (!active || !coords) return;
        // Keep patientHome as the saved pin/address only; geocoded coords are
        // an approximate hint and must not survive as a confirmed location.
        setPatientHome((prev) => ({ ...(prev || {}), address }));
        setVisitDestination((prev) => prev || {
          ...coords,
          address,
          source: 'geocoded',
          confirmed: false,
          version: 0,
        });
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      const saved = JSON.parse(localStorage.getItem(`search_history_${user.id}`) || '[]');
      setSearchHistory(saved);
    }
  }, [user]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('id, user_id, services, rating, location, is_approved, bio, phone, professional_id_status, trust_score, user:user_id(id, full_name, email, avatar_url)')
          .eq('is_approved', true);

        if (error) throw error;

        const shaped = (data || []).map(p => ({
          id: p.user_id,
          full_name: p.user?.full_name || 'Unknown',
          email: p.user?.email || '',
          phone: p.phone || '',
          bio: p.bio || 'Experienced healthcare professional dedicated to home care services in Muntinlupa.',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          professional_id_status: p.professional_id_status || 'none',
          trust_score: p.trust_score || 0,
          avatar_url: p.user?.avatar_url || '',
        }));

        setProviders(shaped);

        if (user) {
          const { data: existingRequests } = await supabase
            .from('requests')
            .select('provider_id, status')
            .eq('patient_id', user.id)
            .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

          if (existingRequests) {
            setRequested(existingRequests.map(r => r.provider_id));
            const statusMap = {};
            existingRequests.forEach(r => { statusMap[r.provider_id] = r.status; });
            setActiveRequestsMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Error fetching providers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`patient-providers-requests-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests', filter: `patient_id=eq.${user.id}` },
        async () => {
          const { data: ongoing } = await supabase
            .from('requests')
            .select('provider_id, status')
            .eq('patient_id', user.id)
            .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

          if (ongoing) {
            setRequested(ongoing.map((r) => r.provider_id));
            const statusMap = {};
            ongoing.forEach((r) => { statusMap[r.provider_id] = r.status; });
            setActiveRequestsMap(statusMap);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!viewingProvider) return;
    setProviderReviews([]);
    setSheetTab('overview');
    supabase
      .from('provider_reviews')
      .select('*, patient:patient_id(full_name)')
      .eq('provider_id', viewingProvider.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setProviderReviews(data || []);
      })
      .catch(() => {});
  }, [viewingProvider]);

  useEffect(() => {
    if (!searchTerm.trim() || !user) return;
    const timer = setTimeout(() => {
      setSearchHistory(prev => {
        const filtered = prev.filter(s => s !== searchTerm);
        const updated = [searchTerm, ...filtered].slice(0, 8);
        localStorage.setItem(`search_history_${user.id}`, JSON.stringify(updated));
        return updated;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [searchTerm, user]);

  useEffect(() => {
    if (!selectedProvider || !selectedProvider.id || !watchedDate || bookingStep === 'done') {
      setAvailableSlots([]);
      setLoadingSlots(false);
      if (!selectedProvider) availabilityContextRef.current = null;
      return;
    }

    const availabilityContext = JSON.stringify([
      selectedProvider.id,
      watchedDate,
      serviceDurationMinutes,
    ]);
    if (availabilityContextRef.current !== availabilityContext) {
      setAvailableSlots([]);
      availabilityContextRef.current = availabilityContext;
    }

    setLoadingSlots(true);
    const stopRefreshing = startBookingAvailabilityRefresh({
      providerId: selectedProvider.id,
      date: watchedDate,
      onSlots: busySlots => {
        const todayStr = toLocalDateKey();
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const candidates = [];
        const intervalMinutes = 30;
        const startMinutes = WORKING_HOURS_START * 60;
        const endMinutes = WORKING_HOURS_END * 60;

        for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
          // A contiguous booking cannot cross clinic closing hours (5:00 PM)
          if (m + serviceDurationMinutes > endMinutes) continue;

          const h = Math.floor(m / 60);
          const min = m % 60;
          const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
          const isPast = watchedDate < todayStr || (watchedDate === todayStr && m <= currentTotalMinutes);
          const label = formatSlotLabel(time, serviceDurationMinutes);

          candidates.push({
            time,
            label,
            durationMinutes: serviceDurationMinutes,
            isPast,
          });
        }

        setAvailableSlots(filterAvailableBookingSlots(candidates, busySlots, watchedDate));
        setLoadingSlots(false);
      },
      onError: err => {
        console.error('Error fetching available slots:', err);
        setLoadingSlots(false);
      },
    });
    return stopRefreshing;
  }, [selectedProvider, watchedDate, serviceDurationMinutes, bookingStep]);

  useEffect(() => {
    if (!selectedProvider || !shouldClearSelectedBookingSlot(watchedTime, availableSlots, loadingSlots)) return;
    if (bookingStep === 'confirm') {
      setBookingStep('form');
      toast.error(t('patient.providers.slotUnavailableToast'));
    }
    if (watchedTime) {
      setValue('time', '', { shouldValidate: true });
    }
  }, [selectedProvider, availableSlots, watchedTime, loadingSlots, bookingStep, setValue, t]);

  // Toggle body class when modals open to hide bottom nav
  useBodyScrollLock(Boolean(selectedProvider || viewingProvider));

  const allSpecialties = useMemo(() => {
    const set = new Set();
    const defaults = ['Elderly Care', 'Physical Therapy', 'Post-Surgery Care', 'Companion Care', 'Medication Management'];
    defaults.forEach(s => set.add(s));
    providers.forEach(p => {
      (p.services || []).forEach(s => {
        if (s && typeof s === 'string' && s.trim()) {
          set.add(s.trim());
        }
      });
    });
    return ['All', ...Array.from(set).sort()];
  }, [providers]);

  const sortedProviders = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const filtered = providers.filter(p => {
      const matchesCategory = selectedCategory === 'All' || (p.services || []).some(s => {
        const normS = s.toLowerCase();
        const normC = selectedCategory.toLowerCase();
        return normS.includes(normC) || normC.includes(normS);
      });
      if (!matchesCategory) return false;

      const matchesSearch = !q ||
        p.full_name?.toLowerCase().includes(q) ||
        (p.services || []).some(s => s.toLowerCase().includes(q)) ||
        p.location?.toLowerCase().includes(q) ||
        p.bio?.toLowerCase().includes(q);
      return matchesSearch;
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular': return (b.rating || 0) - (a.rating || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'trust': return (b.trust_score || 0) - (a.trust_score || 0);
        default: return 0;
      }
    });
  }, [providers, selectedCategory, searchTerm, sortBy]);
  const openBookingModal = (provider, presetService, triggerEl = null) => {
    bookingTriggerRef.current = triggerEl;
    const existingStatus = activeRequestsMap[provider.id];
    if (requested.includes(provider.id) || existingStatus) {
      const providerName = provider.full_name || t('patient.providers.thisProviderFallback');
      toast(
        existingStatus === 'Pending'
          ? t('patient.providers.alreadyPendingToast', { name: providerName })
          : t('patient.providers.alreadyOngoingToast', {
              status: existingStatus ? translateStatus(existingStatus) : t('patient.providers.ongoingFallback'),
              name: providerName,
            }),
        { icon: 'ℹ️' }
      );
      navigate('/patient/requests');
      return;
    }
    setSelectedProvider(provider);
    setBookingStep('form');
    setBookingDir('right');
    setShowBookingNotes(false);
    setHighlightSection(null);
    setConfirmedSnapshot(null);
    setOpenServiceMenu(false);
    setAvailableSlots([]);
    if (user?.id && !visitDestination) {
      ensurePatientCoords(user.id).then((coords) => {
        if (!coords) return;
        setVisitDestination((prev) => prev || {
          ...coords,
          address: patientHome?.address || '',
          source: 'geocoded',
          confirmed: false,
          version: 0,
        });
      });
    }
    const initialDate = (() => {
      const now = new Date();
      if (now.getHours() >= WORKING_HOURS_END) {
        const tmr = new Date(now);
        tmr.setDate(tmr.getDate() + 1);
        return toLocalDateKey(tmr);
      }
      return toLocalDateKey(now);
    })();

    setShowCustomDatePicker(false);
    reset({
      service: presetService || provider.services?.[0] || 'General Care',
      date: initialDate,
      time: '',
      notes: '',
      consent: false,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const bookId = params.get('book');
    const serviceParam = params.get('service') || undefined;
    if (!bookId && serviceParam) {
      setSearchTerm(serviceParam);
      window.history.replaceState({}, '', location.pathname);
      return;
    }
    if (loading || providers.length === 0) return;
    if (bookId) {
      const target = providers.find(p => String(p.id) === String(bookId));
      if (target) {
        openBookingModal(target, serviceParam);
      }
      window.history.replaceState({}, '', location.pathname);
    }
  }, [loading, providers, location.search, location.pathname]);

  const destinationConfirmed = Boolean(
    visitDestination?.lat != null
    && visitDestination?.lng != null
    && visitDestination?.confirmed !== false
  );

  const handleReviewBooking = async () => {
    if (!user || !selectedProvider) return;

    let destination = visitDestination;
    if (!destination) {
      const coords = await ensurePatientCoords(user.id);
      if (coords) {
        destination = {
          ...coords,
          address: patientHome?.address || '',
          source: 'geocoded',
          confirmed: false,
          version: 0,
        };
        setVisitDestination((prev) => prev || destination);
      }
    }

    // A geocoded centroid is only a starting point on the map; the patient
    // must place and confirm the pin before the request is created.
    if (!destination?.lat || destination?.confirmed === false) {
      setDestinationModalOpen(true);
      toast.error(
        destination
          ? t('patient.providers.pinBeforeBookingError')
          : t('patient.providers.setLocationError')
      );
      return;
    }

    goToBookingStep('confirm', 'right');
  };

  const handleBookingValidationError = (fieldErrors) => {
    if (fieldErrors?.service) {
      focusSectionByKey('service');
      toast.error(fieldErrors.service.message || t('patient.providers.selectServiceError'));
    } else if (fieldErrors?.date || fieldErrors?.time) {
      focusSectionByKey('schedule');
      toast.error(fieldErrors.time?.message || fieldErrors.date?.message || t('patient.providers.chooseSlotToast'));
    } else if (fieldErrors?.consent) {
      focusSectionByKey('consent');
      toast.error(fieldErrors.consent.message || t('patient.providers.confirmConsentToast'));
    }
  };

  const handleBookingSubmit = async () => {
    if (!user || !selectedProvider) return;

    const values = getValues();
    setBookingLoading(true);

    if (!values.time) {
      toast.error(t('patient.providers.chooseSlotToast'));
      setBookingLoading(false);
      setBookingStep('form');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('requests')
        .select('id')
        .eq('patient_id', user.id)
        .eq('provider_id', selectedProvider.id)
        .eq('status', 'Pending');

      if (existing && existing.length > 0) {
        toast.error(t('patient.providers.duplicatePendingToast'));
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }

      let destination = visitDestination;
      if (!destination) {
        const coords = await ensurePatientCoords(user.id);
        if (coords) {
          destination = {
            ...coords,
            address: patientHome?.address || '',
            source: 'geocoded',
            confirmed: false,
            version: 0,
          };
        }
      }
      if (!destination) {
        toast.error(t('patient.providers.confirmLocationToast'));
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }
      if (destination.confirmed === false) {
        setDestinationModalOpen(true);
        toast.error(t('patient.providers.pinBeforeBookingError'));
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }

      // 1. Capture provider info before it gets cleared
      const providerId = selectedProvider.id;

      // 1b. Defense-in-depth: verify no active booking with this provider exists before creating new one
      const { data: existingActive } = await supabase
        .from('requests')
        .select('id, status')
        .eq('patient_id', user.id)
        .eq('provider_id', providerId)
        .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived'])
        .maybeSingle();

      if (existingActive) {
        toast(
          existingActive.status === 'Pending'
            ? 'You already have a pending booking request with this provider.'
            : `You already have an ongoing visit (${existingActive.status}) with this provider. Track it in My Requests.`,
          { icon: 'ℹ️' }
        );
        setRequested(prev => [...new Set([...prev, providerId])]);
        setActiveRequestsMap(prev => ({ ...prev, [providerId]: existingActive.status }));
        setBookingLoading(false);
        setSelectedProvider(null);
        navigate('/patient/requests');
        return;
      }

      // The server saves the request and consent in one transaction.
      try {
        await bookVisitWithConsent({
          providerId,
          values,
          durationMinutes: serviceDurationMinutes,
          destination,
        });
      } catch (reqError) {
        // Database constraints remain authoritative for concurrent bookings.
        if (reqError.code === '23505' || reqError.code === '23P01') {
          toast.error(t('patient.providers.slotTakenConcurrent'));
          setBookingLoading(false);
          setBookingStep('form');
          return;
        }
        throw reqError;
      }
      setConfirmedSnapshot({
        providerName: selectedProvider.full_name,
        service: values.service,
        date: values.date,
        time: values.time,
        durationMinutes: serviceDurationMinutes,
        address: destination.address || patientHome?.address || '',
      });
      setRequested(prev => [...new Set([...prev, providerId])]);
      setActiveRequestsMap(prev => ({ ...prev, [providerId]: 'Pending' }));
      setVisitDestination(
        patientHome?.lat != null
          ? {
              lat: patientHome.lat,
              lng: patientHome.lng,
              address: patientHome.address || '',
              source: 'patient_home',
              confirmed: true,
              version: 0,
            }
          : null
      );
      toast.success(t('patient.providers.bookingSuccessToast'));
      goToBookingStep('done', 'right');
      if (!prefersReducedMotion) {
        confetti({ particleCount: 95, spread: 72, origin: { y: 0.52 }, zIndex: 9999 });
      }
    } catch (err) {
      console.error('Error sending request:', err);
      toast.error(err.message || t('patient.providers.bookingErrorToast'));
      setBookingStep('form');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;

  const sortOptions = [
    { value: 'popular', label: t('patient.providers.sortPopular') },
    { value: 'rating', label: t('patient.providers.sortHighestRated') },
    { value: 'trust', label: t('patient.providers.sortTrustScore') },
  ];

  return (
    <DashboardLayout role="patient">
      <div className="space-y-5 relative pb-6 w-full max-w-full">

        {/* Slim Inline Title Row + Unified Search & Mobile 1A 50/50 Filter Bar */}
        <section className="space-y-3.5 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h1 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white">
                {t('patient.providers.pageTitle')}
              </h1>
              <p className="text-xs sm:text-sm text-tertiary dark:text-tertiary mt-0.5 max-w-xl">
                {t('patient.providers.pageSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="neu-flat-sm px-3 py-1.5 rounded-xl text-xs font-extrabold text-link border border-white/60 dark:border-white/5">
                {t(
                  sortedProviders.length === 1
                    ? 'patient.providers.showingOne'
                    : 'patient.providers.showingMany',
                  { count: sortedProviders.length }
                )}
              </span>
            </div>
          </div>

          {/* Control Surface: Row 1 Search Input + Row 2 Mobile 1A 50/50 Split Specialty & Sort Buttons */}
          <div className="neu-flat p-2.5 sm:p-3 rounded-2xl border border-white/70 dark:border-white/5 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Search Input Container */}
            <div className="relative flex-1 min-w-0" ref={searchRef}>
              <label htmlFor="provider-search" className="sr-only">{t('patient.providers.searchAria')}</label>
              <div className="neu-inset px-3 py-2 rounded-xl flex items-center gap-2.5 h-[2.875rem] sm:h-[3rem]">
                <MagnifyingGlass className="w-4 h-4 text-link shrink-0" />
                <input
                  id="provider-search"
                  type="text"
                  placeholder={t('patient.providers.searchPlaceholder')}
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-0.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchTerm(''); }}
                    aria-label={t('patient.providers.clearSearchAria')}
                    className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-danger transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile 1A: 50/50 Split Specialty & Sort Buttons (Zero Horizontal Scrollbar) */}
            <div className="grid grid-cols-2 md:flex items-center gap-2 shrink-0">
              {/* Specialty Picker Button (Left 50% on Mobile) */}
              <div className="relative md:min-w-[12.8125rem] z-50" ref={specialtyMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpecialtyMenu(prev => !prev);
                    setShowSortMenu(false);
                  }}
                  className={`w-full neu-btn px-3 py-2 rounded-xl flex items-center justify-between gap-2 h-[2.875rem] sm:h-[3rem] transition-all cursor-pointer outline-none select-none ${
                    showSpecialtyMenu ? 'ring-2 ring-primary/20' : ''
                  }`}
                  aria-label={t('patient.providers.filterSpecialtyAria')}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[0.5625rem] font-extrabold uppercase tracking-wider text-tertiary leading-none">
                      {t('patient.providers.specialtyLabel')}
                    </span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-1">
                      {selectedCategory === 'All' ? t('patient.providers.allSpecialties') : translateService(selectedCategory)}
                    </span>
                  </div>
                  <CaretDown className={`w-3.5 h-3.5 text-link transition-transform duration-200 shrink-0 ${showSpecialtyMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Specialty Floating Popover Menu (2-Column Grid on Mobile for Zero Scroll Clutter) */}
                <AnimatePresence>
                  {showSpecialtyMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="absolute left-0 md:left-auto md:right-0 top-full mt-2 w-[calc(200%+0.5rem)] md:w-72 neu-flat rounded-2xl p-2.5 z-50 shadow-2xl border border-white/70 dark:border-white/10 max-h-80 overflow-y-auto no-scrollbar"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-200/60 dark:border-white/5 mb-2 flex items-center justify-between">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">{t('patient.providers.filterBySpecialtyTitle')}</span>
                        {selectedCategory !== 'All' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory('All');
                              setShowSpecialtyMenu(false);
                            }}
                            className="text-2xs font-extrabold text-link hover:underline cursor-pointer"
                          >
                            {t('patient.providers.resetBtn')}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('All');
                            setShowSpecialtyMenu(false);
                          }}
                          className={`col-span-2 md:col-span-1 w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            selectedCategory === 'All'
                              ? 'bg-primary text-white font-bold shadow-sm'
                              : 'neu-flat-sm text-slate-700 dark:text-slate-300 hover:text-link'
                          }`}
                        >
                          <span>{t('patient.providers.allSpecialties')}</span>
                          {selectedCategory === 'All' && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                        {allSpecialties.filter(s => s !== 'All').map((spec) => {
                          const active = selectedCategory === spec;
                          return (
                            <button
                              key={spec}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(spec);
                                setShowSpecialtyMenu(false);
                              }}
                              className={`w-full text-left px-2.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                                active
                                  ? 'bg-primary text-white font-bold shadow-sm'
                                  : 'neu-flat-sm text-slate-700 dark:text-slate-300 hover:text-link'
                              }`}
                            >
                              <span className="truncate">{translateService(spec)}</span>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sort Picker Button (Right 50% on Mobile) */}
              <div className="relative md:min-w-[11.5625rem] z-50" ref={sortMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSortMenu(prev => !prev);
                    setShowSpecialtyMenu(false);
                  }}
                  className={`w-full neu-btn px-3 py-2 rounded-xl flex items-center justify-between gap-2 h-[2.875rem] sm:h-[3rem] transition-all cursor-pointer relative outline-none select-none ${
                    showSortMenu ? 'ring-2 ring-primary/20' : ''
                  }`}
                  aria-label={t('patient.providers.sortAria')}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[0.5625rem] font-extrabold uppercase tracking-wider text-tertiary leading-none">
                      {t('patient.providers.sortByLabel')}
                    </span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-1">
                      {sortOptions.find(o => o.value === sortBy)?.label || t('patient.providers.sortPopular')}
                    </span>
                  </div>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-link shrink-0" />
                </button>

                {/* Sort Floating Popover Menu */}
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -4 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-2 w-56 neu-flat rounded-2xl p-2.5 z-50 shadow-2xl border border-white/70 dark:border-white/10"
                    >
                      <div className="px-2.5 py-1.5 border-b border-slate-200/60 dark:border-white/5 mb-1.5 flex items-center justify-between">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">{t('patient.providers.sortProvidersTitle')}</span>
                        <span className="text-2xs text-link font-bold">
                          {sortOptions.find(o => o.value === sortBy)?.label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {sortOptions.map((opt) => {
                          const active = sortBy === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setSortBy(opt.value);
                                setShowSortMenu(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                active
                                  ? 'bg-primary text-white font-bold shadow-sm'
                                  : 'neu-flat-sm text-slate-700 dark:text-slate-300 hover:text-link'
                              }`}
                            >
                              <span>{opt.label}</span>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
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
        </section>

        {/* Option 1: Clean 3-Layer Provider Cards Grid (Spring Health / Rula Pattern) */}
        {sortedProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {sortedProviders.map((p, idx) => {
              const hasActiveReq = requested.includes(p.id);
              const servicesList = Array.isArray(p.services) && p.services.length > 0
                ? p.services
                : ['General Consultation'];
              return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: Math.min(idx, 9) * 0.04 }}
                className="group neu-flat p-5 rounded-[1.5rem] border border-white/80 dark:border-white/5 flex flex-col justify-between gap-4 select-text transition-all"
              >
                <div className="space-y-4">
                  {/* Layer 1: Identity Row (64px Squircle Avatar / Initials + Verified Name + Location + Single Clean Meta Pill) */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shrink-0 border-2 border-white dark:border-slate-700 shadow-md neu-flat-sm flex items-center justify-center text-base sm:text-lg font-extrabold text-link">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.full_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'inline';
                            }
                          }}
                        />
                      ) : null}
                      <span style={{ display: p.avatar_url ? 'none' : 'inline' }}>
                        {getProviderInitials(p.full_name)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-extrabold tracking-tight text-slate-900 dark:text-slate-100 text-base sm:text-lg truncate">
                          {p.full_name}
                        </h3>
                        <ShieldCheck className="w-4 h-4 text-link shrink-0" title={t('patient.common.verifiedProvider')} />
                      </div>
                      <p className="text-xs font-semibold text-tertiary mt-0.5 truncate">
                        {p.location || t('patient.common.muntinlupaCity')}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[0.625rem] font-extrabold uppercase tracking-wider">
                          {t('patient.common.verifiedProvider')}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          • {servicesList.length} {servicesList.length === 1 ? t('patient.providers.serviceSingle') : t('patient.providers.servicePlural')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 2: Structured Specialty Well */}
                  <div className="neu-inset rounded-xl p-3">
                    <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-tertiary block mb-2">
                      {t('patient.providers.specialtiesWellTitle')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {servicesList.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/70 dark:border-white/5"
                        >
                          {translateService(s)}
                        </span>
                      ))}
                      {servicesList.length > 3 && (
                        <span className="px-2 py-1 rounded-lg bg-primary/10 text-link text-xs font-extrabold">
                          +{servicesList.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Layer 3: Asymmetric Action Row (Compact Profile + Prominent Book Appointment CTA) */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/patient/providers/${p.id}/profile`)}
                    className="neu-btn px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:text-link dark:hover:text-link transition-all active:scale-[0.98] cursor-pointer shrink-0"
                  >
                    {t('patient.providers.profileBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      if (hasActiveReq) {
                        navigate('/patient/requests');
                      } else {
                        openBookingModal(p, undefined, event.currentTarget);
                      }
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer ${
                      hasActiveReq
                        ? 'neu-btn text-success dark:text-success-dark'
                        : 'neu-btn-primary shadow-md'
                    }`}
                  >
                    {hasActiveReq ? (
                      <span className="truncate">{getBookingButtonLabel(p.id) || t('patient.providers.ongoingFallback')}</span>
                    ) : (
                      <span>{t('patient.providers.bookAppointmentBtn')}</span>
                    )}
                  </button>
                </div>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="neu-flat p-12 rounded-3xl text-center">
            <EmptyState
              icon="search"
              title={t('patient.providers.noProvidersTitle')}
              message={searchTerm ? t('patient.providers.noProvidersSearchMsg') : t('patient.providers.noProvidersCatMsg')}
            />
          </div>
        )}
      </div>

      {/* Booking Modal — Direction 1 (Guided Horizontal Picker + Arrival Timeline) */}
      <DialogPrimitive.Root
        open={!!selectedProvider}
        modal={!destinationModalOpen}
        onOpenChange={(open) => { if (!open && !destinationModalOpen && !bookingLoading) closeBookingModal(); }}
      >
        {selectedProvider && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            asChild
            aria-modal="true"
            onCloseAutoFocus={(event) => {
              if (!bookingTriggerRef.current) return;
              event.preventDefault();
              bookingTriggerRef.current.focus();
            }}
            onInteractOutside={(event) => {
              if (destinationModalOpen || bookingLoading) event.preventDefault();
            }}
          >
            <motion.div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
              onClick={() => {
                if (!destinationModalOpen && !bookingLoading) closeBookingModal();
              }}
            >
              <motion.div
                className="neu-flat rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-lg flex flex-col relative max-h-[92dvh] overflow-hidden shadow-2xl border-t sm:border border-white/70 dark:border-white/10"
                initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 42, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                {...bookingDrawerMotionProps}
              >
                {/* Sticky Header + Animated Live Progress Bar */}
                <div
                  className="shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-3.5 border-b border-slate-200/75 dark:border-white/10 cursor-grab sm:cursor-auto active:cursor-grabbing sm:active:cursor-auto"
                  {...bookingDragHandleProps}
                >
                  {/* Mobile bottom-sheet drag indicator */}
                  <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true" />

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="neu-flat-sm w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-link font-extrabold overflow-hidden p-0.5 shrink-0 aspect-square border border-white/80 dark:border-white/10">
                      {selectedProvider.avatar_url ? (
                        <img
                          src={selectedProvider.avatar_url}
                          alt={selectedProvider.full_name}
                          className="w-full h-full object-cover rounded-[0.875rem]"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'inline';
                            }
                          }}
                        />
                      ) : null}
                      <span
                        style={{ display: selectedProvider.avatar_url ? 'none' : 'inline' }}
                        className="text-xs sm:text-sm font-black"
                      >
                        {getProviderInitials(selectedProvider.full_name)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DialogPrimitive.Title asChild>
                          <h2 className="text-base sm:text-lg font-display font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                            {bookingStep === 'form'
                              ? t('patient.providers.modalBookTitle')
                              : bookingStep === 'confirm'
                                ? t('patient.providers.modalConfirmTitle')
                                : t('patient.providers.modalDoneTitle')}
                          </h2>
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                          {t('patient.providers.modalDesc', { name: selectedProvider.full_name })}
                        </DialogPrimitive.Description>
                        <span
                          className={`px-2 py-0.5 rounded-md text-2xs font-extrabold uppercase tracking-wider shrink-0 ${
                            bookingStep === 'done'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400'
                          }`}
                        >
                          {bookingStep === 'form'
                            ? t('patient.providers.step1Of2')
                            : bookingStep === 'confirm'
                              ? t('patient.providers.step2Of2')
                              : t('patient.providers.confirmedBadge')}
                        </span>
                      </div>
                      <p className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                        {t('patient.providers.withProvider')} <span className="font-extrabold text-link dark:text-primary-400">{selectedProvider.full_name}</span>
                        {bookingStep === 'done' && confirmedSnapshot?.service
                          ? ` • ${translateService(confirmedSnapshot.service)}`
                          : watchedService
                            ? ` • ${translateService(watchedService)}`
                            : selectedProvider.specialty
                              ? ` • ${translateService(selectedProvider.specialty)}`
                              : selectedProvider.services?.[0]
                                ? ` • ${translateService(selectedProvider.services[0])}`
                                : ` • ${t('patient.common.verifiedProvider')}`}
                      </p>
                    </div>
                  </div>

                  {/* Animated Progress Track */}
                  <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden" aria-hidden="true">
                    <motion.div
                      className={`h-full rounded-full transition-colors duration-300 ${
                        bookingStep === 'done'
                          ? 'bg-emerald-500 dark:bg-emerald-400'
                          : 'bg-primary dark:bg-primary-400'
                      }`}
                      initial={false}
                      animate={{ width: bookingStep === 'form' ? '50%' : '100%' }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>

                {/* Step 1: Guided Horizontal Picker + Progressive Disclosure */}
                {bookingStep === 'form' && (() => {
                  const amOpenCount = morningSlots.filter(s => s.available).length;
                  const pmOpenCount = afternoonSlots.filter(s => s.available).length;
                  const visibleDateChips = dateOptions.slice(0, 5);
                  const isCustomDateSelected = Boolean(
                    watchedDate && !visibleDateChips.some(d => d.key === watchedDate)
                  );
                  const customDateObj = isCustomDateSelected ? parseLocalDate(watchedDate) : null;
                  const selectedSlotParts = watchedTime
                    ? formatSlotParts(watchedTime, serviceDurationMinutes, t)
                    : null;
                  const otherPeriod = slotPeriod === 'am' ? 'pm' : 'am';
                  const otherOpenCount = otherPeriod === 'am' ? amOpenCount : pmOpenCount;
                  const slideOffset = prefersReducedMotion ? 0 : bookingDir === 'left' ? -22 : 22;

                  return (
                    <motion.div
                      key="step-form"
                      initial={{ opacity: prefersReducedMotion ? 1 : 0, x: slideOffset }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: prefersReducedMotion ? 1 : 0, x: prefersReducedMotion ? 0 : -16 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 min-h-0 flex flex-col"
                    >
                      <form
                        onSubmit={handleSubmit(handleReviewBooking, handleBookingValidationError)}
                        className="flex-1 min-h-0 flex flex-col"
                      >
                        <div
                          ref={bookingScrollRef}
                          className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 sm:px-6 py-4 space-y-4"
                        >
                          {/* Row 1: Service Selection + Accordion */}
                          <div
                            ref={serviceSectionRef}
                            className={`space-y-1.5 rounded-2xl transition-all duration-200 ${
                              highlightSection === 'service'
                                ? 'ring-2 ring-primary/50 dark:ring-primary-400/50 ring-offset-2 ring-offset-transparent p-1 -m-1'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                                {t('patient.providers.serviceTypeLabel')}
                              </label>
                              <span className="text-2xs font-extrabold text-link dark:text-primary-400 tabular-nums">
                                {t('patient.providers.durationSummary', {
                                  mins: serviceDurationMinutes,
                                  count: serviceSlotsCount,
                                  slotWord: serviceSlotsCount === 1
                                    ? t('patient.providers.slotSingle')
                                    : t('patient.providers.slotContiguous'),
                                })}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setOpenServiceMenu(prev => !prev)}
                              className="w-full neu-flat-sm rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-left transition-all cursor-pointer outline-none select-none border border-white/75 dark:border-white/10 hover:border-primary/40 dark:hover:border-primary-400/40 active:scale-[0.99]"
                            >
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {watchedService ? translateService(watchedService) : t('patient.providers.selectServicePlaceholder')}
                              </span>
                              <span className="text-xs font-extrabold text-link dark:text-primary-400 shrink-0 ml-2 flex items-center gap-1">
                                {openServiceMenu ? t('patient.common.close') : t('patient.providers.changeBtn')}
                                {openServiceMenu ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
                              </span>
                            </button>

                            <AnimatePresence initial={false}>
                              {openServiceMenu && (
                                <motion.div
                                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                  transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div className="neu-inset rounded-2xl p-1.5 space-y-1 max-h-52 overflow-y-auto no-scrollbar border border-white/60 dark:border-white/5">
                                    {(selectedProvider.services?.length > 0 ? selectedProvider.services : ['General Care']).map(s => {
                                      const isSelected = watchedService === s;
                                      const sMins = getServiceDurationMinutes(s);
                                      const sSlots = getServiceSlotsCount(s);
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => {
                                            setValue('service', s, { shouldValidate: true });
                                            setOpenServiceMenu(false);
                                          }}
                                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer outline-none select-none active:scale-[0.98] ${
                                            isSelected
                                              ? 'bg-primary text-white dark:bg-primary-400 dark:text-neu-fg font-extrabold shadow-sm'
                                              : 'text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70'
                                          }`}
                                        >
                                          <div className="min-w-0 pr-2">
                                            <span className="text-xs font-bold block truncate">{translateService(s)}</span>
                                            <span className={`text-2xs block ${isSelected ? 'opacity-90' : 'text-tertiary'}`}>
                                              {t('patient.providers.durationSummary', {
                                                mins: sMins,
                                                count: sSlots,
                                                slotWord: sSlots === 1
                                                  ? t('patient.providers.slotSingle')
                                                  : t('patient.providers.slotPlural'),
                                              })}
                                            </span>
                                          </div>
                                          {isSelected && <span className="text-2xs font-extrabold uppercase tracking-wider shrink-0">{t('patient.providers.selectedBadge')}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {errors.service && (
                              <p className="text-xs font-medium text-danger ml-1">{errors.service.message}</p>
                            )}
                          </div>

                          {/* Row 2: Horizontal 5-Day Date Strip + Animated Period Switch + Slots */}
                          <div
                            ref={scheduleSectionRef}
                            className={`space-y-1.5 rounded-2xl transition-all duration-200 ${
                              highlightSection === 'schedule'
                                ? 'ring-2 ring-primary/50 dark:ring-primary-400/50 ring-offset-2 ring-offset-transparent p-1 -m-1'
                                : ''
                            }`}
                          >
                            <div className="neu-inset rounded-2xl p-3.5 space-y-3 border border-white/60 dark:border-white/5">
                              {/* Schedule Header */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary block leading-none">
                                    {t('patient.providers.selectDayWindow')}
                                  </span>
                                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 block truncate">
                                    {formatBookingDateLabel(watchedDate)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {watchedDate && !loadingSlots && availableSlots.length > 0 && (() => {
                                    const freeCount = availableSlots.filter(s => s.available).length;
                                    const allPast = availableSlots.every(s => s.isPast);
                                    if (freeCount > 0) {
                                      return (
                                        <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 tabular-nums">
                                          {t('patient.providers.slotsOpenCount', { count: freeCount })}
                                        </span>
                                      );
                                    }
                                    if (allPast) {
                                      return (
                                        <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          {t('patient.providers.dateClosedStatus')}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                        {t('patient.providers.dateFullStatus')}
                                      </span>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() => setShowCustomDatePicker(prev => !prev)}
                                    className="neu-btn px-2.5 py-1 rounded-lg text-2xs font-extrabold text-link dark:text-primary-400 cursor-pointer active:scale-95 transition-transform"
                                  >
                                    {showCustomDatePicker ? t('patient.providers.hideCalendarBtn') : t('patient.providers.moreDatesBtn')}
                                  </button>
                                </div>
                              </div>

                              {/* Horizontal Date Chips */}
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5" role="listbox" aria-label={t('patient.providers.appointmentDatesAria')}>
                                {visibleDateChips.map(opt => {
                                  const isActive = watchedDate === opt.key;
                                  return (
                                    <button
                                      key={opt.key}
                                      type="button"
                                      role="option"
                                      aria-selected={isActive}
                                      onClick={() => {
                                        if (watchedDate !== opt.key) {
                                          setValue('date', opt.key, { shouldValidate: true });
                                          setValue('time', '');
                                        }
                                      }}
                                      className={`min-w-[4.125rem] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 transition-all active:scale-[0.96] select-none outline-none ${
                                        isActive
                                          ? 'bg-primary text-white dark:bg-primary-400 dark:text-neu-fg shadow-md shadow-primary/25 dark:shadow-primary-400/20'
                                          : 'neu-flat-sm text-slate-800 dark:text-slate-100 border border-white/70 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40'
                                      }`}
                                    >
                                      <span className={`block text-2xs font-bold uppercase ${isActive ? 'opacity-90' : 'text-tertiary'}`}>
                                        {opt.dayShort}
                                      </span>
                                      <span className="block text-xs sm:text-sm font-extrabold leading-tight mt-0.5 tabular-nums">
                                        {opt.monthShort} {opt.dayNum}
                                      </span>
                                    </button>
                                  );
                                })}

                                {isCustomDateSelected && customDateObj && (
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={true}
                                    onClick={() => setShowCustomDatePicker(true)}
                                    className="min-w-[4.375rem] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 bg-primary text-white dark:bg-primary-400 dark:text-neu-fg shadow-md shadow-primary/25 dark:shadow-primary-400/20 select-none"
                                  >
                                    <span className="block text-2xs font-bold uppercase opacity-90">
                                      {customDateObj.toLocaleDateString(locale, { weekday: 'short' })}
                                    </span>
                                    <span className="block text-xs sm:text-sm font-extrabold leading-tight mt-0.5 tabular-nums">
                                      {customDateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                                    </span>
                                  </button>
                                )}
                              </div>

                              {/* Expandable Custom Date Picker */}
                              <AnimatePresence initial={false}>
                                {showCustomDatePicker && (
                                  <motion.div
                                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                    transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="neu-flat-sm rounded-xl px-3 py-2 flex items-center justify-between gap-2 border border-white/70 dark:border-white/5">
                                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">{t('patient.providers.jumpToDateLabel')}</span>
                                      <input
                                        type="date"
                                        min={toLocalDateKey()}
                                        value={watchedDate || ''}
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          setValue('date', e.target.value, { shouldValidate: true });
                                          setValue('time', '');
                                        }}
                                        className="bg-transparent text-xs font-extrabold text-slate-900 dark:text-white outline-none cursor-pointer"
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Animated Sliding Morning / Afternoon Period Switcher + Slots */}
                              {!watchedDate ? (
                                <div className="p-3 text-center text-xs text-tertiary">
                                  {t('patient.providers.selectDateAbove')}
                                </div>
                              ) : loadingSlots ? (
                                <div className="space-y-2 py-1" aria-live="polite">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[0, 1, 2, 3, 4, 5].map(idx => (
                                      <div
                                        key={idx}
                                        className="h-12 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-white/5 animate-pulse"
                                      />
                                    ))}
                                  </div>
                                  <p className="text-center text-xs font-semibold text-link dark:text-primary-400">
                                    {t('patient.providers.checkingAvailability')}
                                  </p>
                                </div>
                              ) : availableSlots.length === 0 ? (
                                <div className="p-3 text-center text-xs text-tertiary">
                                  {t('patient.providers.noSlotsDate')}
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {availableSlots.every(s => !s.available) && (
                                    <div className="p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium">
                                      {availableSlots.every(s => s.isPast)
                                        ? t('patient.providers.clinicHoursEnded')
                                        : t('patient.providers.allSlotsBooked')}
                                    </div>
                                  )}

                                  {/* Animated Sliding 50/50 Period Switch */}
                                  <div className="relative neu-flat-sm p-1 rounded-xl grid grid-cols-2 border border-white/70 dark:border-white/5">
                                    <motion.div
                                      aria-hidden="true"
                                      className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-primary dark:bg-primary-400 shadow-sm"
                                      initial={false}
                                      animate={{ x: slotPeriod === 'am' ? '0%' : '100%' }}
                                      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setSlotPeriod('am')}
                                      className={`relative z-10 py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none ${
                                        slotPeriod === 'am'
                                          ? 'text-white dark:text-neu-fg'
                                          : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                      }`}
                                    >
                                      {t('patient.cancelReschedule.morningTab', { count: amOpenCount })}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSlotPeriod('pm')}
                                      className={`relative z-10 py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none ${
                                        slotPeriod === 'pm'
                                          ? 'text-white dark:text-neu-fg'
                                          : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                      }`}
                                    >
                                      {t('patient.cancelReschedule.afternoonTab', { count: pmOpenCount })}
                                    </button>
                                  </div>

                                  {/* Period-Filtered Slots Grid */}
                                  {(() => {
                                    const periodList = slotPeriod === 'am' ? morningSlots : afternoonSlots;
                                    const periodOpenCount = periodList.filter(s => s.available).length;
                                    if (periodList.length === 0) {
                                      return (
                                        <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/50 border border-dashed border-slate-300/80 dark:border-white/10 text-center space-y-2">
                                          <p className="text-xs text-tertiary">
                                            {t('patient.providers.noPeriodSlots', {
                                              period: slotPeriod === 'am'
                                                ? t('patient.cancelReschedule.morningWord')
                                                : t('patient.cancelReschedule.afternoonWord'),
                                            })}
                                          </p>
                                          {otherOpenCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => setSlotPeriod(otherPeriod)}
                                              className="px-3 py-1 rounded-lg bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                                            >
                                              {t('patient.providers.switchToPeriod', {
                                                count: otherOpenCount,
                                                period: otherPeriod === 'am'
                                                  ? t('patient.providers.morningPeriod')
                                                  : t('patient.providers.afternoonPeriod'),
                                              })} →
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }

                                    return (
                                      <motion.div
                                        key={`${watchedDate}-${slotPeriod}`}
                                        initial={prefersReducedMotion ? false : { opacity: 0.45, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                                        className="space-y-2"
                                      >
                                        {periodOpenCount === 0 && otherOpenCount > 0 && (
                                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-primary/10 dark:bg-primary-400/10 border border-primary/20 dark:border-primary-400/20">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                              {t('patient.providers.periodSlotsFull', {
                                                period: slotPeriod === 'am'
                                                  ? t('patient.providers.morningPeriod')
                                                  : t('patient.providers.afternoonPeriod'),
                                              })}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setSlotPeriod(otherPeriod)}
                                              className="text-xs font-extrabold text-link dark:text-primary-400 cursor-pointer shrink-0 hover:underline"
                                            >
                                              {t('patient.providers.viewPeriodOpen', {
                                                count: otherOpenCount,
                                                period: otherPeriod === 'am' ? 'AM' : 'PM',
                                              })} →
                                            </button>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                          {periodList.map(slot => {
                                            const isSelected = watchedTime === slot.time;
                                            const { startLabel, endLabel } = formatSlotParts(slot.time, serviceDurationMinutes, t);

                                            return (
                                              <button
                                                key={slot.time}
                                                type="button"
                                                disabled={!slot.available}
                                                onClick={() => setValue('time', slot.time, { shouldValidate: true })}
                                                className={`py-2.5 px-2 rounded-xl text-center transition-all outline-none select-none ${
                                                  !slot.available
                                                    ? 'bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-white/5 cursor-not-allowed'
                                                    : isSelected
                                                      ? 'bg-primary text-white dark:bg-primary-400 dark:text-neu-fg shadow-md shadow-primary/25 dark:shadow-primary-400/20 cursor-pointer ring-2 ring-primary/35 dark:ring-primary-400/45 active:scale-[0.97]'
                                                      : 'neu-flat-sm text-slate-800 dark:text-slate-100 border border-white/75 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40 cursor-pointer active:scale-[0.96]'
                                                }`}
                                              >
                                                <span className="text-xs font-extrabold block leading-tight tabular-nums">
                                                  {startLabel}
                                                </span>
                                                <span className={`text-[0.6875rem] font-semibold block mt-0.5 leading-tight tabular-nums ${
                                                  !slot.available
                                                    ? 'text-slate-400 dark:text-slate-600'
                                                    : isSelected
                                                      ? 'opacity-90'
                                                      : 'text-tertiary'
                                                }`}>
                                                  {endLabel}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </motion.div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>

                            {errors.date && (
                              <p className="text-xs font-medium text-danger ml-1">{errors.date.message}</p>
                            )}
                            {errors.time && (
                              <p className="text-xs font-medium text-danger ml-1">{errors.time.message}</p>
                            )}
                          </div>

                          {/* Row 3: Home Visit Location + Progressive Disclosure Optional Gate Notes */}
                          <div
                            ref={locationSectionRef}
                            className={`space-y-2 rounded-2xl transition-all duration-200 ${
                              highlightSection === 'location'
                                ? 'ring-2 ring-primary/50 dark:ring-primary-400/50 ring-offset-2 ring-offset-transparent p-1 -m-1'
                                : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setDestinationModalOpen(true)}
                              className="w-full neu-flat-sm rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-left transition-all cursor-pointer outline-none select-none border border-white/75 dark:border-white/10 hover:border-primary/40 dark:hover:border-primary-400/40 active:scale-[0.99]"
                            >
                              <div className="min-w-0 flex-1 pr-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
                                    {t('patient.providers.visitLocationLabel')}
                                  </span>
                                  <span className="text-2xs font-bold text-link dark:text-primary-400">
                                    • {!visitDestination
                                      ? t('patient.providers.locNotSet')
                                      : !destinationConfirmed
                                        ? t('patient.providers.locApprox')
                                        : visitDestination.source === 'booking'
                                          ? t('patient.providers.locCustom')
                                          : t('patient.providers.locSaved')}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                                  {visitDestination?.address || patientHome?.address || t('patient.providers.setVisitLocationPrompt')}
                                </p>
                                <p className={`text-xs truncate mt-0.5 font-semibold flex items-center gap-1.5 tabular-nums ${
                                  destinationConfirmed ? 'text-success dark:text-success-dark' : 'text-[#B45309] dark:text-[#FCD34D]'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    destinationConfirmed ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`} />
                                  <span className="truncate">
                                    {visitDestination?.lat
                                      ? destinationConfirmed
                                        ? t('patient.providers.gpsPinConfirmed', {
                                            lat: visitDestination.lat.toFixed(5),
                                            lng: visitDestination.lng.toFixed(5),
                                          })
                                        : t('patient.providers.gpsPinApprox', {
                                            lat: visitDestination.lat.toFixed(5),
                                            lng: visitDestination.lng.toFixed(5),
                                          })
                                      : t('patient.providers.tapToSetAddress')}
                                  </span>
                                </p>
                              </div>
                              <span className="neu-btn px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-link dark:text-primary-400 shrink-0">
                                {t('patient.providers.changeBtn')}
                              </span>
                            </button>

                            {/* Progressive Disclosure Gate Notes */}
                            <div className="neu-inset rounded-2xl px-3.5 py-2.5 border border-slate-300/40 dark:border-white/5">
                              <button
                                type="button"
                                onClick={() => setShowBookingNotes(prev => !prev)}
                                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                              >
                                <span className="truncate">
                                  {watchedNotes?.trim() ? t('patient.providers.notesAddedLabel') : t('patient.providers.addNotesPrompt')}
                                </span>
                                <span className="text-2xs font-extrabold text-link dark:text-primary-400 shrink-0 ml-2 uppercase tracking-wider">
                                  {showBookingNotes || watchedNotes?.trim() ? t('patient.providers.hideBtn') : t('patient.providers.addBtn')}
                                </span>
                              </button>

                              <div
                                className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                                  showBookingNotes || watchedNotes?.trim() ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                }`}
                              >
                                <div className="overflow-hidden">
                                  <input
                                    type="text"
                                    {...register('notes')}
                                    placeholder={t('patient.providers.notesInputPlaceholder')}
                                    className="mt-2 w-full neu-flat-sm rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-tertiary placeholder:font-normal border border-white/70 dark:border-white/10 focus:border-primary/50 dark:focus:border-primary-400/50"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Row 4: Full-Card Clickable Consent Label */}
                          <div
                            ref={consentSectionRef}
                            className={`space-y-1 rounded-2xl transition-all duration-200 ${
                              highlightSection === 'consent'
                                ? 'ring-2 ring-danger/50 ring-offset-2 ring-offset-transparent p-1 -m-1'
                                : ''
                            }`}
                          >
                            <label
                              htmlFor="consent"
                              className={`rounded-2xl p-3 flex items-start gap-3 transition-colors border cursor-pointer select-none ${
                                errors.consent
                                  ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800/70'
                                  : watchedConsent
                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-300/70 dark:border-emerald-800/60'
                                    : 'neu-flat-sm border-white/75 dark:border-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                id="consent"
                                {...register('consent')}
                                className="w-4 h-4 rounded accent-primary dark:accent-primary-400 mt-0.5 cursor-pointer shrink-0"
                              />
                              <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                                {t('patient.providers.consentTextPrefix')} <span className="font-bold text-slate-900 dark:text-white">{selectedProvider.full_name}</span> {t('patient.providers.consentTextSuffix')}
                              </span>
                            </label>
                            {errors.consent && (
                              <p className="text-xs font-semibold text-danger ml-1">{errors.consent.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Sticky Bottom Footer CTA */}
                        <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                          <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[116px_1fr] gap-2.5">
                            <button
                              type="button"
                              onClick={closeBookingModal}
                              className="w-full neu-btn py-3 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
                            >
                              {t('patient.common.cancel')}
                            </button>
                            <button
                              type="submit"
                              className="w-full neu-btn-primary py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                            >
                              <span>
                                {selectedSlotParts
                                  ? t('patient.providers.reviewVisitBtn', { time: selectedSlotParts.startLabel })
                                  : t('patient.providers.selectTimeSlotBtn')}
                              </span>
                              <ArrowRight className="w-4 h-4 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  );
                })()}

                {/* Step 2: Direction 1 — Arrival Timeline + Verified Consent Assurance */}
                {bookingStep === 'confirm' && (() => {
                  const vals = getValues();
                  const slideOffset = prefersReducedMotion ? 0 : bookingDir === 'left' ? -22 : 22;
                  const nodeMotion = (delaySec) =>
                    prefersReducedMotion
                      ? {}
                      : {
                          initial: { opacity: 0, scale: 0.72 },
                          animate: { opacity: 1, scale: 1 },
                          transition: { duration: 0.3, delay: delaySec, type: 'spring', stiffness: 360, damping: 22 },
                        };

                  return (
                    <motion.div
                      key="step-confirm"
                      initial={{ opacity: prefersReducedMotion ? 1 : 0, x: slideOffset }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: prefersReducedMotion ? 1 : 0, x: prefersReducedMotion ? 0 : -18 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 min-h-0 flex flex-col"
                    >
                      <div
                        ref={bookingScrollRef}
                        className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 sm:px-6 py-4 space-y-3.5"
                      >
                        {/* Vertical Arrival Timeline Card */}
                        <div className="neu-inset rounded-2xl p-3.5 sm:p-4 border border-white/60 dark:border-white/5">
                          <div className="relative pl-10 space-y-3">
                            {/* Animated Connecting Gradient Track */}
                            <motion.div
                              aria-hidden="true"
                              initial={{ scaleY: prefersReducedMotion ? 1 : 0, opacity: prefersReducedMotion ? 1 : 0.25 }}
                              animate={{ scaleY: 1, opacity: 1 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.42, delay: prefersReducedMotion ? 0 : 0.06, ease: [0.22, 1, 0.36, 1] }}
                              className="origin-top absolute left-[0.9375rem] top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-primary via-primary to-emerald-500 dark:from-primary-400 dark:via-primary-400 dark:to-emerald-400"
                            />

                            {/* Timeline Node 1: Date */}
                            <div className="relative">
                              <motion.div
                                {...nodeMotion(0.04)}
                                className="absolute -left-10 top-3 w-8 h-8 rounded-full bg-surface-shell border-2 border-primary dark:border-primary-400 flex items-center justify-center text-link dark:text-primary-400 shadow-sm"
                              >
                                <Calendar className="w-4 h-4" />
                              </motion.div>
                              <div className="neu-flat-sm rounded-2xl px-3.5 py-3 flex items-center justify-between gap-2 border border-white/75 dark:border-white/10">
                                <div className="min-w-0">
                                  <span className="text-2xs font-bold text-tertiary block">{t('patient.providers.dateLabel')}</span>
                                  <span className="text-sm font-extrabold text-slate-900 dark:text-white block truncate mt-0.5">
                                    {formatBookingDateLabel(vals.date)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToBookingStep('form', 'left', 'schedule')}
                                  disabled={bookingLoading}
                                  className="text-xs font-extrabold text-link dark:text-primary-400 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  {t('patient.common.edit')}
                                </button>
                              </div>
                            </div>

                            {/* Timeline Node 2: Arrival Window + Service */}
                            <div className="relative">
                              <motion.div
                                {...nodeMotion(0.11)}
                                className="absolute -left-10 top-3 w-8 h-8 rounded-full bg-surface-shell border-2 border-primary dark:border-primary-400 flex items-center justify-center text-link dark:text-primary-400 shadow-sm"
                              >
                                <Clock className="w-4 h-4" />
                              </motion.div>
                              <div className="neu-flat-sm rounded-2xl px-3.5 py-3 flex items-start justify-between gap-2 border border-white/75 dark:border-white/10">
                                <div className="min-w-0">
                                  <span className="text-2xs font-bold text-tertiary block">{t('patient.providers.arrivalWindowLabel')}</span>
                                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                                    {formatSlotLabel(vals.time, serviceDurationMinutes)}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="text-xs font-extrabold text-link dark:text-primary-400">
                                      {translateService(vals.service)} • {t('patient.providers.durationSummary', {
                                        mins: serviceDurationMinutes,
                                        count: serviceSlotsCount,
                                        slotWord: serviceSlotsCount === 1
                                          ? t('patient.providers.slotSingle')
                                          : t('patient.providers.slotPlural'),
                                      })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => goToBookingStep('form', 'left', 'service')}
                                      disabled={bookingLoading}
                                      className="text-2xs font-extrabold uppercase tracking-wider text-tertiary hover:text-link dark:hover:text-primary-400 underline cursor-pointer disabled:opacity-50"
                                    >
                                      {t('patient.providers.switchBtn')}
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToBookingStep('form', 'left', 'schedule')}
                                  disabled={bookingLoading}
                                  className="text-xs font-extrabold text-link dark:text-primary-400 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  {t('patient.common.edit')}
                                </button>
                              </div>
                            </div>

                            {/* Timeline Node 3: Home Visit + Calm GPS Confirmation */}
                            <div className="relative">
                              <motion.div
                                {...nodeMotion(0.18)}
                                className="absolute -left-10 top-3 w-8 h-8 rounded-full bg-surface-shell border-2 border-emerald-500 dark:border-emerald-400 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm"
                              >
                                <House className="w-4 h-4" />
                              </motion.div>
                              <div className="neu-flat-sm rounded-2xl px-3.5 py-3 space-y-2.5 border border-white/75 dark:border-white/10">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-2xs font-bold text-tertiary block">
                                      {t('patient.providers.homeVisitLabel')}{visitDestination && !destinationConfirmed ? t('patient.providers.approxSuffix') : ''}
                                    </span>
                                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug mt-0.5">
                                      {visitDestination?.address || t('patient.providers.notConfirmed')}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => goToBookingStep('form', 'left', 'location')}
                                    disabled={bookingLoading}
                                    className="text-xs font-extrabold text-link dark:text-primary-400 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                  >
                                    {t('patient.common.edit')}
                                  </button>
                                </div>

                                {visitDestination?.lat != null && (
                                  destinationConfirmed ? (
                                    <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 px-3 py-2 flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                      <div className="text-[0.6875rem] leading-snug min-w-0">
                                        <span className="font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums block">
                                          {t('patient.providers.gpsPinConfirmed', {
                                            lat: visitDestination.lat.toFixed(5),
                                            lng: visitDestination.lng.toFixed(5),
                                          })}
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                                          {t('patient.providers.pinExactHint')}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/60 px-3 py-2 flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                      <div className="text-[0.6875rem] leading-snug min-w-0">
                                        <span className="font-extrabold text-amber-800 dark:text-amber-300 tabular-nums block">
                                          {t('patient.providers.approxPinLabel', {
                                            lat: visitDestination.lat.toFixed(5),
                                            lng: visitDestination.lng.toFixed(5),
                                          })}
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                                          {t('patient.providers.approxPinHint')}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {vals.notes?.trim() && (
                            <div className="mt-3 neu-flat-sm rounded-xl px-3.5 py-2.5 border border-white/75 dark:border-white/10">
                              <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary block">
                                {t('patient.providers.patientGateNotesLabel')}
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-200 italic mt-0.5">
                                “{vals.notes.trim()}”
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Verified Consent & Notification Trust Bar right above Primary CTA */}
                        <div className="neu-flat-sm rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 border border-white/75 dark:border-white/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-success dark:text-success-dark">
                                {t('patient.providers.consentVerifiedTitle')}
                              </div>
                              <div className="text-[0.6875rem] text-tertiary truncate">
                                {t('patient.providers.instantNoticeSub', { name: selectedProvider.full_name })}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-2xs font-extrabold uppercase tracking-wider shrink-0">
                            {t('patient.providers.readyBadge')}
                          </span>
                        </div>
                      </div>

                      {/* Sticky Step 2 Footer */}
                      <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                        <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[116px_1fr] gap-2.5">
                          <button
                            type="button"
                            onClick={() => goToBookingStep('form', 'left')}
                            disabled={bookingLoading}
                            className="w-full py-3 neu-btn rounded-xl font-extrabold text-slate-600 dark:text-slate-300 transition-all text-xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                          >
                            {t('patient.common.back')}
                          </button>
                          <button
                            type="button"
                            onClick={handleBookingSubmit}
                            disabled={bookingLoading}
                            className="w-full py-3 px-4 neu-btn-primary rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm font-extrabold cursor-pointer active:scale-[0.98]"
                          >
                            {bookingLoading ? (
                              <>
                                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                <span>{t('patient.providers.submittingBtn')}</span>
                              </>
                            ) : (
                              <span>{t('patient.providers.confirmAppointmentBtn')}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Step 3: Celebratory Visit Scheduled Confirmation */}
                {bookingStep === 'done' && (() => {
                  const summary = confirmedSnapshot || {
                    providerName: selectedProvider.full_name,
                    service: watchedService,
                    date: watchedDate,
                    time: watchedTime,
                    durationMinutes: serviceDurationMinutes,
                    address: visitDestination?.address || patientHome?.address || '',
                  };

                  return (
                    <motion.div
                      key="step-done"
                      initial={{ opacity: prefersReducedMotion ? 1 : 0, x: prefersReducedMotion ? 0 : 22 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
                      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1 min-h-0 flex flex-col"
                    >
                      <div
                        ref={bookingScrollRef}
                        className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 sm:px-7 py-6 flex flex-col items-center text-center"
                      >
                        <div className="relative w-20 h-20 flex items-center justify-center mt-1">
                          {!prefersReducedMotion && (
                            <motion.div
                              aria-hidden="true"
                              initial={{ opacity: 0.45, scale: 0.85 }}
                              animate={{ opacity: 0, scale: 1.55 }}
                              transition={{ duration: 1.05, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute inset-0 rounded-full bg-success/25 dark:bg-success-dark/25"
                            />
                          )}
                          <BrandSuccess
                            size={80}
                            className="relative z-10"
                            label={t('patient.providers.requestedTitle')}
                          />
                        </div>

                        <h3 className="text-lg sm:text-xl font-display font-extrabold text-slate-900 dark:text-white mt-4">
                          {t('patient.providers.requestedTitle')}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
                          {t('patient.providers.requestedSub', {
                            service: translateService(summary.service),
                            name: summary.providerName,
                          })}
                        </p>

                        <div className="w-full neu-inset rounded-2xl p-4 mt-5 text-left space-y-2.5 border border-white/60 dark:border-white/5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-tertiary font-bold shrink-0">{t('patient.providers.dateTimeLabel')}</span>
                            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-right">
                              {formatBookingDateLabel(summary.date)} • {formatSlotLabel(summary.time, summary.durationMinutes)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-tertiary font-bold shrink-0">{t('patient.providers.locationLabel')}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-right">
                              {summary.address || t('patient.providers.confirmedGpsPin')}
                            </span>
                          </div>
                        </div>

                        <div className="w-full neu-flat-sm rounded-2xl p-4 mt-3 text-left space-y-2.5 border border-white/75 dark:border-white/10">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-link dark:text-primary-400 block">
                            {t('patient.providers.whatHappensNext')}
                          </span>
                          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-2xs flex items-center justify-center shrink-0">1</span>
                              <span>{t('patient.providers.nextStep1', { name: summary.providerName })}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 font-extrabold text-2xs flex items-center justify-center shrink-0">2</span>
                              <span>{t('patient.providers.nextStep2')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 font-extrabold text-2xs flex items-center justify-center shrink-0">3</span>
                              <span>{t('patient.providers.nextStep3')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sticky Step 3 Footer */}
                      <div className="shrink-0 px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-slate-200/75 dark:border-white/10 bg-surface-shell/95 backdrop-blur-md">
                        <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[116px_1fr] gap-2.5">
                          <button
                            type="button"
                            onClick={closeBookingModal}
                            className="w-full py-3 neu-btn rounded-xl font-extrabold text-slate-600 dark:text-slate-300 transition-all text-xs cursor-pointer active:scale-[0.98]"
                          >
                            {t('patient.common.done')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeBookingModal();
                              navigate('/patient/requests');
                            }}
                            className="w-full py-3 px-4 neu-btn-primary rounded-xl shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm font-extrabold cursor-pointer active:scale-[0.98]"
                          >
                            <span>{t('patient.providers.viewMyRequestsBtn')}</span>
                            <ArrowRight className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
        )}
      </DialogPrimitive.Root>
      {/* Provider Details Sheet */}
      <Sheet open={!!viewingProvider} onOpenChange={(open) => { if (!open) setViewingProvider(null); }}>
        <SheetContent 
          side="bottom"
          onCloseAutoFocus={(event) => {
            if (!sheetTriggerRef.current) return;
            event.preventDefault();
            sheetTriggerRef.current.focus();
          }}
          className={`sm:max-w-lg md:max-w-3xl lg:max-w-4xl sm:mx-auto sm:bottom-4 rounded-t-[2rem] sm:rounded-[2.5rem] md:inset-0 md:m-auto h-[80dvh] min-h-[28.75rem] sm:h-[82vh] md:min-h-[33.75rem] max-h-[88vh] flex flex-col overflow-hidden p-0 bg-surface-shell border-0 shadow-2xl transform-gpu will-change-transform ${selectedProvider ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <SheetTitle className="sr-only">{viewingProvider?.full_name || t('patient.providers.sheetTitleFallback')}</SheetTitle>
          <SheetDescription className="sr-only">{t('patient.providers.sheetDescSr')}</SheetDescription>
          {viewingProvider && (
          <div className="flex flex-col h-full min-h-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0 md:grid md:grid-cols-[22.5rem_minmax(0,1fr)]">
            {/* Left Column / Mobile Header */}
            <div className="flex flex-col shrink-0 md:shrink-0 md:min-h-0 md:overflow-y-auto md:border-r border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/30">
              {/* Cover Header */}
              <div className="h-20 sm:h-24 md:h-28 bg-gradient-to-r from-primary via-primary-600 to-primary-700 relative overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-white/10 dark:bg-black/20" />
                <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-md bg-white/40 sm:hidden relative z-10" aria-hidden="true" />
              </div>

              {/* Identity & Badges */}
              <div className="px-5 md:px-6 -mt-9 md:-mt-11 relative z-10 shrink-0">
                <div className="flex gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-[4.5rem] h-[4.5rem] md:w-20 md:h-20 rounded-2xl neu-flat flex items-center justify-center text-xl font-black text-link overflow-hidden p-0.5 ring-4 ring-white dark:ring-slate-900 shadow-md aspect-square">
                      {viewingProvider.avatar_url ? (
                        <img
                          src={viewingProvider.avatar_url}
                          alt={`${viewingProvider.full_name} photo`}
                          className="w-full h-full object-cover rounded-[0.875rem]"
                        />
                      ) : (
                        <span>{getProviderInitials(viewingProvider.full_name)}</span>
                      )}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-md border-2 border-white dark:border-slate-800 ${isUserOnline(viewingProvider.id) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1 pt-9 md:pt-10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="font-display text-lg md:text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {viewingProvider.full_name}
                      </h2>
                      {viewingProvider.professional_id_status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-extrabold text-success dark:text-success-dark bg-emerald-500/10">
                          <ShieldCheck className="w-3 h-3 text-success" /> {t('patient.common.verified')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center text-warning">
                        <Star weight="fill" className="w-3.5 h-3.5 fill-current" />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {(viewingProvider.rating || 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-tertiary">{t('patient.providers.sheetReviewsCount', { count: providerReviews.length })}</span>
                      <span className={`text-xs font-semibold ml-1 ${isUserOnline(viewingProvider.id) ? 'text-success font-bold' : 'text-tertiary'}`}>
                        • {isUserOnline(viewingProvider.id) ? t('patient.common.online') : t('patient.common.offline')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 text-xs">
                  <p className="text-tertiary dark:text-tertiary flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-link shrink-0" />
                    <span className="truncate">{viewingProvider.location || t('patient.common.muntinlupaCity')}</span>
                  </p>
                </div>
              </div>

              {/* Desktop-only Combined Practitioner Info & Metrics */}
              <div className="hidden md:block px-6 mt-4 space-y-3.5">
                {/* About Practitioner Bio */}
                <div className="neu-flat-sm p-3.5 rounded-2xl">
                  <p className="text-2xs uppercase font-extrabold tracking-wider text-tertiary mb-1">{t('patient.providers.sheetAboutPractitioner')}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {viewingProvider.bio || t('patient.providers.sheetDefaultBio')}
                  </p>
                </div>

                {/* 3 Metric chips: Rating, Services, Status */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">{t('patient.providers.sheetRatingLabel')}</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">{(viewingProvider.rating || 0).toFixed(1)} ★</p>
                  </div>
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">{t('patient.providers.sheetServicesLabel')}</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">{(viewingProvider.services || []).length}</p>
                  </div>
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">{t('patient.providers.sheetStatusLabel')}</p>
                    <p className={`text-xs font-black mt-1 capitalize ${isUserOnline(viewingProvider.id) ? 'text-success' : 'text-tertiary'}`}>
                      {isUserOnline(viewingProvider.id) ? t('patient.common.active') : t('patient.common.offline')}
                    </p>
                  </div>
                </div>

                {/* Trust Score */}
                <div className="neu-flat-sm p-3 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-link" />
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">{t('patient.providers.sheetTrustScore')}</span>
                    </div>
                    <span className="text-xs font-black tabular-nums text-slate-800 dark:text-slate-200">{viewingProvider.trust_score}/100</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/70 dark:bg-slate-800 rounded-md overflow-hidden">
                    <div
                      className={`h-full rounded-md transition-all duration-700 ease-out ${
                        viewingProvider.trust_score >= 70 ? 'bg-emerald-500' : viewingProvider.trust_score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${viewingProvider.trust_score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Desktop Sticky Booking Action */}
              <div className="hidden md:block px-6 mt-auto pt-4 pb-6 sticky bottom-0 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <button
                  onClick={(event) => {
                    openBookingModal(viewingProvider, undefined, event.currentTarget);
                  }}
                  disabled={requested.includes(viewingProvider.id)}
                  className={`w-full py-3.5 rounded-2xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    requested.includes(viewingProvider.id)
                      ? 'neu-btn text-success dark:text-success-dark cursor-not-allowed'
                      : 'neu-btn-primary'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{requested.includes(viewingProvider.id) ? (getBookingButtonLabel(viewingProvider.id) || t('patient.providers.ongoingVisitFallback')) : t('patient.providers.bookAppointmentBtn')}</span>
                </button>
                <button
                  onClick={() => {
                    setViewingProvider(null);
                    navigate(`/patient/providers/${viewingProvider.id}/profile`);
                  }}
                  className="w-full py-2.5 mt-1 text-xs font-bold text-link hover:underline text-center cursor-pointer"
                >
                  {t('patient.providers.sheetViewFullProfile')}
                </button>
              </div>
            </div>

            {/* Right Column / Content */}
            <div className="flex flex-col flex-1 min-h-0 md:h-full">
              {/* Mobile Only Segmented Tabs */}
              <div className="px-5 md:hidden mt-4 shrink-0">
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl" role="tablist">
                  {[
                    { v: 'overview', label: t('patient.providers.sheetOverviewTab') },
                    { v: 'services', label: t('patient.providers.sheetServicesCount', { count: (viewingProvider.services || []).length }) },
                    { v: 'reviews', label: t('patient.providers.sheetReviewsTabCount', { count: providerReviews.length }) },
                  ].map(tabItem => (
                    <button
                      key={tabItem.v}
                      type="button"
                      role="tab"
                      aria-selected={sheetTab === tabItem.v}
                      onClick={() => setSheetTab(tabItem.v)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate outline-none select-none ${
                        sheetTab === tabItem.v
                          ? 'bg-primary text-white shadow-md'
                          : 'text-slate-600 dark:text-tertiary hover:text-link dark:hover:text-white bg-transparent'
                      }`}
                    >
                      {tabItem.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Tab Contents */}
              <div key={sheetTab} className="md:hidden flex-1 min-h-0 overflow-y-auto px-5 mt-4 pb-2 space-y-4">
                {sheetTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Mobile Trust Score */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">{t('patient.providers.sheetTrustScore')}</span>
                        <span className="text-xs font-black tabular-nums text-slate-800 dark:text-slate-200">{viewingProvider.trust_score}/100</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-md overflow-hidden">
                        <div
                          className={`h-full rounded-md transition-all duration-700 ease-out ${
                            viewingProvider.trust_score >= 70 ? 'bg-emerald-500' : viewingProvider.trust_score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${viewingProvider.trust_score}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mb-1.5">{t('patient.providers.sheetAboutProvider')}</p>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {viewingProvider.bio || t('patient.providers.sheetDefaultBio')}
                      </p>
                    </div>

                    <div className="neu-flat-sm p-4 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-tertiary font-medium">{t('patient.providers.sheetPrimaryArea')}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingProvider.location || t('patient.common.muntinlupaCity')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-tertiary font-medium">{t('patient.providers.sheetServiceSchedule')}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {t('patient.providers.sheetScheduleValue')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                        <span className="text-tertiary font-medium">{t('patient.providers.sheetOnlineStatus')}</span>
                        <span className={`neu-flat-sm inline-flex items-center px-2.5 py-1 rounded-xl text-2xs font-extrabold uppercase tracking-wider ${
                          isUserOnline(viewingProvider.id) 
                            ? 'text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10' 
                            : 'text-tertiary dark:text-tertiary'
                        }`}>
                          {isUserOnline(viewingProvider.id) ? t('patient.providers.sheetActiveOnline') : t('patient.common.offline')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {sheetTab === 'services' && (
                  <div className="space-y-3">
                    <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">{t('patient.providers.sheetAvailableServices')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(viewingProvider.services || []).map((s, i) => (
                        <button
                          key={i}
                          onClick={(event) => {
                            openBookingModal(viewingProvider, s, event.currentTarget);
                          }}
                          className="neu-btn p-3.5 rounded-2xl flex items-center justify-between text-left hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
                        >
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-link transition-colors">{translateService(s)}</span>
                        </button>
                      ))}
                      {(!viewingProvider.services || viewingProvider.services.length === 0) && (
                        <p className="text-xs text-tertiary italic py-2">{t('patient.providers.sheetGeneralOnly')}</p>
                      )}
                    </div>
                  </div>
                )}

                {sheetTab === 'reviews' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-3xl font-black text-slate-900 dark:text-white">
                        {(viewingProvider.rating || 0).toFixed(1)}
                      </span>
                      <div>
                        <div className="flex items-center text-warning">
                          <Star weight="fill" className="w-4 h-4 fill-current" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">{t('patient.providers.sheetOverallRating')}</span>
                        </div>
                        <p className="text-xs text-tertiary">{t('patient.providers.sheetBasedOnReviews', { count: providerReviews.length })}</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {providerReviews.length > 0 ? (
                        providerReviews.slice(0, 3).map((rev, i) => (
                          <ReviewCard key={i} review={rev} />
                        ))
                      ) : (
                        <div className="neu-flat-sm p-6 rounded-2xl text-center">
                          <p className="text-xs text-tertiary">{t('patient.providers.sheetNoWrittenReviews')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Single-Page Seamless Layout */}
              <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-y-auto px-7 py-6 space-y-6">
                {/* Section 1: Practice Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{t('patient.providers.sheetPracticeHeader')}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-link">{t('patient.providers.sheetNetworkBadge')}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="neu-flat-sm p-4 rounded-2xl">
                      <p className="text-2xs uppercase font-extrabold text-tertiary tracking-wider">{t('patient.providers.sheetPracticeSchedule')}</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1.5">{t('patient.providers.sheetScheduleValue')}</p>
                      <p className="text-xs text-tertiary mt-1">{t('patient.providers.sheetWalkinsSub')}</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Services Offered (Collapsible) */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                        {t('patient.providers.sheetOfferedServices', { count: (viewingProvider.services || []).length })}
                      </h3>
                      <p className="text-xs text-tertiary">{t('patient.providers.sheetClickToBook')}</p>
                    </div>
                    {(viewingProvider.services || []).length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllServices(!showAllServices)}
                        className="neu-btn px-3 py-1.5 rounded-xl text-xs font-extrabold text-link flex items-center gap-1 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                      >
                        {showAllServices ? (
                          <>{t('patient.providers.sheetShowLess')} <CaretUp className="w-3 h-3" /></>
                        ) : (
                          <>{t('patient.providers.sheetShowAll', { count: (viewingProvider.services || []).length })} <CaretDown className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {((viewingProvider.services || []).slice(0, showAllServices ? undefined : 4)).map((s, i) => (
                      <button
                        key={i}
                        onClick={(event) => {
                          openBookingModal(viewingProvider, s, event.currentTarget);
                        }}
                        className="neu-btn p-3.5 rounded-2xl flex items-center justify-between text-left hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-link transition-colors truncate">{translateService(s)}</p>
                          <p className="text-xs text-tertiary">{t('patient.providers.sheetAvailableBooking')}</p>
                        </div>
                      </button>
                    ))}
                    {(!viewingProvider.services || viewingProvider.services.length === 0) && (
                      <p className="text-xs text-tertiary italic py-2 col-span-2">{t('patient.providers.sheetGeneralMedOnly')}</p>
                    )}
                  </div>
                </div>

                {/* Section 3: Patient Ratings & Reviews */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">{t('patient.providers.sheetPatientReviews')}</h3>
                      <p className="text-xs text-tertiary">{t('patient.providers.sheetFeedbackSub')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-warning">
                        <Star weight="fill" className="w-4 h-4 fill-current" />
                      </div>
                      <span className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                        {(viewingProvider.rating || 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-tertiary">({providerReviews.length})</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {providerReviews.length > 0 ? (
                      providerReviews.slice(0, 4).map((rev, i) => (
                        <ReviewCard key={i} review={rev} variant="bordered" />
                      ))
                    ) : (
                      <div className="neu-inset p-5 rounded-2xl text-center border border-slate-200/50 dark:border-white/5">
                        <p className="text-xs text-tertiary">{t('patient.providers.sheetNoReviewsLong')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Sticky Booking Action Button */}
              <div className="shrink-0 mt-auto px-5 md:px-6 pt-3 pb-3 border-t border-slate-200/60 dark:border-white/5 md:hidden">
                <button
                  onClick={(event) => {
                    openBookingModal(viewingProvider, undefined, event.currentTarget);
                  }}
                  disabled={requested.includes(viewingProvider.id)}
                  className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                    requested.includes(viewingProvider.id)
                      ? 'neu-btn text-success dark:text-success-dark cursor-not-allowed'
                      : 'neu-btn-primary shadow-md'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{requested.includes(viewingProvider.id) ? (getBookingButtonLabel(viewingProvider.id) || t('patient.providers.ongoingVisitFallback')) : t('patient.providers.bookAppointmentBtn')}</span>
                </button>
                <button
                  onClick={() => {
                    setViewingProvider(null);
                    navigate(`/patient/providers/${viewingProvider.id}/profile`);
                  }}
                  className="w-full py-2 mt-0.5 text-xs font-bold text-link hover:underline text-center cursor-pointer"
                >
                  {t('patient.providers.sheetViewFullProfile')}
                </button>
              </div>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      <VisitDestinationModal
        isOpen={destinationModalOpen}
        onClose={() => setDestinationModalOpen(false)}
        initial={visitDestination?.confirmed === false ? null : visitDestination}
        initialCenter={visitDestination?.confirmed === false ? visitDestination : null}
        homeAddress={patientHome?.address || ''}
        title={t('patient.providers.visitModalTitle')}
        description={t('patient.providers.visitModalDesc')}
        confirmLabel={t('patient.providers.visitModalConfirmBtn')}
        onConfirm={(dest) => {
          setVisitDestination({ ...dest, source: 'booking', version: 1, confirmed: true });
        }}
      />

    </DashboardLayout>
  );
};

export default PatientProviders;
