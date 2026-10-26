import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Download, Upload, Globe, Loader2, X } from 'lucide-react';
import { uploadToHapiFhir } from '@/lib/fhir';
import toast from 'react-hot-toast';

const FhirExportModal = ({ open, onClose, bundle, patientName }) => {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const json = useMemo(() => {
    if (!open || !bundle) return '';
    return JSON.stringify(bundle, null, 2);
  }, [open, bundle]);

  // Lock background scroll and handle Escape key when open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
        setUploadResult(null);
        setCopied(false);
      }
    };
    if (open) {
      document.body.classList.add('modal-open');
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patientName?.replace(/\s+/g, '_') || 'patient'}_FHIR_Bundle.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadToHapiFhir(bundle);
      const patientId = bundle.entry?.[0]?.resource?.id || 'patient';
      const okCount = result.entry?.filter(e => String(e.response?.status || '').startsWith('2')).length || 0;
      const totalCount = result.entry?.length || 0;

      const hapiUrl = `https://hapi.fhir.org/baseR4/Patient/${patientId}`;
      setUploadResult({
        success: true,
        message: `Uploaded! ${okCount}/${totalCount} resources saved.`,
        url: hapiUrl,
      });
      toast.success('Data uploaded to HAPI FHIR!');
    } catch (err) {
      setUploadResult({
        success: false,
        message: err.message,
      });
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setUploadResult(null);
    setCopied(false);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-slate-950/70 sm:backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
          />

          {/* Neumorphic Modal Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fhir-modal-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-3xl h-[92dvh] sm:h-[82vh] max-h-[92dvh] sm:max-h-[82vh] neu-flat bg-[#ebf1f8] dark:bg-[#172236] rounded-t-[2.25rem] sm:rounded-[2.25rem] flex flex-col overflow-hidden z-[10000] border-t sm:border border-white/70 dark:border-white/10 shadow-2xl transform-gpu will-change-transform pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {/* Mobile Drag Indicator Bar */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/60 dark:border-white/5 shrink-0">
              <div className="min-w-0">
                <h2 id="fhir-modal-title" className="font-display font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  FHIR R4 Export
                </h2>
                {patientName && (
                  <p className="text-xs text-tertiary dark:text-tertiary mt-0.5 truncate font-semibold">
                    {patientName}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="neu-btn w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-tertiary hover:text-danger dark:text-tertiary dark:hover:text-red-400 transition-colors shrink-0 cursor-pointer active:scale-95"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Code / JSON Viewer Body */}
            <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-hidden flex flex-col">
              <div 
                tabIndex={0}
                className="neu-inset rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain select-text font-mono text-xs leading-relaxed outline-none focus:outline-none"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  contain: 'content'
                }}
              >
                <pre className="text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap break-words [word-break:break-word] text-xs leading-relaxed">
                  {json || '// No data available'}
                </pre>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-white/60 dark:border-white/5 shrink-0 space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="neu-btn px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-xs text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-success stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="neu-btn px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-xs text-slate-700 dark:text-slate-200 hover:text-link transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="neu-btn-primary px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs sm:text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer active:scale-95 shadow-md w-full sm:w-auto"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploading ? 'Uploading...' : 'Upload to HAPI FHIR'}</span>
                </button>
              </div>

              {/* Upload Result Feedback */}
              {uploadResult && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`neu-flat p-2.5 sm:p-3 rounded-2xl text-xs flex items-start gap-2.5 border ${
                    uploadResult.success
                      ? 'border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'border-rose-500/30 text-rose-800 dark:text-danger-dark'
                  }`}
                >
                  {uploadResult.success ? (
                    <div className="neu-flat-sm w-6 h-6 rounded-lg flex items-center justify-center text-success shrink-0 mt-0.5">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="neu-flat-sm w-6 h-6 rounded-lg flex items-center justify-center text-danger shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-xs sm:text-xs leading-snug">{uploadResult.message}</p>
                    {uploadResult.success && uploadResult.url && (
                      <a
                        href={uploadResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline mt-0.5 block font-mono text-link hover:text-primary-600 transition-colors break-all"
                      >
                        {uploadResult.url}
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadResult(null)}
                    className="neu-btn w-6 h-6 rounded-lg flex items-center justify-center text-tertiary hover:text-danger transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default FhirExportModal;
