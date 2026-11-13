import React, { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Search, Star, MapPin, X, Calendar, Clock, Home, ArrowRight, Shield, ShieldCheck, SlidersHorizontal, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SkeletonPage, EmptyState, Sheet, SheetContent, SheetTitle, SheetDescription } from '@/shared/ui';
import { ReviewCard } from '@/shared/components';
import { usePresence } from '@/contexts/PresenceContext';
import { VisitDestinationModal } from '@/features/tracking/components';
import { ensurePatientCoords } from '@/features/tracking/services/geocoding';
import { bookVisitWithConsent } from '@/features/patient/services/booking';
import { slotsOverlap, toLocalDateKey, parseLocalDate, formatSlotLabel } from '@/lib/localDate';
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

const formatSlotParts = (timeStr, durationMinutes = 30) => {
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
  const endLabel = `to ${displayEndH}:${String(endMin).padStart(2, '0')} ${endPeriod}`;

  return { startLabel, endLabel };
};

const bookingSchema = z.object({
  service: z.string().min(1, 'Please select a service.'),
  date: z.string().min(1, 'Please select a date.').refine(d => d >= new Date().toLocaleDateString('en-CA'), 'Appointment date cannot be in the past.'),
  time: z.string().min(1, 'Please select a time slot.'),
  notes: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must consent to proceed.' }) }),
});

