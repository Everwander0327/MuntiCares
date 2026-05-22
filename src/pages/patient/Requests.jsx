import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, MapPin, MessageSquare, Star, XCircle, FileUp } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import ReviewModal from '../../components/ReviewModal';
import CancelRescheduleModal from '../../components/CancelRescheduleModal';
import PreSessionUploadModal from '../../components/PreSessionUploadModal';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const RequestCard = ({ id, providerId, patientId, provider, service, date, status, price, location, onRateProvider, isRated, onManageRequest, onPreSession, presessionSubmitted }) => (
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
      
      <div className="flex flex-wrap items-center gap-3">
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
        
        {/* Chat Shortcut - active visits only */}
        {['Accepted', 'On The Way', 'Arrived'].includes(status) && (
          <Link 
            to={`/patient/messages?provider=${providerId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </Link>
        )}

        {/* Pre-Session Upload - only for Accepted visits */}
        {['Accepted', 'Pending'].includes(status) && (
          <button
            onClick={() => !presessionSubmitted && onPreSession({ id, providerId, patientId, providerName: provider })}
            disabled={presessionSubmitted}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              presessionSubmitted
                ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:scale-105 active:scale-95'
            }`}
          >
            <FileUp className={`w-3.5 h-3.5 ${presessionSubmitted ? 'text-green-500' : 'text-indigo-500'}`} />
            {presessionSubmitted ? 'Info Sent' : 'Pre-Session Info'}
          </button>
        )}

        {/* Cancel/Reschedule - only for Pending or Accepted */}
        {['Pending', 'Accepted'].includes(status) && (
          <button
            onClick={() => onManageRequest({ id, providerId, patientId, providerName: provider, date })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
          >
            <XCircle className="w-3.5 h-3.5" />
            Manage
          </button>
        )}

        {/* Rate & Review - completed only */}
        {status === 'Completed' && (
          <button 
            onClick={() => !isRated && onRateProvider({ id, providerId, patientId, providerName: provider })}
            disabled={isRated}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isRated 
                ? 'bg-green-50 text-green-700 border-green-200 cursor-default' 
                : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200 shadow-sm shadow-yellow-100 hover:scale-105 active:scale-95'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isRated ? 'fill-current text-green-500' : 'fill-current text-yellow-500 animate-pulse'}`} />
            {isRated ? 'Reviewed' : 'Rate & Review'}
          </button>
        )}

        {/* Status Badge */}
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${
          ['Accepted', 'On The Way', 'Arrived'].includes(status) ? 'bg-green-100 text-green-700' :
          status === 'Completed' ? 'bg-green-100 text-green-700' :
          status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
          status === 'Cancelled' ? 'bg-slate-100 text-slate-500' :
          'bg-red-100 text-red-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full status-dot ${
            ['Accepted', 'On The Way', 'Arrived'].includes(status) ? 'bg-green-500' :
            status === 'Completed' ? 'bg-green-500' :
            status === 'Pending' ? 'bg-yellow-500' :
            status === 'Cancelled' ? 'bg-slate-400' :
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
  const [selectedReviewReq, setSelectedReviewReq] = useState(null);
  const [selectedManageReq, setSelectedManageReq] = useState(null);
  const [selectedPreSessionReq, setSelectedPreSessionReq] = useState(null);
  const [ratedRequests, setRatedRequests] = useState({});
  const [presessionSubmitted, setPresessionSubmitted] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    const rated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
    setRatedRequests(rated);
    const presession = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
    setPresessionSubmitted(presession);
  }, []);

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
        id: req.id,
        providerId: req.provider_id,
        provider: req.provider?.full_name || 'Unknown',
        service: req.service,
        date: new Date(req.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: req.status,
        price: req.price || '0',
        location: providerLocations[req.provider_id] || 'Muntinlupa',
        originalNotes: req.notes || '',
      }));

      setRequests(formatted);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let channel;

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
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' },
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
              filteredRequests.map((req) => (
                <RequestCard 
                  key={req.id} 
                  id={req.id}
                  providerId={req.providerId}
                  patientId={user.id}
                  provider={req.provider}
                  service={req.service}
                  date={req.date}
                  status={req.status}
                  price={req.price}
                  location={req.location}
                  isRated={!!ratedRequests[req.id]}
                  presessionSubmitted={!!presessionSubmitted[req.id]}
                  onRateProvider={setSelectedReviewReq}
                  onManageRequest={setSelectedManageReq}
                  onPreSession={setSelectedPreSessionReq}
                />
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

      {/* Review Modal */}
      <ReviewModal 
        isOpen={!!selectedReviewReq} 
        onClose={() => setSelectedReviewReq(null)}
        request={selectedReviewReq}
        onReviewSubmitted={(requestId) => {
          setRatedRequests(prev => ({ ...prev, [requestId]: true }));
        }}
      />

      {/* Cancel / Reschedule Modal */}
      <CancelRescheduleModal
        isOpen={!!selectedManageReq}
        onClose={() => setSelectedManageReq(null)}
        request={selectedManageReq}
        onActionComplete={() => fetchRequests()}
      />

      {/* Pre-Session Upload Modal */}
      <PreSessionUploadModal
        isOpen={!!selectedPreSessionReq}
        onClose={() => {
          // Refresh presession state after close
          const presession = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
          setPresessionSubmitted(presession);
          setSelectedPreSessionReq(null);
        }}
        request={selectedPreSessionReq}
      />
    </DashboardLayout>
  );
};

export default PatientRequests;
