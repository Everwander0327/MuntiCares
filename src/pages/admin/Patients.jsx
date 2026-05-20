import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, ChevronLeft, ChevronRight, Ban, X, Mail, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';

const AdminPatients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, is_banned, created_at')
        .eq('role', 'patient')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const shaped = (data || []).map(p => ({
        id: p.id,
        name: p.full_name,
        email: p.email,
        joinDate: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        is_banned: p.is_banned || false,
        status: p.is_banned ? 'Banned' : 'Active'
      }));

      setPatients(shaped);
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleBan = async (patient) => {
    const action = patient.is_banned ? 'unban' : 'ban';
    if (!window.confirm(`Are you sure you want to ${action} ${patient.name}?`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: !patient.is_banned })
        .eq('id', patient.id);
      if (error) throw error;
      await fetchPatients();
    } catch (err) {
      console.error(`Error ${action}ning patient:`, err);
      alert(`Failed to ${action} patient.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (patient) => {
    if (!window.confirm(`⚠️ PERMANENTLY DELETE ${patient.name} and all their data? This cannot be undone!`)) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', patient.id);
      if (error) throw error;
      await fetchPatients();
    } catch (err) {
      console.error('Error removing patient:', err);
      alert('Failed to remove patient.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

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
            <h1 className="text-2xl font-bold text-slate-900">Manage Patients</h1>
            <p className="text-slate-500">Overview of all registered patients in Muntinlupa</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search patients..."
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
                { value: 'Active', label: 'Active' },
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
            {filteredPatients.map((p, idx) => (
              <motion.div 
                key={p.id} 
                className="p-4 space-y-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                      {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                      p.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {p.status}
                  </span>
                </div>
                <div className="text-sm text-slate-400">Joined: {p.joinDate}</div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                  <button 
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                      p.is_banned ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                    }`}
                    onClick={() => handleBan(p)}
                    disabled={actionLoading}
                  >
                    {p.is_banned ? 'Unban' : 'Ban'}
                  </button>
                  <button 
                    className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    onClick={() => handleRemove(p)}
                    disabled={actionLoading}
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-striped">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Full Name</th>
                  <th className="px-6 py-4 font-bold">Email</th>
                  <th className="px-6 py-4 font-bold">Joined</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p, idx) => (
                  <motion.tr 
                    key={p.id} 
                    className="transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.03 }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {p.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-700">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{p.email}</td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{p.joinDate}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        p.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full status-dot ${
                          p.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          className={`p-2 rounded-xl transition-all ${
                            p.is_banned 
                              ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                              : 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                          }`}
                          onClick={() => handleBan(p)}
                          disabled={actionLoading}
                          title={p.is_banned ? 'Unban' : 'Ban'}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                          onClick={() => handleRemove(p)}
                          disabled={actionLoading}
                          title="Remove Permanently"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPatients.length === 0 && (
            <div className="p-10 text-center text-slate-500">No patients found.</div>
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Showing {filteredPatients.length} of {patients.length} patients</p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPatients;
