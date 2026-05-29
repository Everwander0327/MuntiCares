import { useState } from 'react';
import { Wallet, Banknote, Check, Loader2 } from 'lucide-react';
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
    id: 'simulated',
    label: 'Simulated',
    icon: Wallet,
    color: 'bg-blue-500',
    desc: 'Pay online (simulated)',
    fee: 0.1,
  },
  {
    id: 'cash',
    label: 'Cash',
    icon: Banknote,
    color: 'bg-amber-500',
    desc: 'Pay during visit',
    fee: 0,
  },
];

const PaymentModal = ({ isOpen, onClose, request, onPaymentComplete }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [processing, setProcessing] = useState(false);

  const amount = Number(request?.amount || 0);
  const platformFee = Math.round(amount * 0.1 * 100) / 100;
  const providerPayout = amount - platformFee;

  const handlePay = async () => {
    if (!selectedMethod || !request) return;
    setProcessing(true);

    try {
      const isSimulated = selectedMethod === 'simulated';
      const fee = isSimulated ? platformFee : 0;
      const payout = isSimulated ? providerPayout : amount;

      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          request_id: request.id,
          patient_id: request.patientId,
          provider_id: request.providerId,
          amount: amount,
          payment_method: isSimulated ? 'simulated' : 'cash',
          status: 'paid',
          platform_fee: fee,
          provider_payout: payout,
          paid_at: new Date().toISOString(),
        }]);

      if (txError) throw txError;

      const { error: reqError } = await supabase
        .from('requests')
        .update({ payment_status: 'paid' })
        .eq('id', request.id);

      if (reqError) throw reqError;

      if (isSimulated) {
        toast.success('Payment successful! Amount held in escrow.');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
      } else {
        toast.success('Cash payment noted. Pay the provider during your visit.');
      }

      onPaymentComplete('paid');
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !processing) onClose(); }}>
      <DialogContent className="max-w-md p-8">
        <DialogHeader>
          <DialogTitle>Complete Payment</DialogTitle>
          <DialogDescription>
            Secure your booking with <span className="font-bold text-primary">{request?.providerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
            <p className="text-xs text-slate-400 uppercase font-bold">Total</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              ₱{amount.toLocaleString()}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase text-slate-400">Select Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              {methods.map(method => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
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

          {selectedMethod === 'simulated' && (
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
                <span className="font-bold text-slate-700 dark:text-slate-300">Provider Receives</span>
                <span className="font-bold text-green-600 dark:text-green-400">₱{providerPayout.toLocaleString()}</span>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center">
                Simulated payment — your account won't be charged. Amount held until service is completed.
              </p>
            </div>
          )}

          {selectedMethod === 'cash' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl">
              Pay in cash directly to the provider during your visit. No platform fees.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handlePay} disabled={!selectedMethod || processing}>
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><Check className="w-4 h-4" /> {selectedMethod === 'cash' ? 'Confirm Cash' : 'Pay Now'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
