import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Copy, Check, Download, Upload, Globe, Loader2, FileCode, X } from 'lucide-react';
import { uploadToHapiFhir } from '../lib/fhir';
import toast from 'react-hot-toast';

const FhirExportModal = ({ open, onClose, bundle, patientName }) => {
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const json = bundle ? JSON.stringify(bundle, null, 2) : '';
  const lines = useMemo(() => json.split('\n'), [json]);

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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setUploadResult(null); } }}>
      <DialogContent hideClose className="max-w-2xl w-[94vw] p-0 overflow-hidden rounded-2xl md:rounded-[2rem]">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/40 text-primary rounded-lg md:rounded-xl shrink-0">
              <FileCode className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm md:text-base truncate">FHIR R4 Export</DialogTitle>
              <DialogDescription className="text-xs mt-0.5 truncate">
                {patientName} — {bundle?.entry?.length || 0} resources
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={() => { onClose(); setUploadResult(null); }}
            className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          </button>
        </div>

        <div className="max-h-[50vh] md:max-h-[55vh] overflow-auto bg-slate-50 dark:bg-slate-900 mx-3 md:mx-6 my-3 md:my-4 rounded-xl border border-slate-100 dark:border-slate-700">
          <table className="w-full text-[10px] md:text-xs font-mono leading-relaxed">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="text-right py-0 pr-2 md:pr-3 pl-1 md:pl-2 text-slate-400 dark:text-slate-600 select-none w-8 md:w-10 border-r border-slate-100 dark:border-slate-700 align-top">
                    {i + 1}
                  </td>
                  <td className="py-0 pl-2 md:pl-3 pr-1 md:pr-2 whitespace-pre text-slate-700 dark:text-slate-200 break-all">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 md:px-6 py-3 md:py-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleCopy}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
              <span className="sm:hidden">{copied ? 'Copied!' : 'Copy'}</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleDownload}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
            >
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">Download</span>
            </motion.button>

            <div className="hidden sm:block flex-1" />

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 w-full sm:w-auto justify-center"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
              {uploading ? 'Uploading...' : 'Upload to HAPI FHIR'}
            </motion.button>
          </div>

          {uploadResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 md:p-4 rounded-xl border text-xs md:text-sm ${
                uploadResult.success
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {uploadResult.success ? (
                  <Globe className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                ) : (
                  <X className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{uploadResult.message}</p>
                  {uploadResult.success && (
                    <a
                      href={uploadResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] md:text-xs underline mt-1 block hover:text-primary transition-colors break-all"
                    >
                      {uploadResult.url}
                    </a>
                  )}
                  {!uploadResult.success && (
                    <p className="text-[10px] md:text-xs mt-1 opacity-75 break-all">{uploadResult.message}</p>
                  )}
                </div>
                <button
                  onClick={() => setUploadResult(null)}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FhirExportModal;
