import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, ShieldCheck, Star, ChevronLeft, ChevronRight, X, MapPin, Phone, Mail, BookOpen, Award, Check, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const AdminProviders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      alert('Failed to approve provider.');
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
      alert('Failed to revoke approval.');
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
      alert(`Failed to ${action} provider.`);
    } finally {
      setActionLoading(false);
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
      alert('Failed to remove provider.');
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
      case 'Approved': return { bg: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
      case 'Pending Approval': return { bg: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
      case 'Incomplete': return { bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
      case 'Banned': return { bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
      default: return { bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
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
            <h1 className="text-2xl font-bold text-slate-900">Manage Providers</h1>
            <p className="text-slate-500">Review, approve, and manage healthcare professionals</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm"
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
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50">
            {filteredProviders.map((p, idx) => {
              const style = getStatusStyle(p.status);
              return (
                <motion.div 
                  key={p.id} 
                  className="p-4 space-y-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setSelectedProvider(p)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary">
                        {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${style.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full status-dot ${style.dot}`} />
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{p.services.length > 0 ? p.services[0] : 'No services'}</span>
                    <div className="flex items-center gap-1 text-yellow-500 font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      {Number(p.rating).toFixed(1)}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">Specialization</th>
                  <th className="px-6 py-4 font-bold">Rating</th>
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
                      className="transition-colors cursor-pointer hover:bg-blue-50/30"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.03 }}
                      onClick={() => setSelectedProvider(p)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-primary">
                            {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block">{p.name}</span>
                            <span className="text-xs text-slate-400">{p.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-sm">{p.services.length > 0 ? p.services.join(', ') : '—'}</td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                          <Star className="w-4 h-4 fill-current" />
                          {Number(p.rating).toFixed(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{p.joinDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${style.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full status-dot ${style.dot}`} />
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          className="text-primary font-bold text-xs hover:underline"
                          onClick={(e) => { e.stopPropagation(); setSelectedProvider(p); }}
                        >
                          Review
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProviders.length === 0 && (
            <div className="p-10 text-center text-slate-500">No providers found.</div>
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {filteredProviders.length} of {providers.length} providers</p>
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
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-[2rem] z-10">
                <h2 className="text-xl font-bold text-slate-900">Provider Details</h2>
                <button onClick={() => setSelectedProvider(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl font-bold text-primary">
                    {selectedProvider.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedProvider.name}</h3>
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
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>{selectedProvider.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedProvider.phone || 'Not provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{selectedProvider.location}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>₱{selectedProvider.price_per_service} per service</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span>{Number(selectedProvider.rating).toFixed(1)} rating</span>
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Specializations</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProvider.services.length > 0 ? (
                      selectedProvider.services.map((s, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-50 text-primary rounded-xl text-xs font-bold border border-blue-100">{s}</span>
                      ))
                    ) : (
                      <p className="text-slate-400 text-sm">No specializations listed.</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Approve / Revoke */}
                  {selectedProvider.status === 'Pending Approval' && (
                    <button 
                      onClick={() => handleApprove(selectedProvider)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200 transition-all disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : 'Approve Provider'}
                    </button>
                  )}
                  {selectedProvider.status === 'Approved' && (
                    <button 
                      onClick={() => handleReject(selectedProvider)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {actionLoading ? 'Processing...' : 'Revoke Approval'}
                    </button>
                  )}

                  {/* Ban / Unban */}
                  <button 
                    onClick={() => handleBan(selectedProvider)}
                    disabled={actionLoading}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 ${
                      selectedProvider.is_banned 
                        ? 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200' 
                        : 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    {actionLoading ? 'Processing...' : selectedProvider.is_banned ? 'Unban Provider' : 'Ban Provider'}
                  </button>

                  {/* Delete */}
                  <button 
                    onClick={() => handleRemove(selectedProvider)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    {actionLoading ? 'Processing...' : 'Permanently Remove'}
                  </button>
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
