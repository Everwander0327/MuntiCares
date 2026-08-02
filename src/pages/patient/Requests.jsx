import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Clock, MapPin, MessageSquare, Star, XCircle, FileUp } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { useAuth } from '../../contexts/AuthContext';
import usePatientRequests from '../../hooks/usePatientRequests';
import { supabase } from '../../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import ReviewModal from '../../components/ReviewModal';
import CancelRescheduleModal from '../../components/CancelRescheduleModal';
import PreSessionUploadModal from '../../components/PreSessionUploadModal';
import EmptyState from '../../components/EmptyState';

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
};
const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const RequestCard = ({ id, providerId, patientId, provider, service, date, time, status, price, location, onRateProvider, isRated, onManageRequest, onPreSession, presessionSubmitted }) => (
  <motion.div 
    className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 hover:shadow-md transition-all"
    variants={staggerItem}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
  >
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary font-bold text-lg">
          {provider.split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">{provider}</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{service}</p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
          <Clock className="w-4 h-4" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
          <MapPin className="w-4 h-4" />
          <span>{location || 'Muntinlupa'}</span>
        </div>
        <div className="font-bold text-slate-900 dark:text-slate-100">
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
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-green-200 dark:border-green-900/50 cursor-default'
                : 'bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-900/50 hover:scale-105 active:scale-95'
            }`}
          >
            <FileUp className={`w-3.5 h-3.5 ${presessionSubmitted ? 'text-green-500' : 'text-indigo-500 dark:text-indigo-300'}`} />
            {presessionSubmitted ? 'Info Sent' : 'Pre-Session Info'}
          </button>
        )}

        {/* Cancel/Reschedule - only for Pending or Accepted */}
        {['Pending', 'Accepted'].includes(status) && (
          <button
            onClick={() => onManageRequest({ id, providerId, patientId, providerName: provider, date, time })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
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
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-green-200 dark:border-green-900/50 cursor-default' 
                : 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 border-yellow-200 dark:border-yellow-900/50 shadow-sm dark:shadow-slate-900/50 shadow-yellow-100 hover:scale-105 active:scale-95'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isRated ? 'fill-current text-green-500' : 'fill-current text-yellow-500 animate-pulse'}`} />
            {isRated ? 'Reviewed' : 'Rate & Review'}
          </button>
        )}

        {/* Status Badge */}
        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold ${
          ['Accepted', 'On The Way', 'Arrived'].includes(status) ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200' :
          status === 'Completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200' :
          status === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200' :
          status === 'Cancelled' ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' :
          'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200'
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
  const navigate = useNavigate();

  useEffect(() => {
    const localRated = JSON.parse(localStorage.getItem('rated_requests') || '{}');
    const presession = JSON.parse(localStorage.getItem('presession_submitted') || '{}');
    setPresessionSubmitted(presession);

    if (user) {
      supabase
        .from('provider_reviews')
        .select('request_id')
        .eq('patient_id', user.id)
        .then(({ data }) => {
          const dbRated = {};
          (data || []).forEach(r => { dbRated[r.request_id] = true; });
          setRatedRequests({ ...dbRated, ...localRated });
        })
        .catch(() => setRatedRequests(localRated));
    } else {
      setRatedRequests(localRated);
    }
  }, [user]);

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

  // Use the shared hook for fetching and realtime
  const { requests: fetchedRequests, loading: requestsLoading } = usePatientRequests(user?.id || null);

  useEffect(() => {
    if (!requestsLoading) {
      setRequests(fetchedRequests || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [fetchedRequests, requestsLoading]);

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Requests</h1>
            <p className="text-slate-500 dark:text-slate-400">Track and manage your service requests</p>
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
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">Loading requests...</div>
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
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <EmptyState
                  icon="inbox"
                  title={requests.length === 0 ? 'No requests yet' : 'No matching requests'}
                  message={requests.length === 0 ? 'Find a provider to get started!' : 'No requests found for this filter.'}
                  action={requests.length === 0 ? { label: 'Browse Providers', onClick: () => navigate('/patient/providers') } : undefined}
                />
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
