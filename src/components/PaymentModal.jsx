import { useState } from 'react';
import { Smartphone, Building2, Check, Loader2, QrCode, Copy, CheckCheck, Receipt as ReceiptIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

const methods = [
  {
    id: 'gcash',
    label: 'GCash',
    icon: Smartphone,
    color: 'bg-blue-500',
    desc: 'Pay via GCash',
    fee: 0.1,
  },
  {
    id: 'maya',
    label: 'Maya',
    icon: Smartphone,
    color: 'bg-red-500',
    desc: 'Pay via Maya',
    fee: 0.1,
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    icon: Building2,
    color: 'bg-green-500',
    desc: 'BPI / BDO / etc.',
    fee: 0.1,
  },
];

const QRPlaceholder = ({ label }) => (
  <div className="w-48 h-48 mx-auto rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2">
    <QrCode className="w-12 h-12 text-slate-400 dark:text-slate-500" />
    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Scan to pay</span>
    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{label}</span>
  </div>
);

const BankDetails = () => (
  <div className="space-y-3 bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">Bank</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">BPI</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">Account Name</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">MuntiCares Health Inc.</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">Account Number</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">1234-5678-9012</span>
    </div>
  </div>
);

const PaymentModal = ({ isOpen, onClose, request, onPaymentComplete }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [copied, setCopied] = useState(false);

  const amount = Number(request?.amount || 0);
  const platformFee = Math.round(amount * 0.1 * 100) / 100;
  const totalCharge = amount + platformFee;

  const handlePay = async () => {
    if (!selectedMethod || !request) return;
    setProcessing(true);

    try {
      const isBank = selectedMethod === 'bank_transfer';
      const fee = isBank ? 0 : platformFee;
      const payout = isBank ? amount : amount - fee;

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert([{
          request_id: request.id,
          patient_id: request.patientId,
          provider_id: request.providerId,
          amount: amount,
          payment_method: selectedMethod,
          status: 'paid',
          platform_fee: fee,
          provider_payout: payout,
          paid_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (txError) throw txError;

      const { error: reqError } = await supabase
        .from('requests')
        .update({ payment_status: 'paid' })
        .eq('id', request.id);

      if (reqError) throw reqError;

      setLastTx({ ...txData, providerName: request.providerName });

      if (!isBank) {
        toast.success('Payment successful! Amount held in escrow.');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
      } else {
        toast.success('Bank transfer initiated. Amount held in escrow.');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
      }

      setShowReceipt(true);
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (showReceipt) {
      setShowReceipt(false);
      setLastTx(null);
      setSelectedMethod(null);
      onPaymentComplete('paid');
    }
    onClose();
  };

  const methodLabel = methods.find(m => m.id === selectedMethod)?.label || '';
  const receiptId = lastTx?.id ? `RCT-${lastTx.id.slice(0, 8).toUpperCase()}` : '';
  const paidDate = lastTx?.paid_at ? new Date(lastTx.paid_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

  const copyRef = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !processing) handleClose(); }}>
      <DialogContent className={`max-w-md p-8 ${showReceipt ? 'max-w-lg' : ''}`}>
        {!showReceipt ? (
          <>
            <DialogHeader>
              <DialogTitle>Complete Payment</DialogTitle>
              <DialogDescription>
                Secure your booking with <span className="font-bold text-primary">{request?.providerName}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                <p className="text-xs text-slate-400 uppercase font-bold">Service Fee</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  ₱{amount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-slate-400">Select Payment Method</p>
                <div className="grid grid-cols-3 gap-3">
                  {methods.map(method => {
                    const Icon = method.icon;
                    const isSelected = selectedMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method.color} text-white`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                          {method.label}
                        </span>
                        <span className="text-2xs text-slate-400">{method.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedMethod === 'gcash' && (
                <div className="space-y-3 text-center">
                  <QRPlaceholder label="GCash" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open your GCash app and scan the QR code to pay.
                  </p>
                </div>
              )}

              {selectedMethod === 'maya' && (
                <div className="space-y-3 text-center">
                  <QRPlaceholder label="Maya" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Open your Maya app and scan the QR code to pay.
                  </p>
                </div>
              )}

              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <BankDetails />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyRef('1234-5678-9012')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex-1"
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy Account No.'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Transfer the total amount and your booking will be confirmed.
                  </p>
                </div>
              )}

              {selectedMethod && selectedMethod !== 'bank_transfer' && (
                <div className="space-y-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Service Fee</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">₱{amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Platform Fee (10%)</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">₱{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex justify-between text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Total Charge</span>
                    <span className="font-bold text-green-600 dark:text-green-400">₱{totalCharge.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Service Fee</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">₱{amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Platform Fee</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">₱0.00</span>
                  </div>
                  <div className="border-t border-blue-200 dark:border-blue-800 pt-2 flex justify-between text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Amount to Transfer</span>
                    <span className="font-bold text-green-600 dark:text-green-400">₱{amount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={handleClose} disabled={processing}>
                  Cancel
                </Button>
                <Button onClick={handlePay} disabled={!selectedMethod || processing}>
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Confirm Payment</>
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ReceiptIcon className="w-5 h-5 text-primary" />
                Payment Receipt
              </DialogTitle>
              <DialogDescription>
                Transaction completed successfully
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-center py-4 bg-green-50 dark:bg-green-900/30 rounded-2xl border border-green-100 dark:border-green-900/50">
                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">Payment Successful</p>
              </div>

              <div className="space-y-2 bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Receipt No.</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-xs">{receiptId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Provider</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{lastTx?.providerName || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Payment Method</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">{methodLabel}</span>
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
                Amount held in escrow until service is completed.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => {
                  window.print();
                }}>
                  <ReceiptIcon className="w-4 h-4" /> Download
                </Button>
                <Button onClick={() => {
                  setShowReceipt(false);
                  setLastTx(null);
                  setSelectedMethod(null);
                  onPaymentComplete('paid');
                  onClose();
                }}>
                  <Check className="w-4 h-4" /> Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
