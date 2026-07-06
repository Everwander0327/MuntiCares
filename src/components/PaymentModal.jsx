import { useState } from 'react';
import { X, Smartphone, Building2, Check, QrCode, Copy, CheckCheck, Receipt as ReceiptIcon } from 'lucide-react';

const methods = [
  { id: 'gcash', label: 'GCash', icon: Smartphone, color: 'bg-blue-500', desc: 'Pay via GCash' },
  { id: 'maya', label: 'Maya', icon: Smartphone, color: 'bg-red-500', desc: 'Pay via Maya' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2, color: 'bg-green-500', desc: 'BPI / BDO / etc.' },
];

const QRPlaceholder = ({ label }) => (
  <div className="w-48 h-48 mx-auto rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2">
    <QrCode className="w-12 h-12 text-slate-400" />
    <span className="text-xs font-medium text-slate-400">Scan to pay</span>
    <span className="text-xs font-bold text-slate-400">{label}</span>
  </div>
);

const BankDetails = () => (
  <div className="space-y-3 bg-slate-50 rounded-xl p-4">
    <div className="flex justify-between text-sm"><span className="text-slate-500">Bank</span><span className="font-semibold text-slate-900">BPI</span></div>
    <div className="flex justify-between text-sm"><span className="text-slate-500">Account Name</span><span className="font-semibold text-slate-900">MuntiCares Health Inc.</span></div>
    <div className="flex justify-between text-sm"><span className="text-slate-500">Account Number</span><span className="font-semibold text-slate-900 font-mono">1234-5678-9012</span></div>
  </div>
);

const PaymentModal = ({ isOpen, onClose, request }) => {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const amount = 1500;
  const platformFee = 150;
  const totalCharge = amount + platformFee;

  const receiptId = 'RCT-DEMO-001';
  const paidDate = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const handlePay = () => setShowReceipt(true);

  const methodLabel = methods.find(m => m.id === selectedMethod)?.label || '';
  const MethodIcon = methods.find(m => m.id === selectedMethod)?.icon || ReceiptIcon;

  const copyRef = () => {
    navigator.clipboard.writeText('1234-5678-9012');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">{showReceipt ? 'Payment Receipt' : 'Complete Payment'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {!showReceipt ? (
            <>
              <div className="text-center py-4 bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-400 uppercase font-bold">Service Fee</p>
                <p className="text-3xl font-bold text-slate-900">₱{amount.toLocaleString()}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-slate-400">Select Payment Method</p>
                <div className="grid grid-cols-3 gap-3">
                  {methods.map(method => {
                    const Icon = method.icon;
                    const isSelected = selectedMethod === method.id;
                    return (
                      <button key={method.id} onClick={() => setSelectedMethod(method.id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method.color} text-white`}><Icon className="w-5 h-5" /></div>
                        <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-slate-600'}`}>{method.label}</span>
                        <span className="text-2xs text-slate-400">{method.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedMethod === 'gcash' && <div className="space-y-3 text-center"><QRPlaceholder label="GCash" /><p className="text-xs text-slate-500">Open GCash and scan the QR code to pay.</p></div>}
              {selectedMethod === 'maya' && <div className="space-y-3 text-center"><QRPlaceholder label="Maya" /><p className="text-xs text-slate-500">Open Maya and scan the QR code to pay.</p></div>}
              {selectedMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <BankDetails />
                  <button onClick={copyRef} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 w-full">
                    {copied ? <CheckCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Account No.'}
                  </button>
                </div>
              )}

              {selectedMethod && (
                <div className="space-y-2 bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Service Fee</span><span className="font-semibold text-slate-900">₱{amount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee (10%)</span><span className="font-semibold text-blue-600">₱{platformFee.toLocaleString()}</span></div>
                  <div className="border-t border-blue-200 pt-2 flex justify-between text-sm"><span className="font-bold text-slate-700">Total</span><span className="font-bold text-green-600">₱{totalCharge.toLocaleString()}</span></div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={onClose} className="py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">Cancel</button>
                <button onClick={handlePay} disabled={!selectedMethod} className="py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Confirm Payment</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-100">
                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2"><Check className="w-6 h-6" /></div>
                <p className="text-lg font-bold text-green-700">Payment Successful</p>
              </div>

              <div className="space-y-2 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-slate-400">Receipt No.</span><span className="font-bold font-mono text-slate-900 text-xs">{receiptId}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Provider</span><span className="font-semibold text-slate-900">{request?.provider || request?.patient || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Payment Method</span><span className="font-semibold text-slate-900 capitalize flex items-center gap-1.5"><MethodIcon className="w-3.5 h-3.5 text-primary" /> {methodLabel || '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Date</span><span className="font-semibold text-slate-900">{paidDate}</span></div>
              </div>

              <div className="space-y-2 bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Service Fee</span><span className="font-semibold text-slate-900">₱{amount.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Platform Fee (10%)</span><span className="font-semibold text-blue-600">₱{platformFee.toLocaleString()}</span></div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm"><span className="font-bold text-slate-700">Total Charged</span><span className="font-bold text-green-600">₱{totalCharge.toLocaleString()}</span></div>
              </div>

              <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
