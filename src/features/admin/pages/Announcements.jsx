import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import { 
  Megaphone, Send, Trash2, Users, Briefcase, Database, 
  Sparkles, Check, Clock, Radio, Search, Filter, AlertCircle, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SkeletonPage, EmptyState } from '@/shared/ui';
import toast from 'react-hot-toast';

const AdminAnnouncements = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [tableMissing, setTableMissing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
          setTableMissing(true);
          return;
        }
        if (error) throw error;

        if (data) setAnnouncements(data);
      } catch (err) {
        console.error('Error fetching announcements:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please fill in title and message.');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert([{
          title: title.trim(),
          message: message.trim(),
          target_audience: target,
          created_by: user?.id,
        }])
        .select();

      if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
        setTableMissing(true);
        toast.error('Announcements table is not initialized.');
        return;
      }
      if (error) throw error;

      if (data) {
        toast.success('Announcement broadcasted successfully!');
        setAnnouncements(prev => [...data, ...prev]);
      }

      setTitle('');
      setMessage('');
      setTarget('all');
    } catch (err) {
      toast.error('Failed to send announcement. Make sure the announcements table exists.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this broadcast announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      if (selectedAnnouncement?.id === id) setSelectedAnnouncement(null);
      toast.success('Announcement deleted.');
    } catch (err) {
      toast.error('Failed to delete announcement.');
    }
  };

  const filteredHistory = announcements.filter(a => {
    const q = historySearch.toLowerCase();
    const matchesSearch = a.title?.toLowerCase().includes(q) || a.message?.toLowerCase().includes(q);
    const matchesTarget = historyFilter === 'all' || (a.target_audience || 'all').toLowerCase() === historyFilter.toLowerCase();
    return matchesSearch && matchesTarget;
  });

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  const targetOptions = [
    { value: 'all', label: 'All Citizens', icon: Users, desc: 'Patients & Healthcare Providers' },
    { value: 'patients', label: 'Patients Only', icon: Users, desc: 'Registered Residents of Muntinlupa' },
    { value: 'providers', label: 'Providers Only', icon: Briefcase, desc: 'Verified Barangay Care Specialists' },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Neumorphic Page Header */}
        <motion.div
          className="neu-flat p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white">
              Public Broadcast Announcements
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Publish real-time medical updates, outreach drives, and municipal healthcare bulletins
            </p>
          </div>
        </motion.div>

        {/* Database notice if table missing */}
        {tableMissing && (
          <motion.div
            className="neu-flat p-4 sm:p-5 rounded-2xl flex items-start gap-3 border border-amber-300 dark:border-amber-700/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Database className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white text-sm">Announcements table not initialized</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Run the SQL migration in <code className="neu-inset px-2 py-0.5 rounded-lg text-primary font-mono text-2xs">supabase-migration.sql</code> to create the announcements table.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Neumorphic Compose Form (7 cols) */}
          <motion.div
            className="lg:col-span-7 neu-flat p-5 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="border-b border-white/60 dark:border-white/5 pb-4">
              <h2 className="text-base sm:text-lg font-display font-black text-slate-900 dark:text-white">
                Compose Broadcast
              </h2>
              <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Real-time dispatch system
              </p>
            </div>

            <div className="space-y-4">
              {/* Target Audience Selector Pills */}
              <div className="space-y-2">
                <label className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Target Audience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {targetOptions.map((opt) => {
                    const isSelected = target === opt.value;
                    const Icon = opt.icon;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setTarget(opt.value)}
                        className={`p-3 rounded-2xl text-left transition-all ${
                          isSelected
                            ? 'neu-inset ring-2 ring-primary text-primary font-bold shadow-inner'
                            : 'neu-btn text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-slate-400'}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[3]" />}
                        </div>
                        <p className="font-bold text-xs mt-2 text-slate-900 dark:text-white">
                          {opt.label}
                        </p>
                        <p className="text-3xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                          {opt.desc}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Free Polio Vaccination Drive at City Hall"
                  className="w-full neu-inset rounded-xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Message Body Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-3xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Broadcast Message Content
                  </label>
                  <span className="text-3xs font-mono text-slate-400">
                    {message.length} chars
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Details of the announcement, schedules, guidelines, contact information..."
                  rows={5}
                  className="w-full neu-inset rounded-xl p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Send Button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                disabled={sending || tableMissing || !title.trim() || !message.trim()}
                className="w-full neu-btn-primary flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs sm:text-sm text-white shadow-lg transition-all disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? 'Broadcasting...' : 'Broadcast Announcement'}</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Right Column: Sent Announcements History (5 cols) */}
          <motion.div
            className="lg:col-span-5 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Header & Filter Card */}
            <div className="neu-flat p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-display font-black text-slate-900 dark:text-white">
                  Sent History
                </h2>
                <span className="neu-flat-sm px-2.5 py-0.5 rounded-full text-3xs font-extrabold text-primary">
                  {filteredHistory.length} Total
                </span>
              </div>

              {/* Inset Search Filter */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search announcements by title or content..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full neu-inset rounded-xl py-2.5 pl-10 pr-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[38px]"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 pt-1">
                {['all', 'patients', 'providers'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setHistoryFilter(cat)}
                    className={`flex-1 py-1 px-2 rounded-xl text-3xs font-extrabold uppercase tracking-wider transition-all ${
                      historyFilter === cat
                        ? 'neu-inset text-primary font-black'
                        : 'neu-btn text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Announcements List Container */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-0.5">
              {filteredHistory.length === 0 ? (
                <div className="neu-flat p-8 rounded-2xl text-center">
                  <EmptyState 
                    icon="bell" 
                    title="No announcements yet" 
                    message="Broadcast messages you send will appear here." 
                    variant="compact" 
                  />
                </div>
              ) : (
                filteredHistory.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="neu-flat p-4 sm:p-5 rounded-2xl space-y-2.5 transition-all hover:ring-1 hover:ring-primary/30 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="neu-flat-sm px-2 py-0.5 rounded-lg text-3xs font-black uppercase tracking-wider text-primary">
                            {a.target_audience || 'All'}
                          </span>
                          <span className="text-3xs font-mono text-slate-400">
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1.5 truncate">
                          {a.title}
                        </h3>
                      </div>

                      <button
                        onClick={() => handleDelete(a.id)}
                        className="neu-btn p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all shrink-0"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {a.message}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-white/60 dark:border-white/5">
                      <span className="text-3xs text-slate-400 font-mono">
                        {new Date(a.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <button
                        onClick={() => setSelectedAnnouncement(a)}
                        className="text-primary font-bold hover:underline flex items-center gap-1 text-3xs uppercase tracking-wider"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Neumorphic Full Announcement Modal Teleported to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedAnnouncement && (
            <motion.div
              className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 sm:backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedAnnouncement(null)}
            >
              <motion.div
                className="neu-flat rounded-[2rem] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/80 dark:border-white/10 shadow-2xl bg-[#ebf1f8] dark:bg-[#172236] transform-gpu will-change-transform"
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-4 sm:p-6 border-b border-white/60 dark:border-white/5 flex items-center justify-between sticky top-0 bg-[#ebf1f8] dark:bg-[#172236] z-10">
                  <div>
                    <h2 className="text-lg font-display font-black text-slate-900 dark:text-white">Announcement Record</h2>
                    <p className="text-3xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Municipal Broadcast Archive</p>
                  </div>
                  <span className="neu-flat-sm px-2.5 py-1 rounded-xl text-3xs font-extrabold uppercase tracking-wider text-primary">
                    {selectedAnnouncement.target_audience || 'All'}
                  </span>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {selectedAnnouncement.title}
                    </h3>
                    <p className="text-3xs font-mono text-slate-400 mt-1">
                      Dispatched on {new Date(selectedAnnouncement.created_at).toLocaleString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="neu-inset p-4 rounded-2xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedAnnouncement.message}
                  </div>
                </div>

                {/* Modal Footer - Expanded full width button */}
                <div className="p-4 sm:p-5 border-t border-white/60 dark:border-white/5 bg-[#ebf1f8]/60 dark:bg-[#172236]/60 flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleDelete(selectedAnnouncement.id)}
                    className="neu-btn px-4 py-3 sm:py-3.5 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedAnnouncement(null)}
                    className="flex-1 neu-btn py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    Close Record
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </DashboardLayout>
  );
};

export default AdminAnnouncements;
