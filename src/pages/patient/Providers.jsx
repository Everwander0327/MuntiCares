import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Star, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

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
  const { user } = useAuth();

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        // Fetch from providers table, joined with users for name
        const { data, error } = await supabase
          .from('providers')
          .select('id, user_id, services, rating, location, price_per_service, is_approved, user:user_id(id, full_name)')
          .eq('is_approved', true);

        if (error) throw error;

        // Reshape data so each provider has the user info at top level
        const shaped = (data || []).map(p => ({
          id: p.user_id,
          full_name: p.user?.full_name || 'Unknown',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          price_per_service: p.price_per_service || 0,
        }));

        setProviders(shaped);

        // Build unique service list for the filter
        const allServices = new Set();
        (data || []).forEach(p => {
          (p.services || []).forEach(s => allServices.add(s));
        });
        setServiceOptions([
          { value: 'All', label: 'All Services' },
          ...[...allServices].map(s => ({ value: s, label: s })),
        ]);

        // Also fetch which providers the patient already requested
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

  const handleRequest = async (provider) => {
    if (!user) return;

    try {
      // Pick the first service from provider's list, or a default
      const service = (provider.services && provider.services.length > 0) ? provider.services[0] : 'General Care';
      const price = provider.price_per_service ? String(provider.price_per_service) : '0';

      const wantToShare = window.confirm(
        `Do you want to share your health data with ${provider.full_name}?\n\n` + 
        `If you click OK, they will be able to view your medical information to provide better care.`
      );

      const { error } = await supabase
        .from('requests')
        .insert([{
          patient_id: user.id,
          provider_id: provider.id,
          service: service,
          date: new Date().toISOString().split('T')[0],
          time: '09:00:00',
          status: 'Pending',
          price: price,
        }]);

      if (error) throw error;

      setRequested([...requested, provider.id]);

      // Create a consent_access entry
      await supabase
        .from('consent_access')
        .upsert([{
          patient_id: user.id,
          provider_id: provider.id,
          is_enabled: wantToShare,
        }], { onConflict: 'patient_id,provider_id' });

      alert('Request sent successfully!');
    } catch (err) {
      console.error('Error sending request:', err);
      alert('Failed to send request. Please try again.');
    }
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
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

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading providers...</div>
        ) : filteredProviders.length > 0 ? (
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
                    {p.full_name.split(' ').map(n => n[0]).join('')}
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
                    onClick={() => handleRequest(p)}
                    disabled={requested.includes(p.id)}
                    className={`w-full py-3 rounded-2xl text-sm font-bold shadow-lg transition-all ${requested.includes(p.id) ? 'bg-green-100 text-green-600 cursor-not-allowed shadow-none' : 'btn-primary shadow-primary/20'}`}
                    whileHover={!requested.includes(p.id) ? { scale: 1.02 } : {}}
                    whileTap={!requested.includes(p.id) ? { scale: 0.97 } : {}}
                  >
                    {requested.includes(p.id) ? 'Request Sent ✓' : 'Request Service'}
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
    </DashboardLayout>
  );
};

export default PatientProviders;
