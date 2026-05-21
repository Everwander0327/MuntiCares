import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const RequestCard = ({ provider, service, date, status, price, location }) => (
  <motion.div 
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
    variants={staggerItem}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
  >
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold text-lg">
          {provider.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{provider}</h3>
          <p className="text-slate-500 text-sm">{service}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Clock className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{location || 'Muntinlupa'}</span>
        </div>
        <div className="font-bold text-slate-900">
          ₱{price}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${
          status === 'Accepted' ? 'bg-green-100 text-green-700' :
          status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full status-dot ${
            status === 'Accepted' ? 'bg-green-500' :
            status === 'Pending' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          {status}
        </span>
      </div>
    </div>
  </motion.div>
);

const PatientRequests = () => {
  const [filter, setFilter] = useState('All');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    let channel;

    const fetchRequests = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('requests')
          .select('*, provider:provider_id(full_name)')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch provider locations from providers table
        const providerIds = (data || []).map(r => r.provider_id);
        let providerLocations = {};

        if (providerIds.length > 0) {
          const { data: provData } = await supabase
            .from('providers')
            .select('user_id, location')
            .in('user_id', providerIds);
          
          (provData || []).forEach(p => {
            providerLocations[p.user_id] = p.location;
          });
        }

        const formatted = (data || []).map(req => ({
          provider: req.provider?.full_name || 'Unknown',
          service: req.service,
          date: new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: req.status,
          price: req.price || '0',
          location: providerLocations[req.provider_id] || 'Muntinlupa',
        }));

        setRequests(formatted);
      } catch (err) {
        console.error('Error fetching requests:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

    if (user) {
      // Set up real-time subscription
      channel = supabase
        .channel('patient-requests-list-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
            filter: `patient_id=eq.${user.id}`
          },
          () => {
            fetchRequests();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  const filteredRequests = requests.filter(r => filter === 'All' || r.status === filter);

  return (
    <DashboardLayout role="patient">
      <div className="space-y-8">
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
            <p className="text-slate-500">Track and manage your service requests</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <CustomSelect 
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'All', label: 'All Status' },
                { value: 'Accepted', label: 'Accepted' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading requests...</div>
        ) : (
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req, i) => (
                <RequestCard key={i} {...req} />
              ))
            ) : (
              <motion.div 
                className="p-10 text-center text-slate-500 bg-white rounded-3xl border border-slate-100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {requests.length === 0 ? 'No requests yet. Find a provider to get started!' : 'No requests found for this filter.'}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientRequests;
