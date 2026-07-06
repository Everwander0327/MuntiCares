import { X } from 'lucide-react';

const ComingSoonModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5 text-slate-400" />
        </button>
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🚧</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Coming Soon!</h3>
        <p className="text-slate-500 text-sm mb-6">{message || 'This feature is not yet available.'}</p>
        <button onClick={onClose} className="px-8 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 transition-all">
          OK
        </button>
      </div>
    </div>
  );
};

export default ComingSoonModal;
