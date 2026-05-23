import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, ShieldCheck, Star, ChevronLeft, ChevronRight, X, MapPin, Phone, Mail, BookOpen, Award, Check, Ban, Clock, ExternalLink, Shield, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';

const getProfessionalIdUrl = (filePath) => {
  if (!filePath) return null;
  const { data } = supabase.storage.from('provider-docs').getPublicUrl(filePath);
  return data?.publicUrl || null;
};

const AdminProviders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [professionalIdPreviews, setProfessionalIdPreviews] = useState([]);
  const [docActionLoading, setDocActionLoading] = useState(false);

  const fetchProviders = async () => {
    try {
        const { data, error } = await supabase
          .from('providers')
          .select('*, user:user_id(id, full_name, email, is_banned, created_at)')
          .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map(p => {
        let status = 'Incomplete';
        if (p.user?.is_banned) {
          status = 'Banned';
        } else if (p.is_approved) {
          status = 'Approved';
        } else if (p.is_profile_complete) {
          status = 'Pending Approval';
        }

        return {
          id: p.id,
          userId: p.user_id,
          name: p.user?.full_name || 'Unknown',
          email: p.user?.email || '',
          services: p.services || [],
          rating: p.rating || 0,
          location: p.location || 'Muntinlupa City',
          price_per_service: p.price_per_service || 0,
          phone: p.phone || '',
          bio: p.bio || '',
          is_profile_complete: p.is_profile_complete,
          is_approved: p.is_approved,
          is_banned: p.user?.is_banned || false,
          professional_id_path: p.professional_id_path || null,
          professional_id_paths: p.professional_id_paths || [],
          professional_id_status: p.professional_id_status || 'none',
          trust_score: p.trust_score || 0,
          joinDate: p.user?.created_at ? new Date(p.user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
          status
        };
      });

      setProviders(shaped);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    const paths = (selectedProvider?.professional_id_paths && selectedProvider.professional_id_paths.length > 0)
      ? selectedProvider.professional_id_paths
      : (selectedProvider?.professional_id_path ? [selectedProvider.professional_id_path] : []);
    setProfessionalIdPreviews(paths.map(p => getProfessionalIdUrl(p)).filter(Boolean));
  }, [selectedProvider]);

  const handleApprove = async (provider) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: true })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error('Error approving provider:', err);
      toast.error('Failed to approve provider.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (provider) => {
    if (!window.confirm(`Revoke approval for ${provider.name}? They will no longer be visible to patients.`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('providers')
        .update({ is_approved: false })
        .eq('user_id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error('Error rejecting provider:', err);
      toast.error('Failed to revoke approval.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async (provider) => {
    const action = provider.is_banned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${provider.name}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !provider.is_banned })
        .eq('id', provider.userId);
      if (error) throw error;

      // If banning, also revoke approval
      if (!provider.is_banned) {
        await supabase.from('providers').update({ is_approved: false }).eq('user_id', provider.userId);
      }

      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error(`Error ${action}ning provider:`, err);
      toast.error(`Failed to ${action} provider.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({ professional_id_status: 'verified', trust_score: newScore })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error('Error verifying document:', err);
      toast.error('Failed to verify document.');
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRejectDocument = async (provider) => {
    setDocActionLoading(true);
    try {
      let newScore = 0;
      if (provider.is_approved) newScore += 30;
      if (provider.is_profile_complete) newScore += 20;
      if (provider.rating && provider.rating >= 4.0) newScore += 20;
      newScore = Math.min(100, newScore);

      const { error } = await supabase
        .from('providers')
        .update({ professional_id_status: 'rejected', trust_score: newScore })
        .eq('id', provider.id);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error('Error rejecting document:', err);
      toast.error('Failed to reject document.');
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleRemove = async (provider) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${provider.name} and all their data? This cannot be undone!`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', provider.userId);
      if (error) throw error;
      setSelectedProvider(null);
      await fetchProviders();
    } catch (err) {
      console.error('Error removing provider:', err);
      toast.error('Failed to remove provider.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Approved': return { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' };
      case 'Pending Approval': return { bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500' };
      case 'Banned': return { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' };
      default: return { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' };
    }
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <motion.div 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Manage Providers</h1>
            <p className="text-slate-500 dark:text-slate-400">Review, approve, and manage healthcare professionals</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50"
              />
            </div>
            <CustomSelect 
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'All', label: 'All Status' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Pending Approval', label: 'Pending Approval' },
                { value: 'Incomplete', label: 'Incomplete' },
                { value: 'Banned', label: 'Banned' },
              ]}
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
            {filteredProviders.map((p, idx) => {
              const style = getStatusStyle(p.status);
              return (
                <motion.div 
                  key={p.id} 
                  className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-700/50"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedProvider(p)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary dark:bg-blue-900/30">
                        {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{p.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${style.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full status-dot ${style.dot}`} />
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">{p.services.length > 0 ? p.services[0] : 'No services'}</span>
                    <div className="flex items-center gap-1 text-yellow-500 font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      {Number(p.rating).toFixed(1)}
                    </div>
                  </div>
                  <div className="pt-1">
                    {p.professional_id_status === 'verified' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : p.professional_id_status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Clock className="w-3 h-3" /> ID Pending
                      </span>
                    ) : p.professional_id_status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <X className="w-3 h-3" /> Rejected
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">Specialization</th>
                  <th className="px-6 py-4 font-bold">Rating</th>
                  <th className="px-6 py-4 font-bold">Documents</th>
                  <th className="px-6 py-4 font-bold">Joined</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.map((p, idx) => {
                  const style = getStatusStyle(p.status);
                  return (
                    <motion.tr 
                      key={p.id} 
                      className="transition-colors cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-900/20"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.03 }}
                      onClick={() => setSelectedProvider(p)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary dark:bg-blue-900/30">
                            {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block dark:text-slate-200">{p.name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">{p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm dark:text-slate-300">{p.services.length > 0 ? p.services.join(', ') : '—'}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                          <Star className="w-4 h-4 fill-current" />
                          {Number(p.rating).toFixed(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {p.professional_id_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <ShieldCheck className="w-3 h-3" /> Verified
                          </span>
                        ) : p.professional_id_status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : p.professional_id_status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            <X className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{p.joinDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${style.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full status-dot ${style.dot}`} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="text-primary font-bold text-xs hover:underline"
                        onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                      >
                        Review
                      </motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProviders.length === 0 && (
            <EmptyState icon="users" title="No providers found" message="No providers match your current search or filter." variant="compact" />
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Showing {filteredProviders.length} of {providers.length} providers</p>
          </div>
        </motion.div>
      </div>

      {/* Provider Detail Modal */}
      <AnimatePresence>
        {selectedProvider && (
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProvider(null)}
          >
            <motion.div 
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto dark:bg-slate-800"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-[2rem] z-10 dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Provider Details</h2>
                <button onClick={() => setSelectedProvider(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors dark:hover:bg-slate-700">
                  <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-primary dark:bg-blue-900/30">
                    {selectedProvider.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedProvider.name}</h3>
                    <p className="text-primary text-sm font-semibold">{selectedProvider.bio || 'No bio provided'}</p>
                    {(() => {
                      const style = getStatusStyle(selectedProvider.status);
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest mt-1 ${style.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {selectedProvider.status}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>{selectedProvider.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>{selectedProvider.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>{selectedProvider.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
                    <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span>₱{selectedProvider.price_per_service} per service</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm dark:text-slate-300">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span>{Number(selectedProvider.rating).toFixed(1)} rating</span>
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2 dark:text-slate-500">Specializations</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.services.length > 0 ? (
                      selectedProvider.services.map((s, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-50 text-primary rounded-xl text-xs font-bold border border-blue-100 dark:bg-blue-900/30">{s}</span>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm dark:text-slate-500">No specializations listed.</p>
                    )}
                  </div>
                </div>

                {/* Professional ID Verification */}
                {(selectedProvider.professional_id_paths?.length > 0 || selectedProvider.professional_id_path) && (
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-2 dark:text-slate-500">Professional ID</p>
                    {professionalIdPreviews.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {professionalIdPreviews.map((url, i) => (
                          <div key={i} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-1">
                            {url.endsWith('.pdf') ? (
                              <div className="flex items-center gap-2 p-2">
                                <FileText className="w-5 h-5 text-primary shrink-0" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">Document {i + 1}</span>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
                                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                                </a>
                              </div>
                            ) : (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                <img src={url} alt={`Professional ID ${i + 1}`} className="w-full h-28 object-contain rounded-lg" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 p-2 mb-3">Loading preview...</p>
                    )}
                    {selectedProvider.professional_id_status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleVerifyDocument(selectedProvider)}
                          disabled={docActionLoading}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200 hover:shadow-xl hover:shadow-green-200 transition-all disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          {docActionLoading ? '...' : 'Verify ID'}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleRejectDocument(selectedProvider)}
                          disabled={docActionLoading}
                          className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 dark:border-red-900/50"
                        >
                          <X className="w-4 h-4" />
                          {docActionLoading ? '...' : 'Reject ID'}
                        </motion.button>
                      </div>
                    )}
                    {selectedProvider.professional_id_status === 'verified' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-xl text-xs font-medium text-green-700 dark:text-green-300 mb-3">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        Professional ID has been verified.
                      </div>
                    )}
                    {selectedProvider.professional_id_status === 'rejected' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-xs font-medium text-red-700 dark:text-red-300 mb-3">
                        <X className="w-4 h-4 shrink-0" />
                        Professional ID was rejected.
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  {/* Approve / Revoke */}
                  {selectedProvider.status === 'Pending Approval' && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleApprove(selectedProvider)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200 hover:shadow-xl hover:shadow-green-200 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : 'Approve Provider'}
                    </motion.button>
                  )}
                  {selectedProvider.status === 'Approved' && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleReject(selectedProvider)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-all disabled:opacity-50 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50 dark:border-yellow-900/50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : 'Revoke Approval'}
                    </motion.button>
                  )}

                  {/* Ban / Unban */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleBan(selectedProvider)}
                    disabled={actionLoading}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 ${
                      selectedProvider.is_banned 
                        ? 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 dark:border-green-900/50' 
                        : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 dark:border-red-900/50'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    {actionLoading ? 'Processing...' : selectedProvider.is_banned ? 'Unban Provider' : 'Ban Provider'}
                  </motion.button>

                  {/* Delete */}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleRemove(selectedProvider)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-900/30 dark:border-red-900/50"
                  >
                    <X className="w-4 h-4" />
                    {actionLoading ? 'Processing...' : 'Permanently Remove'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminProviders;
