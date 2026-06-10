import { Check, Receipt as ReceiptIcon, Smartphone, Building2, Copy, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

const methodIcons = {
  gcash: Smartphone,
  maya: Smartphone,
  bank_transfer: Building2,
};

const methodLabels = {
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
};

const ReceiptModal = ({ isOpen, onClose, transaction }) => {
  const [copied, setCopied] = useState(false);
  if (!transaction) return null;

  const amount = Number(transaction.amount) || 0;
  const platformFee = Number(transaction.platform_fee) || 0;
  const totalCharge = amount + platformFee;
  const receiptId = `RCT-${(transaction.id || '').slice(0, 8).toUpperCase()}`;
  const paidDate = transaction.paid_at
    ? new Date(transaction.paid_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  const Icon = methodIcons[transaction.payment_method] || ReceiptIcon;
  const methodLabel = methodLabels[transaction.payment_method] || transaction.payment_method;

  const copyRef = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptIcon className="w-5 h-5 text-primary" />
            Payment Receipt
          </DialogTitle>
          <DialogDescription>
            Transaction record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center py-4 bg-green-50 dark:bg-green-900/30 rounded-2xl border border-green-100 dark:border-green-900/50">
            <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">Payment Complete</p>
          </div>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Receipt No.</span>
              <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-xs">{receiptId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Provider</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{transaction.providerName || transaction.provider || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Payment Method</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {methodLabel}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Date</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{paidDate}</span>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Service Fee</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">₱{amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Platform Fee (10%)</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">₱{platformFee.toLocaleString()}</span>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-300">Total Charged</span>
              <span className="font-bold text-green-600 dark:text-green-400">₱{totalCharge.toLocaleString()}</span>
            </div>
          </div>

          <p className="text-center text-2xs text-slate-400 dark:text-slate-500">
            Transaction ID: {transaction.id}
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => copyRef(receiptId)}
              className="flex-1"
            >
              {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy Receipt No.'}
            </Button>
            <Button onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptModal;
