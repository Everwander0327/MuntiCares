import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { MessageSquare, Search, CheckCircle, FileText, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import { useNavigate } from 'react-router-dom';
import PatientRecordModal from '../../components/PatientRecordModal';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';

const ProviderPatients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Modal State
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPatients = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id, patient_id, service, date, status, patient:patient_id(full_name)')
          .eq('provider_id', user.id)
          .in('status', ['Accepted', 'Completed'])
          .order('date', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(r => ({
          requestId: r.id,
          patientId: r.patient_id,
          name: r.patient?.full_name || 'Unknown Patient',
          service: r.service,
          lastVisit: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: r.status === 'Completed' ? 'Completed' : 'Active', // Map 'Accepted' to 'Active' for UI
          rawStatus: r.status
        }));

        // In a real app we might want to group by patient_id, but here we list all engagements.
        setPatients(formatted);
      } catch (err) {
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [user]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.service.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMarkCompleted = async (requestId, patientName) => {
    if (!window.confirm(`Mark service for ${patientName} as completed?`)) return;
    
    setUpdatingId(requestId);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'Completed' })
        .eq('id', requestId);
      
      if (error) throw error;

      setPatients(prev => prev.map(p => 
        p.requestId === requestId ? { ...p, status: 'Completed', rawStatus: 'Completed' } : p
      ));
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to mark as completed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenRecord = (patientId, patientName) => {
    setSelectedPatient({ id: patientId, name: patientName });
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout role="provider">
        <SkeletonPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="provider">
      <div className="space-y-8">
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Patients</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your active patient list and completed services</p>
          </div>
          <div className="relative md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input 
              type="text" 
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
            />
          </div>
        </motion.div>

        <motion.div 
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {filteredPatients.map((p, idx) => (
              <motion.div 
                key={idx} 
                className="p-4 space-y-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold dark:bg-blue-900/30">
                      {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                      <p className="text-xs text-primary font-semibold">{p.service}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-widest ${
                    p.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                      p.status === 'Active' ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-500'
                    }`} />
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Date: {p.lastVisit}</p>
                  <div className="flex gap-2">
                      {p.rawStatus === 'Accepted' && (
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className={`p-2 bg-green-50 text-green-600 hover:text-white hover:bg-green-500 rounded-lg transition-all dark:bg-green-900/30 ${updatingId === p.requestId ? 'opacity-50' : ''}`}
                          onClick={() => handleMarkCompleted(p.requestId, p.name)}
                          disabled={updatingId === p.requestId}
                          title="Mark as Completed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="p-2 bg-blue-50 text-blue-600 hover:text-white hover:bg-blue-500 rounded-lg transition-all dark:bg-blue-900/30"
                        onClick={() => handleOpenRecord(p.patientId, p.name)}
                        title="View Medical Record"
                      >
                        <FileText className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="p-2 bg-purple-50 text-purple-600 hover:text-white hover:bg-purple-500 rounded-lg transition-all dark:bg-purple-900/30"
                        onClick={() => navigate(`/provider/patients/${p.patientId}/profile`)}
                        title="View Profile"
                      >
                        <User className="w-4 h-4" />
                      </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-semibold">Patient Name</th>
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p, idx) => (
                  <motion.tr 
                    key={idx} 
                    className="transition-colors group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold dark:bg-blue-900/30">
                          {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{p.service}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{p.lastVisit}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        p.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                          p.status === 'Active' ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-500'
                        }`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {p.rawStatus === 'Accepted' && (
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            className={`p-2 text-green-600 bg-green-50 hover:bg-green-500 hover:text-white rounded-xl transition-all dark:bg-green-900/30 ${updatingId === p.requestId ? 'opacity-50' : ''}`}
                            onClick={() => handleMarkCompleted(p.requestId, p.name)}
                            disabled={updatingId === p.requestId}
                            title="Mark as Completed"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-500 hover:text-white rounded-xl transition-all dark:bg-blue-900/30" 
                          onClick={() => handleOpenRecord(p.patientId, p.name)}
                          title="View Medical Record"
                        >
                          <FileText className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-500 hover:text-white rounded-xl transition-all dark:bg-purple-900/30"
                          onClick={() => navigate(`/provider/patients/${p.patientId}/profile`)}
                          title="View Profile"
                        >
                          <User className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          className="p-2 text-slate-400 hover:text-primary transition-all dark:text-slate-500"
                          onClick={() => toast('Messaging coming soon!', { icon: '💬' })}
                        >
                          <MessageSquare className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPatients.length === 0 && (
            <EmptyState icon="users" title="No patients yet" message="Accept a request to add them here." variant="compact" />
          )}
        </motion.div>
      </div>

      {selectedPatient && (
        <PatientRecordModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
        />
      )}
    </DashboardLayout>
  );
};

export default ProviderPatients;