const PatientProviders = () => {
  const { isUserOnline } = usePresence();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [requested, setRequested] = useState([]);
  const [activeRequestsMap, setActiveRequestsMap] = useState({});

  // Maps the patient's active request status with a provider to a button label.
  const getBookingButtonLabel = (providerId) => {
    const status = activeRequestsMap[providerId];
    if (!status) return null;
    switch (status) {
      case 'Pending': return 'Pending Request';
      case 'Accepted': return 'Visit Confirmed';
      case 'On The Way': return 'Provider On The Way';
      case 'Arrived': return 'Provider Arrived';
      default: return `${status} Visit`;
    }
  };
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setSearchHistory] = useState([]);
  const searchRef = React.useRef(null);
  
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
    const amOpen = morningSlots.some((s) => s.available);
    const pmOpen = afternoonSlots.some((s) => s.available);
    if (!amOpen && pmOpen) {
      setSlotPeriod('pm');
    } else {
      setSlotPeriod('am');
    }
  }, [availableSlots, morningSlots, afternoonSlots]);

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

      const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = d.getDate();
      const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const label = isToday
        ? `Today (${monthShort} ${dayNum})`
        : isTomorrow
          ? `Tomorrow (${fullDate})`
          : fullDate;

      list.push({
        key,
        label,
        isToday,
        isTomorrow,
        dayShort: isToday ? 'Today' : isTomorrow ? 'Tmrw' : weekdayShort,
        weekdayShort,
        monthShort,
        dayNum,
        fullDate,
      });
    }
    return list;
  }, []);

  const formatBookingDateLabel = (dateStr) => {
    if (!dateStr) return 'Select a date';
    const match = dateOptions.find((d) => d.key === dateStr);
    if (match) return match.label;
    const parsed = parseLocalDate(dateStr);
    if (!parsed) return dateStr;
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
    if (!selectedProvider || !selectedProvider.id || !watchedDate) {
      setAvailableSlots([]);
      return;
    }

    let cancelled = false;
    const fetchAvailableSlots = async () => {
      setLoadingSlots(true);
      try {
        // Pending requests hold the slot: a provider can accept two of them, so a
        // time showing as free here must not be one someone is already waiting on.
        const { data: existingBookings } = await supabase
          .from('requests')
          .select('id, time, duration_minutes')
          .eq('provider_id', selectedProvider.id)
          .eq('date', watchedDate)
          .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

        if (cancelled) return;

        const todayStr = toLocalDateKey();
        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const slots = [];
        const intervalMinutes = 30;
        const startMinutes = WORKING_HOURS_START * 60;
        const endMinutes = WORKING_HOURS_END * 60;

        for (let m = startMinutes; m < endMinutes; m += intervalMinutes) {
          // A contiguous booking cannot cross clinic closing hours (5:00 PM)
          if (m + serviceDurationMinutes > endMinutes) continue;

          const h = Math.floor(m / 60);
          const min = m % 60;
          const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
          const isBooked = (existingBookings || []).some(b =>
            slotsOverlap(watchedDate, time, watchedDate, b.time, serviceDurationMinutes, b.duration_minutes || 30)
          );
          const isPast = watchedDate < todayStr || (watchedDate === todayStr && m <= currentTotalMinutes);
          const label = formatSlotLabel(time, serviceDurationMinutes);

          slots.push({
            time,
            label,
            durationMinutes: serviceDurationMinutes,
            available: !isBooked && !isPast,
            isPast,
            isBooked,
          });
        }

        if (cancelled) return;
        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error fetching available slots:', err);
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
    return () => { cancelled = true; };
  }, [selectedProvider, watchedDate, serviceDurationMinutes]);

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
      toast(
        existingStatus === 'Pending'
          ? `You already have a pending booking request with ${provider.full_name || 'this provider'}. You can track or manage it in My Requests.`
          : `You already have an ongoing visit (${existingStatus || 'in progress'}) with ${provider.full_name || 'this provider'}. Track it in My Requests.`,
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
          ? 'Place and confirm your visit pin before booking.'
          : 'Set your visit location before booking.'
      );
      return;
    }

    goToBookingStep('confirm', 'right');
  };

  const handleBookingValidationError = (fieldErrors) => {
    if (fieldErrors?.service) {
      focusSectionByKey('service');
      toast.error(fieldErrors.service.message || 'Please select a service.');
    } else if (fieldErrors?.date || fieldErrors?.time) {
      focusSectionByKey('schedule');
      toast.error(fieldErrors.time?.message || fieldErrors.date?.message || 'Please select an available time slot.');
    } else if (fieldErrors?.consent) {
      focusSectionByKey('consent');
      toast.error(fieldErrors.consent.message || 'Please confirm data-sharing consent.');
    }
  };

  const handleBookingSubmit = async () => {
    if (!user || !selectedProvider) return;

    const values = getValues();
    setBookingLoading(true);

    try {
      const { data: existing } = await supabase
        .from('requests')
        .select('id')
        .eq('patient_id', user.id)
        .eq('provider_id', selectedProvider.id)
        .eq('status', 'Pending');

      if (existing && existing.length > 0) {
        toast.error('You already have a pending request with this provider.');
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }

      const { data: conflict } = await supabase
        .from('requests')
        .select('id, time, duration_minutes')
        .eq('provider_id', selectedProvider.id)
        .eq('date', values.date)
        .in('status', ['Pending', 'Accepted', 'On The Way', 'Arrived']);

      const hasConflict = (conflict || []).some(c =>
        slotsOverlap(values.date, values.time, values.date, c.time, serviceDurationMinutes, c.duration_minutes || 30)
      );

      if (hasConflict) {
        toast.error('This time slot has just been taken. Please choose another.');
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
        toast.error('Please confirm the visit location before booking.');
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }
      if (destination.confirmed === false) {
        setDestinationModalOpen(true);
        toast.error('Place and confirm your visit pin before booking.');
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
          toast.error('This time slot has just been taken. Please choose another.');
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
      toast.success('Booking request sent!');
      goToBookingStep('done', 'right');
      if (!prefersReducedMotion) {
        confetti({ particleCount: 95, spread: 72, origin: { y: 0.52 }, zIndex: 9999 });
      }
    } catch (err) {
      console.error('Error sending request:', err);
      toast.error('Failed to send booking request. Please try again.');
      setBookingStep('form');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;

  const sortOptions = [
    { value: 'popular', label: 'Most Popular' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'trust', label: 'Trust Score' },
  ];

  return (
    <DashboardLayout role="patient">
      <div className="space-y-5 relative pb-6 w-full max-w-full">

        {/* Slim Inline Title Row + Unified Search & Mobile 1A 50/50 Filter Bar */}
        <section className="space-y-3.5 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h1 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white">
                Find a Healthcare Provider
              </h1>
              <p className="text-xs sm:text-sm text-tertiary dark:text-tertiary mt-0.5 max-w-xl">
                Connect with certified medical practitioners, nurses, and caregivers across Muntinlupa.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <span className="neu-flat-sm px-3 py-1.5 rounded-xl text-xs font-extrabold text-link border border-white/60 dark:border-white/5">
                Showing {sortedProviders.length} {sortedProviders.length === 1 ? 'provider' : 'providers'}
              </span>
            </div>
          </div>

          {/* Control Surface: Row 1 Search Input + Row 2 Mobile 1A 50/50 Split Specialty & Sort Buttons */}
          <div className="neu-flat p-2.5 sm:p-3 rounded-2xl border border-white/70 dark:border-white/5 flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
            {/* Search Input Container */}
            <div className="relative flex-1 min-w-0" ref={searchRef}>
              <label htmlFor="provider-search" className="sr-only">Search providers</label>
              <div className="neu-inset px-3 py-2 rounded-xl flex items-center gap-2.5 h-[46px] sm:h-[48px]">
                <Search className="w-4 h-4 text-link shrink-0" />
                <input
                  id="provider-search"
                  type="text"
                  placeholder="Search doctor, nurse, service..."
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-0.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchTerm(''); }}
                    aria-label="Clear search"
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
              <div className="relative md:min-w-[205px] z-50" ref={specialtyMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSpecialtyMenu(prev => !prev);
                    setShowSortMenu(false);
                  }}
                  className={`w-full neu-btn px-3 py-2 rounded-xl flex items-center justify-between gap-2 h-[46px] sm:h-[48px] transition-all cursor-pointer outline-none select-none ${
                    showSpecialtyMenu ? 'ring-2 ring-primary/20' : ''
                  }`}
                  aria-label="Filter by specialty"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-tertiary leading-none">
                      Specialty
                    </span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-1">
                      {selectedCategory === 'All' ? 'All Specialties' : selectedCategory}
                    </span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-link transition-transform duration-200 shrink-0 ${showSpecialtyMenu ? 'rotate-180' : ''}`} />
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
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Filter by Specialty</span>
                        {selectedCategory !== 'All' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory('All');
                              setShowSpecialtyMenu(false);
                            }}
                            className="text-2xs font-extrabold text-link hover:underline cursor-pointer"
                          >
                            Reset
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
                          <span>All Specialties</span>
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
                              <span className="truncate">{spec}</span>
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
              <div className="relative md:min-w-[185px] z-50" ref={sortMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSortMenu(prev => !prev);
                    setShowSpecialtyMenu(false);
                  }}
                  className={`w-full neu-btn px-3 py-2 rounded-xl flex items-center justify-between gap-2 h-[46px] sm:h-[48px] transition-all cursor-pointer relative outline-none select-none ${
                    showSortMenu ? 'ring-2 ring-primary/20' : ''
                  }`}
                  aria-label="Sort providers"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-tertiary leading-none">
                      Sort By
                    </span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate mt-1">
                      {sortOptions.find(o => o.value === sortBy)?.label || 'Most Popular'}
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
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Sort Providers</span>
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
                        <ShieldCheck className="w-4 h-4 text-link shrink-0" title="Verified Provider" />
                      </div>
                      <p className="text-xs font-semibold text-tertiary mt-0.5 truncate">
                        {p.location || 'Muntinlupa City'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-wider">
                          Verified Provider
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          • {servicesList.length} {servicesList.length === 1 ? 'Service' : 'Services'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Layer 2: Structured Specialty Well */}
                  <div className="neu-inset rounded-xl p-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-tertiary block mb-2">
                      Specialties & Home Services
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {servicesList.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/70 dark:border-white/5"
                        >
                          {s}
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
                    className="neu-btn px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:text-link dark:hover:text-[#8CBDF0] transition-all active:scale-[0.98] cursor-pointer shrink-0"
                  >
                    Profile
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
                      <span className="truncate">{getBookingButtonLabel(p.id) || 'Ongoing'}</span>
                    ) : (
                      <span>Book Appointment</span>
                    )}
                  </button>
                </div>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="neu-flat p-12 rounded-3xl text-center">
            <EmptyState icon="search" title="No providers found" message={searchTerm ? 'Try adjusting your search query.' : 'No verified providers match this category yet.'} />
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
              if (bookingStep === 'confirm' || destinationModalOpen || bookingLoading) event.preventDefault();
            }}
          >
            <motion.div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
              onClick={() => {
                if (bookingStep !== 'confirm' && !bookingLoading) closeBookingModal();
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
                          className="w-full h-full object-cover rounded-[14px]"
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
                              ? 'Book Appointment'
                              : bookingStep === 'confirm'
                                ? 'Confirm Booking'
                                : 'Visit Scheduled'}
                          </h2>
                        </DialogPrimitive.Title>
                        <DialogPrimitive.Description className="sr-only">
                          Select a service, arrival window, and confirmed home visit location with {selectedProvider.full_name}.
                        </DialogPrimitive.Description>
                        <span
                          className={`px-2 py-0.5 rounded-md text-2xs font-extrabold uppercase tracking-wider shrink-0 ${
                            bookingStep === 'done'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400'
                          }`}
                        >
                          {bookingStep === 'form'
                            ? 'Step 1 of 2'
                            : bookingStep === 'confirm'
                              ? 'Step 2 of 2'
                              : 'Confirmed'}
                        </span>
                      </div>
                      <p className="text-xs text-tertiary dark:text-tertiary truncate mt-0.5">
                        with <span className="font-extrabold text-link dark:text-primary-400">{selectedProvider.full_name}</span>
                        {bookingStep === 'done' && confirmedSnapshot?.service
                          ? ` • ${confirmedSnapshot.service}`
                          : watchedService
                            ? ` • ${watchedService}`
                            : selectedProvider.specialty
                              ? ` • ${selectedProvider.specialty}`
                              : selectedProvider.services?.[0]
                                ? ` • ${selectedProvider.services[0]}`
                                : ' • Verified Provider'}
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
                    ? formatSlotParts(watchedTime, serviceDurationMinutes)
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
                                Service Type
                              </label>
                              <span className="text-2xs font-extrabold text-link dark:text-primary-400 tabular-nums">
                                {serviceDurationMinutes} mins ({serviceSlotsCount} {serviceSlotsCount === 1 ? 'slot' : 'contiguous slots'})
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setOpenServiceMenu(prev => !prev)}
                              className="w-full neu-flat-sm rounded-2xl px-3.5 py-2.5 flex items-center justify-between text-left transition-all cursor-pointer outline-none select-none border border-white/75 dark:border-white/10 hover:border-primary/40 dark:hover:border-primary-400/40 active:scale-[0.99]"
                            >
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {watchedService || 'Select a service...'}
                              </span>
                              <span className="text-xs font-extrabold text-link dark:text-primary-400 shrink-0 ml-2 flex items-center gap-1">
                                {openServiceMenu ? 'Close' : 'Change'}
                                {openServiceMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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
                                              ? 'bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] font-extrabold shadow-sm'
                                              : 'text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70'
                                          }`}
                                        >
                                          <div className="min-w-0 pr-2">
                                            <span className="text-xs font-bold block truncate">{s}</span>
                                            <span className={`text-2xs block ${isSelected ? 'opacity-90' : 'text-tertiary'}`}>
                                              {sMins} mins ({sSlots} {sSlots === 1 ? 'slot' : 'slots'})
                                            </span>
                                          </div>
                                          {isSelected && <span className="text-2xs font-extrabold uppercase tracking-wider shrink-0">Selected</span>}
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
                                    Select Day &amp; Arrival Window
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
                                          {freeCount} open
                                        </span>
                                      );
                                    }
                                    if (allPast) {
                                      return (
                                        <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                          Clinic closed
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-2xs font-extrabold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                        Fully booked
                                      </span>
                                    );
                                  })()}

                                  <button
                                    type="button"
                                    onClick={() => setShowCustomDatePicker(prev => !prev)}
                                    className="neu-btn px-2.5 py-1 rounded-lg text-2xs font-extrabold text-link dark:text-primary-400 cursor-pointer active:scale-95 transition-transform"
                                  >
                                    {showCustomDatePicker ? 'Hide calendar' : 'More dates'}
                                  </button>
                                </div>
                              </div>

                              {/* Horizontal Date Chips */}
                              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5" role="listbox" aria-label="Appointment dates">
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
                                      className={`min-w-[66px] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 transition-all active:scale-[0.96] select-none outline-none ${
                                        isActive
                                          ? 'bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20'
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
                                    className="min-w-[70px] flex-1 rounded-xl py-2 px-2 text-center cursor-pointer shrink-0 bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20 select-none"
                                  >
                                    <span className="block text-2xs font-bold uppercase opacity-90">
                                      {customDateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                                    </span>
                                    <span className="block text-xs sm:text-sm font-extrabold leading-tight mt-0.5 tabular-nums">
                                      {customDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Jump to date:</span>
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
                                  Select a date above to view available slots.
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
                                    Checking provider availability...
                                  </p>
                                </div>
                              ) : availableSlots.length === 0 ? (
                                <div className="p-3 text-center text-xs text-tertiary">
                                  No slots available for this date.
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {availableSlots.every(s => !s.available) && (
                                    <div className="p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 font-medium">
                                      {availableSlots.every(s => s.isPast)
                                        ? 'Clinic working hours for today have ended (9:00 AM – 5:00 PM). Please select tomorrow or an upcoming date.'
                                        : 'All time slots are booked for this date. Please choose another date.'}
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
                                          ? 'text-white dark:text-[#08182A]'
                                          : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                      }`}
                                    >
                                      Morning ({amOpenCount} open)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSlotPeriod('pm')}
                                      className={`relative z-10 py-1.5 px-2.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer select-none ${
                                        slotPeriod === 'pm'
                                          ? 'text-white dark:text-[#08182A]'
                                          : 'text-slate-600 dark:text-slate-300 hover:text-link dark:hover:text-primary-400'
                                      }`}
                                    >
                                      Afternoon ({pmOpenCount} open)
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
                                            No {slotPeriod === 'am' ? 'morning' : 'afternoon'} slots for this service duration.
                                          </p>
                                          {otherOpenCount > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => setSlotPeriod(otherPeriod)}
                                              className="px-3 py-1 rounded-lg bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 text-xs font-extrabold cursor-pointer active:scale-95 transition-transform"
                                            >
                                              Switch to {otherOpenCount} {otherPeriod === 'am' ? 'Morning' : 'Afternoon'} slots →
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
                                              {slotPeriod === 'am' ? 'Morning' : 'Afternoon'} slots are full.
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setSlotPeriod(otherPeriod)}
                                              className="text-xs font-extrabold text-link dark:text-primary-400 cursor-pointer shrink-0 hover:underline"
                                            >
                                              View {otherOpenCount} {otherPeriod === 'am' ? 'AM' : 'PM'} open →
                                            </button>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                          {periodList.map(slot => {
                                            const isSelected = watchedTime === slot.time;
                                            const { startLabel, endLabel } = formatSlotParts(slot.time, serviceDurationMinutes);

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
                                                      ? 'bg-primary text-white dark:bg-primary-400 dark:text-[#08182A] shadow-md shadow-primary/25 dark:shadow-primary-400/20 cursor-pointer ring-2 ring-primary/35 dark:ring-primary-400/45 active:scale-[0.97]'
                                                      : 'neu-flat-sm text-slate-800 dark:text-slate-100 border border-white/75 dark:border-white/5 hover:border-primary/40 dark:hover:border-primary-400/40 cursor-pointer active:scale-[0.96]'
                                                }`}
                                              >
                                                <span className="text-xs font-extrabold block leading-tight tabular-nums">
                                                  {startLabel}
                                                </span>
                                                <span className={`text-[11px] font-semibold block mt-0.5 leading-tight tabular-nums ${
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
                                    Visit Location
                                  </span>
                                  <span className="text-2xs font-bold text-link dark:text-primary-400">
                                    • {!visitDestination
                                      ? 'Not set'
                                      : !destinationConfirmed
                                        ? 'Approximate'
                                        : visitDestination.source === 'booking'
                                          ? 'Custom location'
                                          : 'Saved address'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                                  {visitDestination?.address || patientHome?.address || 'Set visit location'}
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
                                        ? `GPS Pin Confirmed (${visitDestination.lat.toFixed(5)}, ${visitDestination.lng.toFixed(5)})`
                                        : `Approximate (${visitDestination.lat.toFixed(5)}, ${visitDestination.lng.toFixed(5)}) · Tap to place pin`
                                      : 'Tap to set address & gate directions'}
                                  </span>
                                </p>
                              </div>
                              <span className="neu-btn px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-link dark:text-primary-400 shrink-0">
                                Change
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
                                  {watchedNotes?.trim() ? 'Patient & gate notes added' : '+ Add gate notes or symptoms (optional)'}
                                </span>
                                <span className="text-2xs font-extrabold text-link dark:text-primary-400 shrink-0 ml-2 uppercase tracking-wider">
                                  {showBookingNotes || watchedNotes?.trim() ? 'Hide' : 'Add'}
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
                                    placeholder="e.g., Lobby guard knows visit name, gate code, symptoms..."
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
                                className="w-4 h-4 rounded accent-[#2F6FB5] dark:accent-[#8CBDF0] mt-0.5 cursor-pointer shrink-0"
                              />
                              <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                                I consent to sharing my medical profile &amp; address with <span className="font-bold text-slate-900 dark:text-white">{selectedProvider.full_name}</span> for this home care visit.
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
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="w-full neu-btn-primary py-3 px-4 rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                            >
                              <span>
                                {selectedSlotParts
                                  ? `Review ${selectedSlotParts.startLabel} Visit`
                                  : 'Select a Time Slot'}
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
                              className="origin-top absolute left-[15px] top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-primary via-primary to-emerald-500 dark:from-primary-400 dark:via-primary-400 dark:to-emerald-400"
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
                                  <span className="text-2xs font-bold text-tertiary block">Date</span>
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
                                  Edit
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
                                  <span className="text-2xs font-bold text-tertiary block">Arrival window</span>
                                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums block mt-0.5">
                                    {formatSlotLabel(vals.time, serviceDurationMinutes)}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="text-xs font-extrabold text-link dark:text-primary-400">
                                      {vals.service} • {serviceDurationMinutes} mins ({serviceSlotsCount} {serviceSlotsCount === 1 ? 'slot' : 'slots'})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => goToBookingStep('form', 'left', 'service')}
                                      disabled={bookingLoading}
                                      className="text-2xs font-extrabold uppercase tracking-wider text-tertiary hover:text-link dark:hover:text-primary-400 underline cursor-pointer disabled:opacity-50"
                                    >
                                      Switch
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToBookingStep('form', 'left', 'schedule')}
                                  disabled={bookingLoading}
                                  className="text-xs font-extrabold text-link dark:text-primary-400 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>

                            {/* Timeline Node 3: Home Visit + Calm GPS Confirmation */}
                            <div className="relative">
                              <motion.div
                                {...nodeMotion(0.18)}
                                className="absolute -left-10 top-3 w-8 h-8 rounded-full bg-surface-shell border-2 border-emerald-500 dark:border-emerald-400 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm"
                              >
                                <Home className="w-4 h-4" />
                              </motion.div>
                              <div className="neu-flat-sm rounded-2xl px-3.5 py-3 space-y-2.5 border border-white/75 dark:border-white/10">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-2xs font-bold text-tertiary block">
                                      Home visit{visitDestination && !destinationConfirmed ? ' · approximate' : ''}
                                    </span>
                                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-snug mt-0.5">
                                      {visitDestination?.address || 'Not confirmed'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => goToBookingStep('form', 'left', 'location')}
                                    disabled={bookingLoading}
                                    className="text-xs font-extrabold text-link dark:text-primary-400 hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                                  >
                                    Edit
                                  </button>
                                </div>

                                {visitDestination?.lat != null && (
                                  destinationConfirmed ? (
                                    <div className="rounded-xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 px-3 py-2 flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                      <div className="text-[11px] leading-snug min-w-0">
                                        <span className="font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums block">
                                          GPS Pin Confirmed ({visitDestination.lat.toFixed(5)}, {visitDestination.lng.toFixed(5)})
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                                          This helps your provider find the exact entrance.
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/60 px-3 py-2 flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                      <div className="text-[11px] leading-snug min-w-0">
                                        <span className="font-extrabold text-amber-800 dark:text-amber-300 tabular-nums block">
                                          Approximate Pin ({visitDestination.lat.toFixed(5)}, {visitDestination.lng.toFixed(5)})
                                        </span>
                                        <span className="text-slate-600 dark:text-slate-300 block mt-0.5">
                                          Tap Edit above to place your exact gate entrance pin.
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
                                Patient &amp; Gate Notes
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
                                Data sharing consent verified
                              </div>
                              <div className="text-[11px] text-tertiary truncate">
                                Instant booking notice sent to {selectedProvider.full_name}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-2xs font-extrabold uppercase tracking-wider shrink-0">
                            Ready
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
                            Back
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
                                <span>Submitting...</span>
                              </>
                            ) : (
                              <span>Confirm Appointment</span>
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
                        <div className="relative w-16 h-16 flex items-center justify-center mt-1">
                          {!prefersReducedMotion && (
                            <motion.div
                              aria-hidden="true"
                              initial={{ opacity: 0.55, scale: 0.88 }}
                              animate={{ opacity: 0, scale: 1.65 }}
                              transition={{ duration: 1.05, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                              className="absolute inset-0 rounded-full bg-emerald-400/35"
                            />
                          )}
                          <div className="w-16 h-16 rounded-full bg-emerald-500 dark:bg-emerald-400 text-white dark:text-[#08182A] flex items-center justify-center shadow-lg shadow-emerald-500/30 relative z-10">
                            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                              <motion.path
                                d="M5 13l4 4L19 7"
                                initial={{ pathLength: prefersReducedMotion ? 1 : 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.42, delay: prefersReducedMotion ? 0 : 0.14, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </svg>
                          </div>
                        </div>

                        <h3 className="text-lg sm:text-xl font-display font-extrabold text-slate-900 dark:text-white mt-4">
                          Appointment Requested!
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
                          We sent your <strong className="text-slate-900 dark:text-white">{summary.service}</strong> visit details to{' '}
                          <strong className="text-slate-900 dark:text-white">{summary.providerName}</strong>.
                        </p>

                        <div className="w-full neu-inset rounded-2xl p-4 mt-5 text-left space-y-2.5 border border-white/60 dark:border-white/5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-tertiary font-bold shrink-0">Date &amp; Time</span>
                            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums text-right">
                              {formatBookingDateLabel(summary.date)} • {formatSlotLabel(summary.time, summary.durationMinutes)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-tertiary font-bold shrink-0">Location</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-right">
                              {summary.address || 'Confirmed GPS pin'}
                            </span>
                          </div>
                        </div>

                        <div className="w-full neu-flat-sm rounded-2xl p-4 mt-3 text-left space-y-2.5 border border-white/75 dark:border-white/10">
                          <span className="text-2xs font-extrabold uppercase tracking-wider text-link dark:text-primary-400 block">
                            What happens next
                          </span>
                          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold text-2xs flex items-center justify-center shrink-0">1</span>
                              <span>{summary.providerName} reviews your visit notes &amp; GPS pin.</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 font-extrabold text-2xs flex items-center justify-center shrink-0">2</span>
                              <span>You’ll get live status updates inside My Requests.</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 dark:bg-primary-400/15 text-link dark:text-primary-400 font-extrabold text-2xs flex items-center justify-center shrink-0">3</span>
                              <span>Medical profile sharing expires automatically after care.</span>
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
                            Done
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeBookingModal();
                              navigate('/patient/requests');
                            }}
                            className="w-full py-3 px-4 neu-btn-primary rounded-xl shadow-md flex items-center justify-center gap-1.5 text-xs sm:text-sm font-extrabold cursor-pointer active:scale-[0.98]"
                          >
                            <span>View My Requests</span>
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
          className={`sm:max-w-lg md:max-w-3xl lg:max-w-4xl sm:mx-auto sm:bottom-4 rounded-t-[2.5rem] sm:rounded-[2.5rem] md:inset-0 md:m-auto h-[80dvh] min-h-[460px] sm:h-[82vh] md:min-h-[540px] max-h-[88vh] flex flex-col overflow-hidden p-0 bg-surface-shell border-0 shadow-2xl transform-gpu will-change-transform ${selectedProvider ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <SheetTitle className="sr-only">{viewingProvider?.full_name || 'Provider Profile'}</SheetTitle>
          <SheetDescription className="sr-only">View provider details, trust score, and reviews</SheetDescription>
          {viewingProvider && (
          <div className="flex flex-col h-full min-h-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0 md:grid md:grid-cols-[360px_minmax(0,1fr)]">
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
                    <div className="w-[72px] h-[72px] md:w-20 md:h-20 rounded-2xl neu-flat flex items-center justify-center text-xl font-black text-link overflow-hidden p-0.5 ring-4 ring-white dark:ring-slate-900 shadow-md aspect-square">
                      {viewingProvider.avatar_url ? (
                        <img
                          src={viewingProvider.avatar_url}
                          alt={`${viewingProvider.full_name} photo`}
                          className="w-full h-full object-cover rounded-[14px]"
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
                          <ShieldCheck className="w-3 h-3 text-success" /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center text-warning">
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </div>
                      <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                        {(viewingProvider.rating || 0).toFixed(1)}
                      </span>
                      <span className="text-xs text-tertiary">({providerReviews.length} reviews)</span>
                      <span className={`text-xs font-semibold ml-1 ${isUserOnline(viewingProvider.id) ? 'text-success font-bold' : 'text-tertiary'}`}>
                        • {isUserOnline(viewingProvider.id) ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-3 text-xs">
                  <p className="text-tertiary dark:text-tertiary flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-link shrink-0" />
                    <span className="truncate">{viewingProvider.location || 'Muntinlupa City'}</span>
                  </p>
                </div>
              </div>

              {/* Desktop-only Combined Practitioner Info & Metrics */}
              <div className="hidden md:block px-6 mt-4 space-y-3.5">
                {/* About Practitioner Bio */}
                <div className="neu-flat-sm p-3.5 rounded-2xl">
                  <p className="text-2xs uppercase font-extrabold tracking-wider text-tertiary mb-1">About Practitioner</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {viewingProvider.bio || 'Dedicated healthcare practitioner serving families in Muntinlupa.'}
                  </p>
                </div>

                {/* 3 Metric chips: Rating, Services, Status */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Rating</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">{(viewingProvider.rating || 0).toFixed(1)} ★</p>
                  </div>
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Services</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-0.5">{(viewingProvider.services || []).length}</p>
                  </div>
                  <div className="neu-flat-sm p-2.5 rounded-xl text-center">
                    <p className="text-2xs uppercase font-bold text-tertiary">Status</p>
                    <p className={`text-xs font-black mt-1 capitalize ${isUserOnline(viewingProvider.id) ? 'text-success' : 'text-tertiary'}`}>
                      {isUserOnline(viewingProvider.id) ? 'Active' : 'Offline'}
                    </p>
                  </div>
                </div>

                {/* Trust Score */}
                <div className="neu-flat-sm p-3 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-link" />
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Trust Score</span>
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
                  <span>{requested.includes(viewingProvider.id) ? (getBookingButtonLabel(viewingProvider.id) || 'Ongoing Visit') : 'Book Appointment'}</span>
                </button>
                <button
                  onClick={() => {
                    setViewingProvider(null);
                    navigate(`/patient/providers/${viewingProvider.id}/profile`);
                  }}
                  className="w-full py-2.5 mt-1 text-xs font-bold text-link hover:underline text-center cursor-pointer"
                >
                  View Full Profile
                </button>
              </div>
            </div>

            {/* Right Column / Content */}
            <div className="flex flex-col flex-1 min-h-0 md:h-full">
              {/* Mobile Only Segmented Tabs */}
              <div className="px-5 md:hidden mt-4 shrink-0">
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl" role="tablist">
                  {[
                    { v: 'overview', label: 'Overview' },
                    { v: 'services', label: `Services (${(viewingProvider.services || []).length})` },
                    { v: 'reviews', label: `Reviews (${providerReviews.length})` },
                  ].map(t => (
                    <button
                      key={t.v}
                      type="button"
                      role="tab"
                      aria-selected={sheetTab === t.v}
                      onClick={() => setSheetTab(t.v)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer truncate outline-none select-none ${
                        sheetTab === t.v
                          ? 'bg-primary text-white shadow-md'
                          : 'text-slate-600 dark:text-tertiary hover:text-link dark:hover:text-white bg-transparent'
                      }`}
                    >
                      {t.label}
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
                        <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Trust Score</span>
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
                      <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary mb-1.5">About Healthcare Provider</p>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {viewingProvider.bio || 'Dedicated healthcare practitioner serving families in Muntinlupa.'}
                      </p>
                    </div>

                    <div className="neu-flat-sm p-4 rounded-2xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-tertiary font-medium">Primary Area</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{viewingProvider.location || 'Muntinlupa City'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-tertiary font-medium">Service Schedule</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          Mon – Sat • 9:00 AM – 5:00 PM
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                        <span className="text-tertiary font-medium">Online Status</span>
                        <span className={`neu-flat-sm inline-flex items-center px-2.5 py-1 rounded-xl text-2xs font-extrabold uppercase tracking-wider ${
                          isUserOnline(viewingProvider.id) 
                            ? 'text-success dark:text-success-dark border border-emerald-500/30 bg-emerald-500/10' 
                            : 'text-tertiary dark:text-tertiary'
                        }`}>
                          {isUserOnline(viewingProvider.id) ? 'Active Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {sheetTab === 'services' && (
                  <div className="space-y-3">
                    <p className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Available Medical Services</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(viewingProvider.services || []).map((s, i) => (
                        <button
                          key={i}
                          onClick={(event) => {
                            openBookingModal(viewingProvider, s, event.currentTarget);
                          }}
                          className="neu-btn p-3.5 rounded-2xl flex items-center justify-between text-left hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer group"
                        >
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-link transition-colors">{s}</span>
                        </button>
                      ))}
                      {(!viewingProvider.services || viewingProvider.services.length === 0) && (
                        <p className="text-xs text-tertiary italic py-2">General consultation only.</p>
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
                          <Star className="w-4 h-4 fill-current" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Overall Rating</span>
                        </div>
                        <p className="text-xs text-tertiary">Based on {providerReviews.length} verified patient visits</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {providerReviews.length > 0 ? (
                        providerReviews.slice(0, 3).map((rev, i) => (
                          <ReviewCard key={i} review={rev} />
                        ))
                      ) : (
                        <div className="neu-flat-sm p-6 rounded-2xl text-center">
                          <p className="text-xs text-tertiary">No written reviews yet for this provider.</p>
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
                    <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Practice & Consultation</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-link">Muntinlupa Health Network</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="neu-flat-sm p-4 rounded-2xl">
                      <p className="text-2xs uppercase font-extrabold text-tertiary tracking-wider">Practice Schedule</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1.5">Mon – Sat • 9:00 AM – 5:00 PM</p>
                      <p className="text-xs text-tertiary mt-1">Walk-ins & scheduled appointments</p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Services Offered (Collapsible) */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                        Offered Services ({(viewingProvider.services || []).length})
                      </h3>
                      <p className="text-xs text-tertiary">Click any service to book directly</p>
                    </div>
                    {(viewingProvider.services || []).length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllServices(!showAllServices)}
                        className="neu-btn px-3 py-1.5 rounded-xl text-xs font-extrabold text-link flex items-center gap-1 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                      >
                        {showAllServices ? (
                          <>Show Less <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Show All ({(viewingProvider.services || []).length}) <ChevronDown className="w-3 h-3" /></>
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
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-link transition-colors truncate">{s}</p>
                          <p className="text-xs text-tertiary">Available for booking</p>
                        </div>
                      </button>
                    ))}
                    {(!viewingProvider.services || viewingProvider.services.length === 0) && (
                      <p className="text-xs text-tertiary italic py-2 col-span-2">General medical consultation only.</p>
                    )}
                  </div>
                </div>

                {/* Section 3: Patient Ratings & Reviews */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">Patient Reviews</h3>
                      <p className="text-xs text-tertiary">Feedback from verified appointments</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-warning">
                        <Star className="w-4 h-4 fill-current" />
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
                        <p className="text-xs text-tertiary">No written reviews yet for this healthcare provider.</p>
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
                  <span>{requested.includes(viewingProvider.id) ? (getBookingButtonLabel(viewingProvider.id) || 'Ongoing Visit') : 'Book Appointment'}</span>
                </button>
                <button
                  onClick={() => {
                    setViewingProvider(null);
                    navigate(`/patient/providers/${viewingProvider.id}/profile`);
                  }}
                  className="w-full py-2 mt-0.5 text-xs font-bold text-link hover:underline text-center cursor-pointer"
                >
                  View Full Profile
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
        title="Confirm visit location"
        description="This pin is shared with your provider for this visit only. It does not change your saved home address."
        confirmLabel="Use this visit location"
        onConfirm={(dest) => {
          setVisitDestination({ ...dest, source: 'booking', version: 1, confirmed: true });
        }}
      />

    </DashboardLayout>
  );
};

export default PatientProviders;
