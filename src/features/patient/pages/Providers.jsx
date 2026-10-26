import React, { useState, useEffect, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Search, Star, MapPin, Home, X, Calendar, FileText, CheckCircle2, Shield, ShieldCheck, SlidersHorizontal, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const SLOT_DURATION_MINUTES = 60;

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
  const [openTimeMenu, setOpenTimeMenu] = useState(false);
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues, reset } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { service: '', date: '', time: '', notes: '', consent: false },
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState('form');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientHome, setPatientHome] = useState(null);
  const [visitDestination, setVisitDestination] = useState(null);
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const watchedDate = watch('date');
  const watchedService = watch('service');
  const watchedTime = watch('time');

  const [sortBy, setSortBy] = useState('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
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
          version: 0,
        });
      } else if (address) {
        const coords = await ensurePatientCoords(user.id);
        if (!active || !coords) return;
        setPatientHome((prev) => ({ ...(prev || {}), ...coords, address }));
        setVisitDestination((prev) => prev || {
          ...coords,
          address,
          source: 'patient_home',
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

    const fetchAvailableSlots = async () => {
      setLoadingSlots(true);
      try {
        const { data: existingBookings } = await supabase
          .from('requests')
          .select('time')
          .eq('provider_id', selectedProvider.id)
          .eq('date', watchedDate)
          .in('status', ['Accepted', 'On The Way', 'Arrived']);

        const bookedTimes = (existingBookings || []).map(b => b.time).filter(Boolean);

        const todayStr = new Date().toLocaleDateString('en-CA');
        const currentHour = new Date().getHours();
        const slots = [];
        for (let hour = WORKING_HOURS_START; hour < WORKING_HOURS_END; hour++) {
          const time = `${String(hour).padStart(2, '0')}:00`;
          const isBooked = bookedTimes.some(bt => {
            if (!bt || typeof bt !== 'string') return false;
            const parts = bt.split(':');
            if (parts.length < 2) return false;
            const bh = parseInt(parts[0], 10);
            const bm = parseInt(parts[1], 10);
            const slotStart = hour;
            const slotEnd = hour + SLOT_DURATION_MINUTES / 60;
            const bookingTime = bh + bm / 60;
            return bookingTime >= slotStart && bookingTime < slotEnd;
          });
          const isPast = watchedDate < todayStr || (watchedDate === todayStr && hour <= currentHour);
          slots.push({ time, available: !isBooked && !isPast });
        }

        setAvailableSlots(slots);
      } catch (err) {
        console.error('Error fetching available slots:', err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchAvailableSlots();
  }, [selectedProvider, watchedDate]);

  // Toggle body class when modals open to hide bottom nav
  useEffect(() => {
    if (selectedProvider || viewingProvider) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [selectedProvider, viewingProvider]);

  const sortedProviders = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const filtered = providers.filter(p => {
      const matchesSearch = !q ||
        p.full_name.toLowerCase().includes(q) ||
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
  }, [providers, searchTerm, sortBy]);

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
    setAvailableSlots([]);
    if (user?.id && !visitDestination) {
      ensurePatientCoords(user.id).then((coords) => {
        if (!coords) return;
        setVisitDestination((prev) => prev || {
          ...coords,
          address: patientHome?.address || '',
          source: 'patient_home',
          version: 0,
        });
      });
    }
    reset({
      service: presetService || provider.services?.[0] || 'General Care',
      date: new Date().toLocaleDateString('en-CA'),
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

  const handleReviewBooking = () => {
    if (!user || !selectedProvider) return;
    setBookingStep('confirm');
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

      const startHour = values.time.split(':')[0];
      const { data: conflict } = await supabase
        .from('requests')
        .select('id, time')
        .eq('provider_id', selectedProvider.id)
        .eq('date', values.date)
        .in('status', ['Accepted', 'On The Way', 'Arrived']);

      const hasConflict = (conflict || []).some(c => {
        if (!c.time) return false;
        return parseInt(c.time.split(':')[0], 10) === parseInt(startHour, 10);
      });

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
            source: 'patient_home',
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

      // 2. Send the request
      const { error: reqError } = await supabase
        .from('requests')
        .insert([{
          patient_id: user.id,
          provider_id: providerId,
          service: values.service,
          date: values.date,
          time: values.time + ':00',
          status: 'Pending',
          notes: values.notes,
          dest_lat: destination.lat,
          dest_lng: destination.lng,
          dest_address: destination.address || null,
          dest_source: 'booking',
          dest_version: 1,
          dest_updated_at: new Date().toISOString(),
        }]);

      if (reqError) throw reqError;

      // 3. Enable Data Sharing (Consent)
      const { error: consentErr } = await supabase
        .from('consent_access')
        .upsert([{
          patient_id: user.id,
          provider_id: providerId,
          is_enabled: true,
          permissions: { medical_history: true, documents: true, visit_notes: true },
        }], { onConflict: 'patient_id,provider_id' });

      if (consentErr) {
        console.warn('Could not grant consent access:', consentErr);
      }

      setRequested(prev => [...new Set([...prev, providerId])]);
      setActiveRequestsMap(prev => ({ ...prev, [providerId]: 'Pending' }));
      setSelectedProvider(null);
      setVisitDestination(
        patientHome?.lat != null
          ? {
              lat: patientHome.lat,
              lng: patientHome.lng,
              address: patientHome.address || '',
              source: 'patient_home',
              version: 0,
            }
          : null
      );
      toast.success('Booking request sent!');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
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
      <div className="space-y-6 relative pb-6 w-full max-w-full">

        {/* Directory Header - Unified Neumorphic Card with Integrated Search & Sort */}
        <section className="neu-flat p-6 md:p-8 rounded-[2.25rem] space-y-5 relative z-30">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold tracking-tight text-2xl md:text-3xl text-slate-900 dark:text-white">
              Find a Healthcare Provider
            </h1>
            <p className="text-sm text-tertiary dark:text-tertiary mt-1 max-w-xl">
              Connect with {sortedProviders.length} certified medical practitioners, nurses, and caregivers across Muntinlupa.
            </p>
          </div>

          {/* Integrated Search Bar & Sort Dropdown Row (Search bar dominates the row) */}
          <div className="flex flex-row items-center gap-2 sm:gap-3 pt-1">
            {/* Search Input Container - DOMINATES THE WIDTH */}
            <div className="relative flex-1 min-w-0" ref={searchRef}>
              <label htmlFor="provider-search" className="sr-only">Search providers or services</label>
              <div className="neu-inset p-1.5 sm:p-2.5 rounded-2xl flex items-center gap-2 sm:gap-3 h-[48px] sm:h-[52px]">
                <Search className="w-4 h-4 text-link ml-2 shrink-0" />
                <input
                  id="provider-search"
                  type="text"
                  placeholder="Search doctor, nurse, clinic, specialty..."
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-0 px-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:outline-none focus:ring-0 placeholder:text-tertiary placeholder:font-normal min-w-0"
                />
                {searchTerm && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setSearchTerm(''); }}
                    aria-label="Clear search"
                    className="neu-btn w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-tertiary hover:text-danger transition-colors shrink-0 mr-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Sleek Neumorphic Filter/Sort Icon Button with Popup Menu */}
            <div className="relative shrink-0 z-50" ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setShowSortMenu(prev => !prev)}
                className={`neu-btn w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative outline-none select-none ${
                  showSortMenu ? 'text-link' : 'text-slate-600 dark:text-slate-300 hover:text-link'
                }`}
                aria-label="Filter and Sort options"
                title={`Sort by: ${sortOptions.find(o => o.value === sortBy)?.label || 'Filter'}`}
              >
                <SlidersHorizontal className="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
                {sortBy !== 'popular' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>

              {/* Filter / Sort Floating Popover Menu */}
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute right-0 top-full mt-2 w-52 sm:w-56 neu-flat rounded-2xl p-2 z-50 shadow-2xl border border-white/60 dark:border-white/10"
                  >
                    <div className="px-3 py-2 border-b border-slate-200/60 dark:border-white/5 mb-1 flex items-center justify-between">
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Sort Providers</span>
                      <span className="text-xs text-link font-bold">
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
                                ? 'neu-flat-sm text-link font-bold shadow-sm'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {active && <Check className="w-3.5 h-3.5 text-link shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Uniform Neumorphic Provider Cards Grid */}
        {sortedProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {sortedProviders.map((p, idx) => {
              return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(idx, 9) * 0.04 }}
                className="neu-flat p-5 sm:p-6 rounded-[2.25rem] flex flex-col justify-between select-text"
              >
                <div>
                  {/* Avatar + Name + Rating */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="relative shrink-0">
                      <div className="neu-flat-sm w-16 h-16 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-lg font-bold text-link overflow-hidden p-0.5 aspect-square">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={`${p.full_name} photo`} className="w-full h-full object-cover rounded-[14px]" loading="lazy" />
                        ) : (
                          p.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
                        )}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isUserOnline(p.id) ? 'bg-emerald-500 shadow-sm' : 'bg-slate-300 dark:bg-slate-600'}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 text-base truncate">
                          {p.full_name}
                        </h3>
                        {p.professional_id_status === 'verified' && (
                          <span className="text-link shrink-0" title="Verified License">
                            <ShieldCheck className="w-4 h-4 text-link" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-amber-400 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(p.rating || 0) ? 'fill-current' : 'text-slate-300 dark:text-slate-700'}`} />
                        ))}
                        <span className="text-slate-700 dark:text-slate-200 text-xs font-bold tabular-nums ml-1">{(p.rating || 0).toFixed(1)}</span>
                        <span className={`text-xs font-semibold ml-1.5 ${isUserOnline(p.id) ? 'text-success font-bold' : 'text-tertiary'}`}>
                          • {isUserOnline(p.id) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trust Score Bar */}
                  <div className="mb-3.5 px-0.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">Trust Score</span>
                      <span className="text-xs font-black tabular-nums text-slate-800 dark:text-slate-200">{p.trust_score}/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          p.trust_score >= 70 ? 'bg-emerald-500' : p.trust_score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${p.trust_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Service Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(p.services || []).slice(0, 2).map((s, i) => (
                      <span key={i} className="neu-flat-sm px-2.5 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300">
                        {s}
                      </span>
                    ))}
                    {(p.services || []).length > 2 && (
                      <span className="neu-flat-sm px-2 py-1 text-tertiary dark:text-tertiary rounded-xl text-xs font-bold">
                        +{p.services.length - 2} more
                      </span>
                    )}
                    {(!p.services || p.services.length === 0) && (
                      <span className="neu-flat-sm px-2.5 py-1 text-tertiary rounded-xl text-xs font-medium">
                        General Consultation
                      </span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="flex items-center justify-between text-xs text-tertiary dark:text-tertiary mb-5">
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                      <MapPin className="w-3.5 h-3.5 text-link shrink-0" />
                      <span className="truncate">{p.location || 'Muntinlupa City'}</span>
                    </span>
                  </div>
                </div>

                {/* Tactile Neumorphic Action Button */}
                <button
                  onClick={(event) => {
                    sheetTriggerRef.current = event.currentTarget;
                    setViewingProvider(p);
                  }}
                  className={`w-full py-3.5 rounded-2xl text-xs sm:text-sm font-bold transition-transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                    requested.includes(p.id)
                      ? 'neu-btn text-success dark:text-success-dark'
                      : 'neu-btn-primary shadow-sm'
                  }`}
                >
                  {requested.includes(p.id) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span>{getBookingButtonLabel(p.id) || 'Request Sent'}</span>
                    </>
                  ) : (
                    <span>View Profile</span>
                  )}
                </button>
              </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="neu-flat p-12 rounded-[2.25rem] text-center">
            <EmptyState icon="search" title="No providers found" message={searchTerm ? 'Try adjusting your search query.' : 'No verified providers match this category yet.'} />
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <DialogPrimitive.Root
        open={!!selectedProvider}
        onOpenChange={(open) => { if (!open) setSelectedProvider(null); }}
      >
        {selectedProvider && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            asChild
            aria-modal="true"
            onCloseAutoFocus={(event) => {
              if (!bookingTriggerRef.current) return;
              event.preventDefault();
              bookingTriggerRef.current.focus();
            }}
            onInteractOutside={(event) => {
              if (bookingStep !== 'form') event.preventDefault();
            }}
          >
            <motion.div 
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              onClick={() => {
                if (bookingStep === 'form') setSelectedProvider(null);
              }}
            >
              <motion.div 
                className="neu-flat rounded-t-[2.25rem] sm:rounded-[2.25rem] w-full max-w-lg p-5 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] relative max-h-[92dvh] overflow-y-auto no-scrollbar transform-gpu will-change-transform shadow-2xl border-t sm:border border-white/60 dark:border-white/10"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
              >
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="absolute right-3 top-3 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-tertiary dark:text-tertiary hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </DialogPrimitive.Close>

                {/* Mobile drag handle indicator */}
                <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" aria-hidden="true" />

                <div className="mb-3 text-center">
                  <DialogPrimitive.Title asChild>
                    <h2 className="text-base sm:text-xl md:text-2xl font-display font-extrabold text-slate-900 dark:text-white">
                      {bookingStep === 'form' ? 'Book Appointment' : 'Confirm Booking'}
                    </h2>
                  </DialogPrimitive.Title>
                  <p className="text-sm text-tertiary dark:text-tertiary mt-0.5">
                    with <span className="font-extrabold text-link">{selectedProvider.full_name}</span>
                  </p>
                </div>

              {/* Step Progress */}
              <div className="flex items-center gap-2 mb-3.5 px-1">
                <div className={`flex items-center gap-1.5 text-xs font-bold ${bookingStep === 'form' ? 'text-link' : 'text-success'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                    bookingStep === 'confirm' ? 'neu-btn text-success' : 'neu-btn-primary'
                  }`}>
                    {bookingStep === 'confirm' ? '✓' : '1'}
                  </div>
                  <span className="text-xs sm:text-xs">Details</span>
                </div>
                <div className={`flex-1 h-0.5 rounded-full ${bookingStep === 'confirm' ? 'bg-emerald-500/40' : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`flex items-center gap-1.5 text-xs font-bold ${bookingStep === 'confirm' ? 'text-link' : 'text-tertiary dark:text-tertiary'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                    bookingStep === 'confirm' ? 'neu-btn-primary' : 'neu-flat-sm text-tertiary dark:text-tertiary'
                  }`}>
                    2
                  </div>
                  <span className="text-xs sm:text-xs">Confirm</span>
                </div>
              </div>

              {/* Step 1: Booking Form (Clean, English, Elder-Friendly with Real Custom Menus) */}
              {bookingStep === 'form' && (
                <form onSubmit={handleSubmit(handleReviewBooking)} className="space-y-2.5">
                  {/* Service Selection - Custom Neumorphic Dropdown */}
                  <div className="space-y-1.5 relative z-30">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      1. Service Type
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenServiceMenu(prev => !prev);
                        setOpenTimeMenu(false);
                      }}
                      className="w-full neu-flat-sm rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer outline-none select-none"
                    >
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-2 pr-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {watchedService || 'Select a service...'}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-tertiary transition-transform duration-200 shrink-0 ${openServiceMenu ? 'rotate-180 text-link' : ''}`} />
                    </button>

                    {/* Custom Dropdown List */}
                    <AnimatePresence>
                      {openServiceMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 right-0 top-full mt-1.5 bg-surface-shell rounded-2xl p-1.5 z-40 shadow-xl border border-white/60 dark:border-white/10 space-y-1 max-h-56 overflow-y-auto"
                        >
                          {(selectedProvider.services?.length > 0 ? selectedProvider.services : ['General Care']).map(s => {
                            const isSelected = watchedService === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  setValue('service', s, { shouldValidate: true });
                                  setOpenServiceMenu(false);
                                }}
                                className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer outline-none select-none ${
                                  isSelected
                                    ? 'bg-primary text-white font-bold'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <span className="text-xs font-bold">{s}</span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {errors.service && (
                      <p className="text-xs font-medium text-danger ml-1">{errors.service.message}</p>
                    )}
                  </div>

                  {/* Date Selection - Clean and Simple */}
                  <div className="space-y-1.5">
                    <label htmlFor="booking-date" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      2. Appointment Date
                    </label>
                    <div className="neu-flat-sm rounded-xl p-3 flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-link shrink-0" />
                      <input
                        id="booking-date"
                        type="date"
                        min={new Date().toLocaleDateString('en-CA')}
                        {...register('date', { onChange: () => { setValue('time', ''); setOpenTimeMenu(false); } })}
                        className={`w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white outline-none cursor-pointer ${
                          errors.date ? 'text-danger' : ''
                        }`}
                      />
                    </div>
                    {errors.date && (
                      <p className="text-xs font-medium text-danger ml-1">{errors.date.message}</p>
                    )}
                  </div>

                  {/* Time Selection - Custom Dropdown with Clean Available Times */}
                  <div className="space-y-1.5 relative z-20">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      3. Appointment Time
                    </label>
                    
                    {!watchedDate ? (
                      <div className="neu-flat-sm p-3.5 rounded-xl text-center">
                        <p className="text-xs text-tertiary dark:text-tertiary">Please select an appointment date first.</p>
                      </div>
                    ) : loadingSlots ? (
                      <div className="neu-flat-sm p-3.5 rounded-xl text-center flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-link animate-spin" />
                        <p className="text-xs font-medium text-link">Loading available times...</p>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenTimeMenu(prev => !prev);
                            setOpenServiceMenu(false);
                          }}
                          className="w-full neu-flat-sm rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer outline-none select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Clock className="w-4 h-4 text-link shrink-0" />
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {watchedTime ? (
                                new Date(`2000-01-01T${watchedTime}:00`).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              ) : (
                                <span className="text-tertiary font-normal">Choose time slot...</span>
                              )}
                            </span>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-tertiary transition-transform duration-200 shrink-0 ${openTimeMenu ? 'rotate-180 text-link' : ''}`} />
                        </button>

                        {/* Custom Dropdown List for Times */}
                        <AnimatePresence>
                          {openTimeMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 top-full mt-1.5 bg-surface-shell rounded-2xl p-1.5 z-40 shadow-xl border border-white/60 dark:border-white/10 space-y-1 max-h-56 overflow-y-auto"
                            >
                              {availableSlots.length === 0 ? (
                                <div className="p-3 text-center text-xs text-tertiary">
                                  No available slots on this date.
                                </div>
                              ) : (
                                availableSlots.map(slot => {
                                  const isSelected = watchedTime === slot.time;
                                  const timeLabel = new Date(`2000-01-01T${slot.time}:00`).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  });

                                  return (
                                    <button
                                      key={slot.time}
                                      type="button"
                                      disabled={!slot.available}
                                      onClick={() => {
                                        setValue('time', slot.time, { shouldValidate: true });
                                        setOpenTimeMenu(false);
                                      }}
                                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors outline-none select-none ${
                                        !slot.available
                                          ? 'opacity-40 cursor-not-allowed text-tertiary line-through'
                                          : isSelected
                                            ? 'bg-primary text-white font-bold cursor-pointer'
                                            : 'text-slate-800 dark:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer'
                                      }`}
                                    >
                                      <span className="text-xs font-semibold">{timeLabel}</span>
                                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : slot.available ? 'text-success' : 'text-tertiary'}`}>
                                        {slot.available ? 'Available' : 'Booked'}
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {errors.time && (
                      <p className="text-xs font-medium text-danger ml-1">{errors.time.message}</p>
                    )}
                  </div>

                  {/* Visit Location */}
                  {/* Visit Location */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        4. Visit Location
                      </label>
                      <span className="text-xs font-semibold text-tertiary dark:text-tertiary">
                        {visitDestination?.source === 'booking' ? 'Custom visit location' : 'Saved address'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDestinationModalOpen(true)}
                      className="w-full neu-flat-sm rounded-xl p-3 flex items-center gap-3 text-left transition-all cursor-pointer outline-none select-none hover:border-primary/30"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-link dark:text-[#8CBDF0] shrink-0">
                        <Home className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {visitDestination?.address || patientHome?.address || 'Set visit location'}
                        </p>
                        <p className="text-xs text-tertiary dark:text-tertiary font-semibold truncate mt-0.5">
                          {visitDestination?.lat
                            ? `GPS Pin Confirmed (${visitDestination.lat.toFixed(5)}, ${visitDestination.lng.toFixed(5)}) · Tap to change`
                            : 'Tap to set address & gate directions'}
                        </p>
                      </div>
                      <span className="text-xs font-extrabold text-link dark:text-[#8CBDF0] shrink-0 px-2 py-1 rounded-lg bg-primary/5">
                        Change
                      </span>
                    </button>
                  </div>

                  {/* Notes / Message */}
                  <div className="space-y-1">
                    <label className="text-2xs font-extrabold uppercase tracking-wider text-tertiary ml-1">Message or Instructions (Optional)</label>
                    <div className="neu-inset p-2 rounded-xl flex items-start border border-slate-300/40 dark:border-white/5 transition-all">
                      <FileText className="w-3.5 h-3.5 text-tertiary ml-1 mt-1.5 shrink-0" />
                      <textarea
                        {...register('notes')}
                        placeholder="Specific symptoms or gate notes..."
                        rows={2}
                        className="w-full bg-transparent px-2 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none resize-none placeholder:text-tertiary"
                      />
                    </div>
                  </div>

                  {/* Consent */}
                  <div className={`neu-flat-sm p-2.5 rounded-xl flex items-start gap-2.5 transition-colors ${errors.consent ? 'border border-red-300 dark:border-red-900/50' : ''}`}>
                    <input
                      type="checkbox"
                      id="consent"
                      {...register('consent')}
                      className="w-4 h-4 rounded text-link mt-0.5 cursor-pointer shrink-0"
                    />
                    <label htmlFor="consent" className="text-xs sm:text-xs text-slate-600 dark:text-slate-300 leading-snug cursor-pointer select-none">
                      I consent to sharing my medical profile & address with <span className="font-bold text-slate-900 dark:text-white">{selectedProvider.full_name}</span> for this home care visit.
                    </label>
                  </div>
                  {errors.consent && (
                    <p className="text-xs font-semibold text-danger ml-1">{errors.consent.message}</p>
                  )}

                  <div className="pt-1 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedProvider(null)}
                      className="w-full neu-btn py-2.5 sm:py-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full neu-btn-primary py-2.5 sm:py-3 rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Review Booking</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Confirmation */}
              {bookingStep === 'confirm' && (() => {
                const vals = getValues();
                return (
                <div className="space-y-5">
                  <div className="neu-flat-sm p-5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200/60 dark:border-white/5">
                      <div className="neu-flat-sm w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-link font-bold overflow-hidden p-0.5 shrink-0 aspect-square">
                        {selectedProvider.avatar_url ? (
                          <img 
                            src={selectedProvider.avatar_url} 
                            alt={`${selectedProvider.full_name} profile`} 
                            className="w-full h-full object-cover rounded-[10px]" 
                          />
                        ) : (
                          <span className="text-xs sm:text-sm font-black">
                            {selectedProvider.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {selectedProvider.full_name}
                          </p>
                          {selectedProvider.professional_id_status === 'verified' && (
                            <span className="text-link shrink-0" title="Verified License">
                              <ShieldCheck className="w-3.5 h-3.5 text-link" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-tertiary dark:text-tertiary truncate mt-0.5">
                          {selectedProvider.specialty || selectedProvider.services?.[0] || 'Healthcare Practitioner'} • {selectedProvider.location || 'Muntinlupa City'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                      <div>
                        <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary">Service</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{vals.service}</p>
                      </div>
                      <div>
                        <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary">Date</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {new Date(vals.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary">Time</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {new Date(`2000-01-01T${vals.time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary">Visit Location</span>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 leading-snug">
                          {visitDestination?.address || 'Not confirmed'}
                        </p>
                        {visitDestination && (
                          <p className="text-xs font-semibold text-tertiary dark:text-tertiary tabular-nums mt-0.5">
                            {visitDestination.lat.toFixed(5)}, {visitDestination.lng.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>

                    {vals.notes && (
                      <div className="pt-3 border-t border-slate-200/60 dark:border-white/5">
                        <span className="text-2xs uppercase font-extrabold tracking-wider text-tertiary">Notes</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-0.5">“{vals.notes}”</p>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 flex items-center gap-2 text-xs font-semibold text-success dark:text-success-dark">
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      <span>Data sharing consent verified</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingStep('form')}
                      disabled={bookingLoading}
                      className="w-full py-3.5 neu-btn rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleBookingSubmit}
                      disabled={bookingLoading}
                      className="w-full py-3.5 neu-btn-primary rounded-2xl shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-bold cursor-pointer"
                    >
                      {bookingLoading ? 'Submitting...' : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                );
              })()}
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
                <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-white/40 sm:hidden relative z-10" aria-hidden="true" />
              </div>

              {/* Identity & Badges */}
              <div className="px-5 md:px-6 -mt-9 md:-mt-11 relative z-10 shrink-0">
                <div className="flex gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-[72px] h-[72px] md:w-20 md:h-20 rounded-2xl neu-flat flex items-center justify-center text-xl font-black text-link overflow-hidden p-0.5 ring-4 ring-white dark:ring-slate-900 shadow-md aspect-square">
                      {viewingProvider.avatar_url ? (
                        <img src={viewingProvider.avatar_url} alt={`${viewingProvider.full_name} photo`} className="w-full h-full object-cover rounded-[14px]" />
                      ) : (
                        viewingProvider.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
                      )}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isUserOnline(viewingProvider.id) ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1 pt-9 md:pt-10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="font-display text-lg md:text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {viewingProvider.full_name}
                      </h2>
                      {viewingProvider.professional_id_status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold text-success dark:text-success-dark bg-emerald-500/10">
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
                  <div className="w-full h-2 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
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
                      <div className="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
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
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-link">Muntinlupa Health Network</span>
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
        initial={visitDestination}
        homeAddress={patientHome?.address || ''}
        title="Confirm visit location"
        description="This pin is shared with your provider for this visit only. It does not change your saved home address."
        confirmLabel="Use this visit location"
        onConfirm={(dest) => {
          setVisitDestination({ ...dest, source: 'booking', version: 1 });
        }}
      />

    </DashboardLayout>
  );
};

export default PatientProviders;
