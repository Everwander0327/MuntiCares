import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Megaphone, Send, Trash2, Users, Briefcase, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import toast from 'react-hot-toast';

const AdminAnnouncements = () => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') {
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
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('announcements')
        .insert([{
          title: title.trim(),
          message: message.trim(),
          target_audience: target,
          created_by: user?.user?.id,
        }])
        .select();

      if (error) throw error;

      if (data) {
        toast.success('Announcement sent!');
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
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted.');
    } catch (err) {
      toast.error('Failed to delete.');
    }
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Announcements</h1>
          <p className="text-slate-500 dark:text-slate-400">Send broadcast messages to platform users</p>
        </motion.div>

        {tableMissing && (
          <motion.div
            className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3 dark:bg-amber-900/20 dark:border-amber-900/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div>
              <p className="font-bold text-amber-800 text-sm dark:text-amber-300">Announcements table not set up yet</p>
              <p className="text-amber-700 text-sm mt-1 dark:text-amber-400">
                Run the SQL migration in <code className="bg-amber-100 px-1.5 py-0.5 rounded dark:bg-amber-900/50">supabase-migration.sql</code> to create the <code className="bg-amber-100 px-1.5 py-0.5 rounded dark:bg-amber-900/50">announcements</code> table before sending broadcasts.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose */}
          <motion.div
            className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-6">
              <Send className="w-5 h-5 text-primary" />
              Compose Announcement
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., New Service Available"
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Target Audience</label>
                <div className="flex gap-2 mt-1.5">
                  {[
                    { value: 'all', label: 'All Users', icon: <Users className="w-4 h-4" /> },
                    { value: 'patients', label: 'Patients Only', icon: <Users className="w-4 h-4" /> },
                    { value: 'providers', label: 'Providers Only', icon: <Briefcase className="w-4 h-4" /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTarget(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        target === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider dark:text-slate-500">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={5}
                  className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 resize-none"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleSend}
                disabled={sending || !title.trim() || !message.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send Announcement'}
              </motion.button>
            </div>
          </motion.div>

          {/* History */}
          <motion.div
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" />
                Sent Announcements ({announcements.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-50 dark:divide-slate-700 max-h-[250px] md:max-h-[400px] overflow-y-auto">
              {announcements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12 dark:text-slate-500">No announcements sent yet.</p>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="p-5 hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-700/30 group">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{a.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{a.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-2xs text-slate-400 dark:text-slate-500">
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            {a.target_audience || 'all'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminAnnouncements;
