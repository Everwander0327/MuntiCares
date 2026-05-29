import { useState, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Search, Download, ArrowUpDown, Wallet, PiggyBank, TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomSelect from '../../components/CustomSelect';
import DateRangePicker from '../../components/DateRangePicker';
import Pagination from '../../components/Pagination';
import useSort from '../../hooks/useSort';
import { supabase } from '../../lib/supabase';
import { SkeletonPage } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import { exportToCSV, formatDataForExport } from '../../lib/exportUtils';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const StatusBadge = ({ status }) => {
  const styles = {
    paid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    refunded: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    unpaid: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  };
  const icons = {
    paid: <CheckCircle2 className="w-3 h-3" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
    refunded: <XCircle className="w-3 h-3" />,
    unpaid: <Clock className="w-3 h-3" />,
  };
  const style = styles[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-bold uppercase ${style}`}>
      {icons[status]} {status === 'paid' ? 'Held' : status === 'completed' ? 'Released' : status}
    </span>
  );
};

const PaymentBadge = ({ method }) => {
  if (method === 'simulated') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-2xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Simulated</span>;
  }
  if (method === 'cash') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-2xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Cash</span>;
  }
  return <span className="text-xs text-slate-400">—</span>;
};

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { sorted, sortKey, handleSort, getSortIndicator } = useSort(transactions);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            request:request_id(id, service, date, time, status),
            patient:patient_id(full_name, email),
            provider:provider_id(full_name, email)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(t => ({
          id: t.id,
          requestId: t.request_id,
          patient: t.patient?.full_name || 'Unknown',
          patientEmail: t.patient?.email || '',
          provider: t.provider?.full_name || 'Unknown',
          providerEmail: t.provider?.email || '',
          service: t.request?.service || '—',
          requestStatus: t.request?.status || '—',
          amount: Number(t.amount) || 0,
          platform_fee: Number(t.platform_fee) || 0,
          provider_payout: Number(t.provider_payout) || 0,
          payment_method: t.payment_method || '',
          status: t.status || 'unpaid',
          paid_at: t.paid_at,
          date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: new Date(t.created_at).getTime(),
          created_at: t.created_at,
        }));

        setTransactions(formatted);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const volume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const platformRevenue = transactions.reduce((sum, t) => sum + t.platform_fee, 0);
  const providerEarnings = transactions.reduce((sum, t) => sum + t.provider_payout + (t.payment_method === 'cash' ? t.amount : 0), 0);
  const pendingRelease = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.provider_payout, 0);

  const filtered = sorted.filter(t => {
    const matchesSearch = !searchTerm ||
      t.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || t.status === filter;
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && new Date(t.timestamp) >= new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(t.timestamp) <= end;
    }
    return matchesSearch && matchesFilter && matchesDate;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filter, startDate, endDate, sortKey]);

  const handleExport = () => {
    const fields = [
      { key: 'id', label: 'Transaction ID' },
      { key: 'patient', label: 'Patient' },
      { key: 'provider', label: 'Provider' },
      { key: 'service', label: 'Service' },
      { key: 'amount', label: 'Amount (PHP)' },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'platform_fee', label: 'Platform Fee' },
      { key: 'provider_payout', label: 'Provider Payout' },
      { key: 'status', label: 'Status' },
      { key: 'date', label: 'Date' },
    ];
    const exportable = formatDataForExport(filtered, fields);
    exportToCSV(exportable, 'transactions_export');
    toast.success('Transactions exported to CSV.');
  };

  if (loading) {
    return <DashboardLayout role="admin"><SkeletonPage /></DashboardLayout>;
  }

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

  const StatCard = ({ label, value, icon, color, sub, delay = 0 }) => (
    <motion.div
      className={`rounded-3xl border ${color.border} p-5 ${color.bg}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${color.iconBg}`}>
          {icon}
        </div>
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${color.label}`}>{label}</p>
          <p className={`text-2xl font-bold ${color.value}`}>{value}</p>
          {sub && <p className={`text-xs mt-0.5 ${color.sub}`}>{sub}</p>}
        </div>
      </div>
    </motion.div>
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <motion.div
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Transactions</h1>
            <p className="text-slate-500 dark:text-slate-400">Payment records across all service requests</p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-xl py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/10 shadow-sm dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ start, end }) => { setStartDate(start); setEndDate(end); }}
            />
            <CustomSelect
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'paid', label: 'Held' },
                { value: 'completed', label: 'Released' },
                { value: 'refunded', label: 'Refunded' },
              ]}
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl bg-white border border-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            >
              <Download className="w-4 h-4" /> Export
            </motion.button>
          </div>
        </motion.div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Transaction Volume"
            value={`₱${volume.toLocaleString()}`}
            icon={<TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            color={{ bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20', border: 'border-blue-100 dark:border-blue-900/50', iconBg: 'bg-blue-100 dark:bg-blue-900/30', label: 'text-blue-600 dark:text-blue-400', value: 'text-blue-700 dark:text-blue-300', sub: 'text-blue-500' }}
            sub={`${transactions.length} transaction(s)`}
          />
          <StatCard
            label="Platform Revenue"
            value={`₱${platformRevenue.toLocaleString()}`}
            icon={<PiggyBank className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
            color={{ bg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20', border: 'border-emerald-100 dark:border-emerald-900/50', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-700 dark:text-emerald-300', sub: 'text-emerald-500' }}
            sub="10% fee from simulated payments"
          />
          <StatCard
            label="Provider Earnings"
            value={`₱${providerEarnings.toLocaleString()}`}
            icon={<Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            color={{ bg: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20', border: 'border-purple-100 dark:border-purple-900/50', iconBg: 'bg-purple-100 dark:bg-purple-900/30', label: 'text-purple-600 dark:text-purple-400', value: 'text-purple-700 dark:text-purple-300', sub: 'text-purple-500' }}
            sub="Including cash + released payouts"
          />
          <StatCard
            label="Pending Release"
            value={`₱${pendingRelease.toLocaleString()}`}
            icon={<Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
            color={{ bg: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20', border: 'border-amber-100 dark:border-amber-900/50', iconBg: 'bg-amber-100 dark:bg-amber-900/30', label: 'text-amber-600 dark:text-amber-400', value: 'text-amber-700 dark:text-amber-300', sub: 'text-amber-500' }}
            sub="Held — awaiting release to provider"
          />
        </div>

        {/* Transactions Table */}
        <motion.div
          className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-50 dark:divide-slate-700">
            {paginated.length === 0 ? (
              <EmptyState icon="inbox" title="No transactions found" message="No transactions match your current search or filter." variant="compact" />
            ) : (
              paginated.map((t, idx) => (
                <motion.div
                  key={t.id}
                  className="p-4 space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{t.service}</p>
                      <p className="text-2xs text-slate-400 font-mono dark:text-slate-500">{t.id.slice(0, 8)}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <p><span className="text-slate-400">Patient:</span> {t.patient}</p>
                      <p><span className="text-slate-400">Provider:</span> {t.provider}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 dark:text-green-400">₱{t.amount.toLocaleString()}</p>
                      <PaymentBadge method={t.payment_method} />
                    </div>
                  </div>
                  {t.payment_method === 'simulated' && (
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg px-3 py-1.5">
                      <span>Fee: ₱{t.platform_fee}</span>
                      <span>Provider: ₱{t.provider_payout}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-400 dark:text-slate-500">{t.date}</div>
                </motion.div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider dark:bg-slate-900 dark:text-slate-400">
                  <SortableHeader label="Transaction ID" sortKey="id" />
                  <SortableHeader label="Patient" sortKey="patient" />
                  <SortableHeader label="Provider" sortKey="provider" />
                  <SortableHeader label="Service" sortKey="service" />
                  <SortableHeader label="Amount" sortKey="amount" />
                  <th className="px-6 py-4 font-semibold">Payment Method</th>
                  <SortableHeader label="Platform Fee" sortKey="platform_fee" />
                  <SortableHeader label="Provider Payout" sortKey="provider_payout" />
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Date" sortKey="date" />
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan="10"><EmptyState icon="inbox" title="No transactions found" message="No transactions match your current search or filter." variant="compact" /></td>
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
                      <td className="px-6 py-4 text-sm font-mono text-slate-400 dark:text-slate-500">{t.id.slice(0, 8)}</td>
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{t.patient}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{t.provider}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-50 rounded-lg text-xs text-slate-500 font-semibold dark:bg-slate-800 dark:text-slate-400">{t.service}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">₱{t.amount.toLocaleString()}</td>
                      <td className="px-6 py-4"><PaymentBadge method={t.payment_method} /></td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {t.payment_method === 'simulated' ? `₱${t.platform_fee.toLocaleString()}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {t.payment_method === 'simulated' ? `₱${t.provider_payout.toLocaleString()}` : <span className="text-slate-400">Cash (direct)</span>}
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                      <td className="px-6 py-4 text-slate-500 text-sm dark:text-slate-400">{t.date}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminTransactions;
