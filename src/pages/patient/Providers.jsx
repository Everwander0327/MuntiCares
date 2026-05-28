import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Star, MapPin, X, Calendar, FileText, CheckCircle2, Shield, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import EmptyState from '../../components/EmptyState';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import { usePresence } from '../../contexts/PresenceContext';
import PaymentModal from '../../components/PaymentModal';

const WORKING_HOURS_START = 9;
const WORKING_HOURS_END = 17;
const SLOT_DURATION_MINUTES = 60;

const bookingSchema = z.object({
  service: z.string().min(1, 'Please select a service.'),
  date: z.string().min(1, 'Please select a date.'),
  time: z.string().min(1, 'Please select a time slot.'),
  notes: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must consent to proceed.' }) }),
});

const PatientProviders = () => {
  const { isUserOnline } = usePresence();
  const [searchTerm, setSearchTerm] = useState('');
  const [requested, setRequested] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = React.useRef(null);
  
  // Booking & Viewing Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [viewingProvider, setViewingProvider] = useState(null);
  const [providerReviews, setProviderReviews] = useState([]);
  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues, reset } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { service: '', date: '', time: '', notes: '', consent: false },
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState('form');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const watchedDate = watch('date');

  const [pendingPaymentRequest, setPendingPaymentRequest] = useState(null);
  const [sortBy, setSortBy] = useState('popular');
  const [activeCategory, setActiveCategory] = useState('All');


  const { user } = useAuth();
  const navigate = useNavigate();

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
          .select('id, user_id, services, rating, location, price_per_service, is_approved, bio, phone, professional_id_status, trust_score, user:user_id(id, full_name, email)')
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
          price_per_service: p.price_per_service || 0,
          professional_id_status: p.professional_id_status || 'none',
          trust_score: p.trust_score || 0,
        }));

        setProviders(shaped);

        if (user) {
          const { data: existingRequests } = await supabase
            .from('requests')
            .select('provider_id')
            .eq('patient_id', user.id)
            .eq('status', 'Pending');

          if (existingRequests) {
            setRequested(existingRequests.map(r => r.provider_id));
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
    if (!viewingProvider) return;
    setProviderReviews([]);
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

        const bookedTimes = (existingBookings || []).map(b => b.time);

        const slots = [];
        for (let hour = WORKING_HOURS_START; hour < WORKING_HOURS_END; hour++) {
          const time = `${String(hour).padStart(2, '0')}:00`;
          const isBooked = bookedTimes.some(bt => {
            const bh = parseInt(bt.split(':')[0]);
            const bm = parseInt(bt.split(':')[1]);
            const slotStart = hour;
            const slotEnd = hour + SLOT_DURATION_MINUTES / 60;
            const bookingTime = bh + bm / 60;
            return bookingTime >= slotStart && bookingTime < slotEnd;
          });
          slots.push({ time, available: !isBooked });
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

  // Derived categories from all providers
  const allCategories = useMemo(() => ['All', ...new Set(providers.flatMap(p => p.services || []))], [providers]);
  const categoryCounts = useMemo(() => {
    const counts = {};
    allCategories.forEach(cat => {
      if (cat === 'All') counts[cat] = providers.length;
      else counts[cat] = providers.filter(p => (p.services || []).includes(cat)).length;
    });
    return counts;
  }, [providers, allCategories]);
  const categoryIcons = {
    'All': '🏥', 'General Care': '🩺', 'Physical Therapy': '🦵',
    'Nursing': '👨‍⚕️', 'Senior Care': '👴', 'Medication': '💊',
    'Checkup': '📋', 'Vital Signs': '❤️', 'Wound Care': '🩹',
    'Therapy': '🧠', 'Home Care': '🏠',
  };

  const sortedProviders = useMemo(() => {
    const filtered = providers.filter(p => {
      const matchesSearch = !searchTerm || p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.services || []).some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || (p.services || []).includes(activeCategory);
      return matchesSearch && matchesCategory;
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular': return (b.rating || 0) - (a.rating || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'price_low': return (a.price_per_service || 0) - (b.price_per_service || 0);
        case 'price_high': return (b.price_per_service || 0) - (a.price_per_service || 0);
        case 'trust': return (b.trust_score || 0) - (a.trust_score || 0);
        default: return 0;
      }
    });
  }, [providers, searchTerm, activeCategory, sortBy]);

  const openBookingModal = (provider) => {
    setSelectedProvider(provider);
    setBookingStep('form');
    setAvailableSlots([]);
    reset({
      service: provider.services?.[0] || 'General Care',
      date: new Date().toISOString().split('T')[0],
      time: '',
      notes: '',
      consent: false,
    });
  };

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

      const { data: conflict } = await supabase
        .from('requests')
        .select('id')
        .eq('provider_id', selectedProvider.id)
        .eq('date', values.date)
        .in('status', ['Accepted', 'On The Way', 'Arrived'])
        .gte('time', values.time + ':00')
        .lt('time', `${String(parseInt(values.time.split(':')[0]) + 1).padStart(2, '0')}:00`);

      if (conflict && conflict.length > 0) {
        toast.error('This time slot has just been taken. Please choose another.');
        setBookingLoading(false);
        setBookingStep('form');
        return;
      }

      // 1. Capture provider info before it gets cleared
      const providerId = selectedProvider.id;
      const providerName = selectedProvider.full_name;
      const amount = selectedProvider.price_per_service || 0;

      // 2. Send the request
      const { data: newRequest, error: reqError } = await supabase
        .from('requests')
        .insert([{
          patient_id: user.id,
          provider_id: providerId,
          service: values.service,
          date: values.date,
          time: values.time + ':00',
          status: 'Pending',
          price: String(amount),
          notes: values.notes
        }])
        .select();

      if (reqError) throw reqError;

      const createdRequest = newRequest[0];

      // 3. Enable Data Sharing (Consent)
      await supabase
        .from('consent_access')
        .upsert([{
          patient_id: user.id,
          provider_id: providerId,
          is_enabled: true,
        }], { onConflict: 'patient_id,provider_id' });

      setRequested([...requested, providerId]);
      setSelectedProvider(null);
      toast.success('Booking confirmed! Complete payment to secure your appointment.');
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });

      // 4. Open payment modal
      setPendingPaymentRequest({
        id: createdRequest.id,
        providerId,
        providerName,
        patientId: user.id,
        amount,
        service: values.service,
        date: values.date,
        time: values.time,
      });
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
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'trust', label: 'Trust Score' },
  ];

  return (
    <DashboardLayout role="patient">
      <div className="space-y-5 relative pb-6">

        {/* Page Header */}
        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">
          Find a Provider
        </h1>

        {/* Category Chips */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  activeCategory === cat
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary'
                }`}
              >
                <span className="text-sm">{categoryIcons[cat] || '🏥'}</span>
                <span>{cat}</span>
                {categoryCounts[cat] > 0 && (
                  <span className={`text-2xs font-bold ml-0.5 ${
                    activeCategory === cat ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {categoryCounts[cat]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={searchRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search providers or services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl py-3.5 pl-12 pr-4 text-base shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all outline-none"
          />

          {/* Search History Dropdown */}
          {showHistory && !searchTerm && searchHistory.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-xl z-40 p-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Recent Searches</span>
                <button
                  onClick={() => {
                    setSearchHistory([]);
                    if (user) localStorage.removeItem(`search_history_${user.id}`);
                  }}
                  className="text-2xs font-bold text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchHistory.map((term, idx) => (
                  <button
                    key={idx}
                    onMouseDown={() => {
                      setSearchTerm(term);
                      setShowHistory(false);
                    }}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
          <div className="shrink-0">
            <CustomSelect
              className="min-w-0 !py-2 !px-2.5 !text-nano !rounded-xl"
              value={sortBy}
              onChange={setSortBy}
              options={sortOptions}
            />
          </div>
        </div>



        {/* Provider Cards Grid */}
        {sortedProviders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sortedProviders.map((p, idx) => (
              <div 
                key={p.id} 
                className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-lg hover:border-primary/20 dark:hover:border-primary/40 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Avatar + Name + Rating */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-base font-bold text-primary shadow-inner">
                      {p.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 transition-colors ${isUserOnline(p.id) ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base truncate">{p.full_name}</h3>
                    <div className="flex items-center gap-1 text-yellow-500 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(p.rating || 0) ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} />
                      ))}
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-medium ml-1">{(p.rating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Trust Score Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Trust</span>
                    <span className="text-2xs font-bold text-slate-600 dark:text-slate-300">{p.trust_score}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        p.trust_score >= 70 ? 'bg-green-500' : p.trust_score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${p.trust_score}%` }}
                    />
                  </div>
                  {p.professional_id_status === 'verified' && (
                    <span className="inline-flex items-center gap-0.5 text-2xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>

                {/* Service Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(p.services || []).slice(0, 3).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-nano font-semibold border border-slate-100 dark:border-slate-700">
                      {i === 0 ? (categoryIcons[s] || '') + ' ' : ''}{s}
                    </span>
                  ))}
                  {(p.services || []).length > 3 && (
                    <span className="px-2.5 py-1 text-slate-400 dark:text-slate-500 rounded-lg text-nano font-semibold">
                      +{p.services.length - 3}
                    </span>
                  )}
                  {(!p.services || p.services.length === 0) && (
                    <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 rounded-lg text-nano font-semibold border border-slate-100 dark:border-slate-700">
                      No services listed
                    </span>
                  )}
                </div>

                {/* Location + Price */}
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mb-3">
                  <span className="flex items-center gap-1 min-w-0 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.location || 'Muntinlupa City'}</span>
                  </span>
                  {p.price_per_service > 0 && (
                    <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0 ml-2">₱{Number(p.price_per_service).toLocaleString()}/svc</span>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => setViewingProvider(p)}
                  className={`w-full py-3.5 rounded-xl md:rounded-2xl text-sm font-bold transition-all active:scale-[0.97] hover:scale-[1.02] flex items-center justify-center gap-1.5 ${
                    requested.includes(p.id)
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 border border-green-100 dark:border-green-900/50 shadow-none'
                      : 'btn-primary shadow-primary/20'
                  }`}
                >
                  {requested.includes(p.id) ? 'Pending Request ✓' : 'View Profile & Book'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700">
            <EmptyState icon="search" title="No providers found" message={searchTerm || activeCategory !== 'All' ? 'Try adjusting your search, filters, or category.' : 'No providers are available in your area yet.'} />
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <motion.div 
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (bookingStep === 'form') setSelectedProvider(null);
            }}
          >
            <motion.div 
              className="bg-white dark:bg-slate-800 rounded-t-3xl md:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-4 md:p-8 relative max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => {
                  if (bookingStep === 'confirm') {
                    setBookingStep('form');
                  } else {
                    setSelectedProvider(null);
                  }
                }}
                className="absolute top-3 right-3 md:top-6 md:right-6 p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <div className="mb-4 pr-10 md:pr-12">
                <h2 className="text-base sm:text-lg md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {bookingStep === 'form' ? 'Book Appointment' : 'Confirm Booking'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">with <span className="font-bold text-primary">{selectedProvider.full_name}</span></p>
              </div>

              {/* Step Progress */}
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <div className={`flex items-center gap-1.5 ${bookingStep === 'form' ? 'text-primary' : 'text-green-600 dark:text-green-300'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold ${
                    bookingStep === 'confirm' ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300' : 'bg-primary text-white'
                  }`}>
                    {bookingStep === 'confirm' ? '✓' : '1'}
                  </div>
                  <span className="text-2xs font-semibold">Details</span>
                </div>
                <div className={`flex-1 h-px rounded-full ${bookingStep === 'confirm' ? 'bg-green-200' : 'bg-slate-200 dark:bg-slate-600'}`} />
                <div className={`flex items-center gap-1.5 ${bookingStep === 'confirm' ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold ${
                    bookingStep === 'confirm' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}>
                    2
                  </div>
                  <span className="text-2xs font-semibold">Confirm</span>
                </div>
              </div>

              {/* Step 1: Booking Form */}
              {bookingStep === 'form' && (
                <form onSubmit={handleSubmit(handleReviewBooking)} className="space-y-3 sm:space-y-4 md:space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">Service</label>
                    <select
                      {...register('service')}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl md:rounded-2xl py-2.5 md:py-3 px-3 md:px-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none ${errors.service ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                    >
                      {selectedProvider.services?.length > 0 ? (
                        selectedProvider.services.map(s => (
                          <option key={s} value={s}>{s} (₱{selectedProvider.price_per_service})</option>
                        ))
                      ) : (
                        <option value="General Care">General Care</option>
                      )}
                    </select>
                    {errors.service && (
                      <p className="text-nano text-red-500 dark:text-red-300 mt-0.5 ml-1">{errors.service.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        {...register('date', { onChange: () => setValue('time', '') })}
                        className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl md:rounded-2xl py-2.5 md:py-3 pl-10 pr-3 md:pl-12 md:pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${errors.date ? 'border-red-300' : 'border-slate-200 dark:border-slate-600'}`}
                      />
                    </div>
                    {errors.date && (
                      <p className="text-nano text-red-500 dark:text-red-300 mt-0.5 ml-1">{errors.date.message}</p>
                    )}
                  </div>

                  {/* Time Slot Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">Available Time Slots</label>
                    {!watchedDate ? (
                      <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 ml-1">Select a date to see available slots.</p>
                    ) : loadingSlots ? (
                      <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 ml-1">Checking availability...</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 ml-1">No available slots for this date.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {availableSlots.map(slot => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={!slot.available}
                            onClick={() => { setValue('time', slot.time, { shouldValidate: true }); }}
                            className={`py-1.5 md:py-2.5 px-2 md:px-3 rounded-lg md:rounded-xl text-nano md:text-sm font-bold transition-all border ${
                              watch('time') === slot.time
                                ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                                : slot.available
                                  ? 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-primary hover:text-primary'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700 cursor-not-allowed line-through'
                            }`}
                          >
                            {new Date(`2000-01-01T${slot.time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.time && (
                      <p className="text-nano text-red-500 dark:text-red-300 mt-0.5 ml-1">{errors.time.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 ml-1">Message (Optional)</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <textarea
                        {...register('notes')}
                        placeholder="Any specific instructions, conditions, or details?"
                        rows={2}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl md:rounded-2xl py-2.5 md:py-3 pl-10 pr-3 md:pl-12 md:pr-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className={`bg-blue-50/50 border p-3 md:p-4 rounded-xl md:rounded-2xl flex items-start gap-2.5 ${errors.consent ? 'border-red-300' : 'border-blue-100 dark:border-blue-900/50'}`}>
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        id="consent"
                        {...register('consent')}
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </div>
                    <label htmlFor="consent" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-tight cursor-pointer">
                      I consent to sharing my medical profile and home address with <span className="font-bold">{selectedProvider.full_name}</span> for the purpose of this home care service.
                    </label>
                    {errors.consent && (
                      <p className="text-nano text-red-500 dark:text-red-300 mt-0.5 ml-1">{errors.consent.message}</p>
                    )}
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      className="w-full btn-primary py-3 md:py-4 rounded-xl md:rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 text-sm md:text-base"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Review Booking
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Confirmation */}
              {bookingStep === 'confirm' && (() => {
                const vals = getValues();
                return (
                <div className="space-y-3 sm:space-y-4 md:space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl md:rounded-2xl p-3 md:p-5 space-y-3 md:space-y-4 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-600">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary font-bold text-sm md:text-base">
                          {selectedProvider.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 transition-colors ${isUserOnline(selectedProvider.id) ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold text-sm md:text-base text-slate-900 dark:text-slate-100">{selectedProvider.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{selectedProvider.location || 'Muntinlupa City'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                      <div>
                        <p className="text-3xs md:text-2xs uppercase font-bold text-slate-400 dark:text-slate-500">Service</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs md:text-sm">{vals.service}</p>
                      </div>
                      <div>
                        <p className="text-3xs md:text-2xs uppercase font-bold text-slate-400 dark:text-slate-500">Fee</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs md:text-sm">₱{Number(selectedProvider.price_per_service || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-3xs md:text-2xs uppercase font-bold text-slate-400 dark:text-slate-500">Date</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs md:text-sm">
                          {new Date(vals.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-3xs md:text-2xs uppercase font-bold text-slate-400 dark:text-slate-500">Time</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-xs md:text-sm">
                          {new Date(`2000-01-01T${vals.time}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {vals.notes && (
                      <div className="pt-2.5 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-3xs md:text-2xs uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5">Message</p>
                        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 italic">{'\u201C'}{vals.notes}{'\u201D'}</p>
                      </div>
                    )}

                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-600 flex items-center gap-1.5 text-xs md:text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                      <span className="text-green-700 dark:text-green-200 font-semibold">Data sharing consent provided</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingStep('form')}
                      disabled={bookingLoading}
                      className="w-full py-3 md:py-4 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl md:rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-xs md:text-sm disabled:opacity-50"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleBookingSubmit}
                      disabled={bookingLoading}
                      className="w-full btn-primary py-3 md:py-4 rounded-xl md:rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                    >
                      {bookingLoading ? 'Submitting...' : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 md:w-5 md:h-5" />
                          Confirm Booking
                        </>
                      )}
                    </button>
                  </div>
                </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Provider Details Sheet */}
      <Sheet open={!!viewingProvider} onOpenChange={(open) => { if (!open) setViewingProvider(null); }}>
        <SheetContent 
          side="bottom"
          className="sm:max-w-lg sm:mx-auto sm:bottom-4 sm:rounded-[2.5rem] max-h-[85vh] overflow-y-auto p-0 [&>button:last-child]:hidden"
        >
          <SheetTitle className="sr-only">{viewingProvider?.full_name || 'Provider Profile'}</SheetTitle>
          <SheetDescription className="sr-only">View provider details, trust score, and reviews</SheetDescription>
          {viewingProvider && (
          <div className="p-4 md:p-6">
            {/* Mini Provider Card */}
            <div className="flex items-start gap-3 mb-4 pr-8">
              <div className="relative shrink-0">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-lg md:text-2xl font-bold text-primary shadow-inner">
                  {viewingProvider.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-white dark:border-slate-800 transition-colors ${isUserOnline(viewingProvider.id) ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm md:text-xl font-bold text-slate-900 dark:text-slate-100">{viewingProvider.full_name}</h2>
                <div className="flex items-center gap-1 text-yellow-500 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3 h-3 md:w-4 md:h-4 ${i < Math.floor(viewingProvider.rating || 0) ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} />
                  ))}
                  <span className="text-slate-700 dark:text-slate-200 text-xs md:text-sm font-bold ml-0.5">{(viewingProvider.rating || 0).toFixed(1)}</span>
                </div>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> {viewingProvider.location || 'Muntinlupa City'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm md:text-lg font-bold text-primary">₱{Number(viewingProvider.price_per_service).toLocaleString()}</p>
                <p className="text-2xs text-slate-400 dark:text-slate-500">per service</p>
              </div>
            </div>

            {/* Trust Score Breakdown */}
            <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl md:rounded-2xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-2xs md:text-xs uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Trust Score
                </h4>
                <span className={`text-xs md:text-sm font-bold ${
                  viewingProvider.trust_score >= 70 ? 'text-green-600 dark:text-green-400' : viewingProvider.trust_score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
                }`}>
                  {viewingProvider.trust_score}/100
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    viewingProvider.trust_score >= 70 ? 'bg-green-500' : viewingProvider.trust_score >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                  }`}
                  style={{ width: `${viewingProvider.trust_score}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Verified ID', earned: viewingProvider.professional_id_status === 'verified', max: 30, icon: ShieldCheck },
                  { label: 'Positive Reviews', earned: viewingProvider.rating >= 4, max: 25, icon: Star },
                  { label: 'Active Provider', earned: true, max: 20, icon: CheckCircle2 },
                  { label: 'Completed Bookings', earned: viewingProvider.trust_score >= 30, max: 15, icon: FileText },
                  { label: 'Response Rate', earned: viewingProvider.trust_score >= 50, max: 10, icon: Shield },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center justify-between text-nano md:text-xs">
                      <span className={`flex items-center gap-1.5 ${item.earned ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                        <Icon className={`w-3 h-3 ${item.earned ? 'text-green-500' : 'text-slate-300 dark:text-slate-600'}`} />
                        {item.label}
                      </span>
                      <span className={`font-bold ${item.earned ? 'text-green-600 dark:text-green-400' : 'text-slate-300 dark:text-slate-600'}`}>
                        {item.earned ? `+${item.max}` : '0'}/{item.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bio */}
            <div className="mb-4">
              <h4 className="text-2xs md:text-xs uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">About</h4>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl">
                {viewingProvider.bio}
              </p>
            </div>

            {/* Services */}
            <div className="mb-4">
              <h4 className="text-2xs md:text-xs uppercase font-bold text-slate-400 dark:text-slate-500 mb-1.5">Services</h4>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {viewingProvider.services.map((s, i) => (
                  <span key={i} className="px-2 md:px-3 py-1 md:py-1.5 bg-blue-50 dark:bg-blue-900/30 text-primary border border-blue-100 dark:border-blue-900/50 rounded-lg md:rounded-xl text-nano md:text-xs font-bold">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="mb-4">
              <h4 className="text-2xs md:text-xs uppercase font-bold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                Reviews
              </h4>
              
              <div className="max-h-[120px] md:max-h-[160px] overflow-y-auto space-y-2 pr-1 md:pr-2 scrollbar-thin">
                {providerReviews.length > 0 ? (
                  providerReviews.map((rev, i) => (
                    <div key={i} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100/50 rounded-xl md:rounded-2xl space-y-0.5">
                      <div className="flex justify-between items-center">
                        <p className="text-nano md:text-xs font-bold text-slate-700 dark:text-slate-200">{rev.patient?.full_name || 'Anonymous'}</p>
                        <div className="flex gap-0.5 text-yellow-500">
                          {[...Array(5)].map((_, idx) => (
                            <Star key={idx} className={`w-2.5 h-2.5 md:w-3 md:h-3 ${idx < rev.rating ? 'fill-current' : 'text-slate-200 dark:text-slate-600'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-nano md:text-xs text-slate-600 dark:text-slate-300 italic">{'\u201C'}{rev.review_text || 'Excellent consultation!'}{'\u201D'}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">No written reviews yet.</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 pt-3 md:pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setViewingProvider(null)}
                className="w-full py-3.5 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl md:rounded-2xl font-bold text-slate-600 dark:text-slate-300 transition-all text-xs md:text-sm"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setViewingProvider(null);
                  openBookingModal(viewingProvider);
                }}
                disabled={requested.includes(viewingProvider.id)}
                className={`w-full py-3.5 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                  requested.includes(viewingProvider.id) 
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 cursor-not-allowed shadow-none' 
                    : 'btn-primary shadow-primary/20'
                }`}
              >
                {requested.includes(viewingProvider.id) ? 'Pending ✓' : 'Book Appointment'}
              </button>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={!!pendingPaymentRequest}
        onClose={() => {
          setPendingPaymentRequest(null);
          navigate('/patient/dashboard');
        }}
        request={pendingPaymentRequest}
        onPaymentComplete={() => {
          setPendingPaymentRequest(null);
          navigate('/patient/dashboard');
        }}
      />
    </DashboardLayout>
  );
};

export default PatientProviders;
