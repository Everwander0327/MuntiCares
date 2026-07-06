import { useState } from 'react';
import { X, Check, Receipt as ReceiptIcon, Smartphone, Building2, Copy, CheckCheck } from 'lucide-react';

const methodIcons = { gcash: Smartphone, maya: Smartphone, bank_transfer: Building2 };
const methodLabels = { gcash: 'GCash', maya: 'Maya', bank_transfer: 'Bank Transfer' };

const ReceiptModal = ({ isOpen, onClose, transaction }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const amount = 1500;
  const platformFee = 150;
  const totalCharge = amount + platformFee;
  const receiptId = 'RCT-DEMO-001';
  const paidDate = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const method = transaction?.payment_method || 'gcash';
  const Icon = methodIcons[method] || ReceiptIcon;
  const methodLabel = methodLabels[method] || method;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ReceiptIcon className="w-5 h-5 text-primary" /> Payment Receipt</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-100">
            <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2"><Check className="w-6 h-6" /></div>
            <p className="text-lg font-bold text-green-700">Payment Complete</p>
          </div>

          <div className="space-y-2 bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Receipt No.</span><span className="font-bold font-mono text-slate-900 text-xs">{receiptId}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Provider</span><span className="font-semibold text-slate-900">{transaction?.providerName || transaction?.provider || '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Payment Method</span><span className="font-semibold text-slate-900 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-primary" />{methodLabel}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Date</span><span className="font-semibold text-slate-900">{paidDate}</span></div>
          </div>

          <div className="space-y-2 bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Service Fee</span><span className="font-semibold text-slate-900">₱{amount.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee (10%)</span><span className="font-semibold text-blue-600">₱{platformFee.toLocaleString()}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between text-sm"><span className="font-bold text-slate-700">Total Charged</span><span className="font-bold text-green-600">₱{totalCharge.toLocaleString()}</span></div>
          </div>

          <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Done</button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
