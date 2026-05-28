import { useState } from 'react';
import { Wallet, CreditCard, Banknote, Check, Loader2, X } from 'lucide-react';
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
  { id: 'gcash', label: 'GCash', icon: Wallet, color: 'bg-emerald-500', desc: 'Pay via GCash app' },
  { id: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-500', desc: 'Credit or debit card' },
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-amber-500', desc: 'Pay during visit' },
];

const PaymentModal = ({ isOpen, onClose, request, onPaymentComplete }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!selectedMethod || !request) return;
    setProcessing(true);

    try {
      if (selectedMethod === 'gcash' || selectedMethod === 'card') {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { error: txError } = await supabase
          .from('transactions')
          .insert([{
            request_id: request.id,
            patient_id: request.patientId,
            provider_id: request.providerId,
            amount: request.amount,
            payment_method: selectedMethod,
            status: 'paid',
            paid_at: new Date().toISOString(),
          }]);

        if (txError) throw txError;

        const { error: reqError } = await supabase
          .from('requests')
          .update({ payment_status: 'paid' })
          .eq('id', request.id);

        if (reqError) throw reqError;

        toast.success('Payment successful!');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
        onPaymentComplete('paid');
      } else if (selectedMethod === 'cash') {
        const { error: txError } = await supabase
          .from('transactions')
          .insert([{
            request_id: request.id,
            patient_id: request.patientId,
            provider_id: request.providerId,
            amount: request.amount,
            payment_method: 'cash',
            status: 'pending_cash',
          }]);

        if (txError) throw txError;

        const { error: reqError } = await supabase
          .from('requests')
          .update({ payment_status: 'pending_cash' })
          .eq('id', request.id);

        if (reqError) throw reqError;

        toast.success('Cash payment noted. Pay the provider during your visit.');
        onPaymentComplete('pending_cash');
      }
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
              ₱{Number(request?.amount || 0).toLocaleString()}
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
                    <span className="text-2xs text-slate-400 hidden md:block">{method.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedMethod === 'cash' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center bg-amber-50 dark:bg-amber-900/30 p-3 rounded-xl">
              Pay in cash directly to the provider during your visit.
            </p>
          )}
          {selectedMethod === 'gcash' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">
              Simulated payment — your account won't be charged.
            </p>
          )}
          {selectedMethod === 'card' && (
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl">
              Simulated payment — your card won't be charged.
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
