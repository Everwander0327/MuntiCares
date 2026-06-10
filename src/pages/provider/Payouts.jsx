import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Wallet, PiggyBank, TrendingUp, Clock, CheckCircle2, ArrowUpDown, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import DateRangePicker from '../../components/DateRangePicker';
import Pagination from '../../components/Pagination';
import useSort from '../../hooks/useSort';
import { exportToCSV, formatDataForExport } from '../../lib/exportUtils';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const StatusBadge = ({ status }) => {
  const styles = {
    paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    collected: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    pending_cash: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  const icons = {
    paid: <Clock className="w-3 h-3" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
    collected: <CheckCircle2 className="w-3 h-3" />,
    pending_cash: <Clock className="w-3 h-3" />,
  };
  const labels = { paid: 'Held', completed: 'Released', collected: 'Collected', pending_cash: 'Pending Cash' };
  const s = styles[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold uppercase ${s}`}>
      {icons[status]} {labels[status] || status}
    </span>
  );
};

const ProviderPayouts = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(transactions);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            request:request_id(id, service, date, status),
            patient:patient_id(full_name)
          `)
          .eq('provider_id', user.id)
          .in('status', ['paid', 'completed'])
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(t => ({
          id: t.id,
          patient: t.patient?.full_name || 'Unknown',
          service: t.request?.service || '—',
          amount: Number(t.amount) || 0,
          platform_fee: Number(t.platform_fee) || 0,
          provider_payout: Number(t.provider_payout) || 0,
          payment_method: t.payment_method || '',
          status: t.status,
          date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: new Date(t.created_at).getTime(),
        }));

        setTransactions(formatted);
      } catch (err) {
        console.error('Error fetching payouts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user]);

  const totalEarnings = transactions.reduce((s, t) => s + (t.status === 'completed' ? t.provider_payout : 0), 0);
  const pendingRelease = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.provider_payout, 0);
  const totalFees = transactions.reduce((s, t) => s + t.platform_fee, 0);
  const totalVolume = transactions.reduce((s, t) => s + t.amount, 0);

  const filtered = sorted.filter(t => {
    let ok = true;
    if (startDate) ok = ok && t.timestamp >= new Date(startDate).getTime();
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      ok = ok && t.timestamp <= end.getTime();
    }
    return ok;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [startDate, endDate, sortKey]);

  const handleExport = () => {
    const fields = [
      { key: 'id', label: 'Transaction ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'service', label: 'Service' },
      { key: 'amount', label: 'Amount (PHP)' },
      { key: 'platform_fee', label: 'Platform Fee' },
      { key: 'provider_payout', label: 'Your Payout' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date' },
    ];
    exportToCSV(formatDataForExport(filtered, fields), 'my_payouts');
    toast.success('Payouts exported.');
  };

  if (loading) return <DashboardLayout role="provider"><SkeletonPage /></DashboardLayout>;

  const StatCard = ({ label, value, icon, color, sub, delay = 0 }) => (
    <motion.div
      className={`rounded-3xl border ${color.border} p-5 ${color.bg}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${color.iconBg}`}>{icon}</div>
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${color.label}`}>{label}</p>
          <p className={`text-2xl font-bold ${color.value}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${color.sub}`}>{sub}</p>}
        </div>
      </div>
    </motion.div>
  );

  const SortableHeader = ({ label, sortKey: sk }) => (
    <th
      className="px-6 py-4 font-semibold cursor-pointer hover:text-primary transition-colors select-none"
      onClick={() => { handleSort(sk); setCurrentPage(1); }}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === sk ? 'text-primary' : 'opacity-30'}`} />
        {getSortIndicator(sk)}
      </span>
    </th>
  );

  return (
    <DashboardLayout role="provider">
      <div className="space-y-6">
        <motion.div
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Payouts</h1>
            <p className="text-slate-500 dark:text-slate-400">Track your earnings and released payments</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <Download className="w-4 h-4" /> Export
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Earned"
            value={`₱${totalEarnings.toLocaleString()}`}
            icon={<TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />}
            color={{ bg: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20', border: 'border-green-100 dark:border-green-900/50', iconBg: 'bg-green-100 dark:bg-green-900/30', label: 'text-green-600 dark:text-green-400', value: 'text-green-700 dark:text-green-300', sub: 'text-green-500' }}
            sub="Released payments only"
          />
          <StatCard
            label="Pending Release"
            value={`₱${pendingRelease.toLocaleString()}`}
            icon={<Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
            color={{ bg: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20', border: 'border-amber-100 dark:border-amber-900/50', iconBg: 'bg-amber-100 dark:bg-amber-900/30', label: 'text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-300', sub: 'text-amber-500' }}
            sub="Awaiting service completion"
          />
          <StatCard
            label="Platform Fees"
            value={`₱${totalFees.toLocaleString()}`}
            icon={<PiggyBank className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            color={{ bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20', border: 'border-blue-100 dark:border-blue-900/50', iconBg: 'bg-blue-100 dark:bg-blue-900/30', label: 'text-blue-600 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300', sub: 'text-blue-500' }}
            sub="10% platform fee"
          />
          <StatCard
            label="Transaction Volume"
            value={`₱${totalVolume.toLocaleString()}`}
            icon={<Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            color={{ bg: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20', border: 'border-purple-100 dark:border-purple-900/50', iconBg: 'bg-purple-100 dark:bg-purple-900/30', label: 'text-purple-600 dark:text-purple-400', value: 'text-purple-700 dark:text-purple-300', sub: 'text-purple-500' }}
            sub={`${transactions.length} total transaction(s)`}
          />
        </div>

        <div className="flex gap-2">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }} />
        </div>

        <motion.div
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <SortableHeader label="Patient" sortKey="patient" />
                  <SortableHeader label="Service" sortKey="service" />
                  <SortableHeader label="Amount" sortKey="amount" />
                  <th className="px-6 py-4 font-semibold">Platform Fee</th>
                  <SortableHeader label="Your Payout" sortKey="provider_payout" />
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Date" sortKey="date" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <EmptyState icon="wallet" title="No payouts yet" message="Payments from completed services will appear here." variant="compact" />
                    </td>
                  </tr>
                ) : (
                  paginated.map((t, idx) => (
                    <motion.tr
                      key={t.id}
                      className="transition-colors group"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.03 }}
                    >
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{t.patient}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-50 rounded-lg text-xs text-slate-500 font-semibold dark:bg-slate-800 dark:text-slate-400">{t.service}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">₱{t.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ₱{t.platform_fee.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-semibold text-green-600 dark:text-green-400">₱{t.provider_payout.toLocaleString()}</td>
                      <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                      <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{t.date}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginated.length === 0 ? (
              <EmptyState icon="wallet" title="No payouts yet" message="Payments from completed services will appear here." variant="compact" />
            ) : (
              paginated.map((t, idx) => (
                <motion.div key={t.id} className="p-4 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{t.patient}</p>
                      <p className="text-xs text-slate-400">{t.service}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t.date}</span>
                    <span className="font-bold text-green-600 dark:text-green-400">₱{t.provider_payout.toLocaleString()}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default ProviderPayouts;
