import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Star, MapPin, X, Calendar, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const PatientProviders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [requested, setRequested] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serviceOptions, setServiceOptions] = useState([{ value: 'All', label: 'All Services' }]);
  
  // Booking Modal State
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    service: '',
    date: '',
    time: '',
    notes: '',
    consent: false
  });
  const [bookingLoading, setBookingLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('id, user_id, services, rating, location, price_per_service, is_approved, user:user_id(id, full_name)')
          .eq('is_approved', true);

        if (error) throw error;

        const shaped = (data || []).map(p => ({
          id: p.user_id,
          full_name: p.user?.full_name || 'Unknown',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          price_per_service: p.price_per_service || 0,
        }));

        setProviders(shaped);

        const allServices = new Set();
        (data || []).forEach(p => {
          (p.services || []).forEach(s => allServices.add(s));
        });
        setServiceOptions([
          { value: 'All', label: 'All Services' },
          ...[...allServices].map(s => ({ value: s, label: s })),
        ]);

        if (user) {
          const { data: existingRequests } = await supabase
            .from('requests')
            .select('provider_id')
            .eq('patient_id', user.id);

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

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.services || []).some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filter === 'All' || (p.services || []).includes(filter);
    return matchesSearch && matchesFilter;
  });

  const openBookingModal = (provider) => {
    setSelectedProvider(provider);
    setBookingForm({
      service: provider.services?.[0] || 'General Care',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      notes: '',
      consent: false
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user || !selectedProvider) return;

    if (!bookingForm.consent) {
      alert("You must consent to sharing your profile and address to proceed.");
      return;
    }

    setBookingLoading(true);

    try {
      // 1. Send the request
      const { error: reqError } = await supabase
        .from('requests')
        .insert([{
          patient_id: user.id,
          provider_id: selectedProvider.id,
          service: bookingForm.service,
          date: bookingForm.date,
          time: bookingForm.time + ':00', // Time column expects HH:MM:SS
          status: 'Pending',
          price: String(selectedProvider.price_per_service || 0),
          notes: bookingForm.notes
        }]);

      if (reqError) throw reqError;

      // 2. Enable Data Sharing (Consent)
      await supabase
        .from('consent_access')
        .upsert([{
          patient_id: user.id,
          provider_id: selectedProvider.id,
          is_enabled: true,
        }], { onConflict: 'patient_id,provider_id' });

      setRequested([...requested, selectedProvider.id]);
      setSelectedProvider(null);
      alert('Booking request sent successfully!');
    } catch (err) {
      console.error('Error sending request:', err);
      alert('Failed to send booking request. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <DashboardLayout role="patient"><SkeletonPage /></DashboardLayout>;

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8 relative">
        <motion.div 
          className="flex flex-col md:flex-row gap-4 items-center justify-between"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search for providers or services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all outline-none"
            />
          </div>
          <CustomSelect 
            value={filter}
            onChange={setFilter}
            options={serviceOptions}
          />
        </motion.div>

        {filteredProviders.length > 0 ? (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredProviders.map((p) => (
              <motion.div 
                key={p.id} 
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
                variants={staggerItem}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-xl font-bold text-primary shadow-inner">
                    {p.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{p.full_name}</h3>
                    <div className="flex items-center gap-1 text-yellow-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.floor(p.rating || 0) ? 'fill-current' : 'text-slate-300'}`} />
                      ))}
                      <span className="text-slate-400 text-sm ml-1 font-medium">{(p.rating || 0).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(p.services || []).map((s, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold border border-slate-100">
                        {s}
                      </span>
                    ))}
                    {(!p.services || p.services.length === 0) && (
                      <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-xs font-semibold border border-slate-100">
                        No services listed
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{p.location || 'Muntinlupa City'}</span>
                  </div>

                  {p.price_per_service > 0 && (
                    <div className="text-sm font-bold text-slate-700">
                      ₱{Number(p.price_per_service).toLocaleString()} per service
                    </div>
                  )}

                  <motion.button 
                    onClick={() => openBookingModal(p)}
                    disabled={requested.includes(p.id)}
                    className={`w-full py-3 rounded-2xl text-sm font-bold shadow-lg transition-all ${requested.includes(p.id) ? 'bg-green-100 text-green-600 cursor-not-allowed shadow-none' : 'btn-primary shadow-primary/20'}`}
                    whileHover={!requested.includes(p.id) ? { scale: 1.02 } : {}}
                    whileTap={!requested.includes(p.id) ? { scale: 0.97 } : {}}
                  >
                    {requested.includes(p.id) ? 'Request Pending ✓' : 'Book Appointment'}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            className="text-center py-20 bg-white rounded-[2rem] border border-slate-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-slate-500 text-lg">No providers found matching your search.</p>
          </motion.div>
        )}
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProvider(null)}
          >
            <motion.div 
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full p-8 relative my-8"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedProvider(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="mb-8 pr-12">
                <h2 className="text-2xl font-bold text-slate-900">Book Appointment</h2>
                <p className="text-slate-500 mt-1">with <span className="font-bold text-primary">{selectedProvider.full_name}</span></p>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-6">
                {/* Service Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Select Service</label>
                  <select 
                    required
                    value={bookingForm.service}
                    onChange={e => setBookingForm({...bookingForm, service: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none"
                  >
                    {selectedProvider.services?.length > 0 ? (
                      selectedProvider.services.map(s => (
                        <option key={s} value={s}>{s} (₱{selectedProvider.price_per_service})</option>
                      ))
                    ) : (
                      <option value="General Care">General Care</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="date" 
                        required
                        min={new Date().toISOString().split('T')[0]}
                        value={bookingForm.date}
                        onChange={e => setBookingForm({...bookingForm, date: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Proposed Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="time" 
                        required
                        value={bookingForm.time}
                        onChange={e => setBookingForm({...bookingForm, time: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Message for Provider (Optional)</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                    <textarea 
                      value={bookingForm.notes}
                      onChange={e => setBookingForm({...bookingForm, notes: e.target.value})}
                      placeholder="Any specific instructions, conditions, or details?"
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                  <div className="pt-0.5">
                    <input 
                      type="checkbox" 
                      id="consent"
                      required
                      checked={bookingForm.consent}
                      onChange={e => setBookingForm({...bookingForm, consent: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <label htmlFor="consent" className="text-sm text-slate-600 leading-tight cursor-pointer">
                    I consent to sharing my medical profile and home address with <span className="font-bold">{selectedProvider.full_name}</span> for the purpose of this home care service.
                  </label>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={bookingLoading || !bookingForm.consent}
                    className="w-full btn-primary py-4 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bookingLoading ? 'Submitting...' : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Send Booking Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default PatientProviders;
