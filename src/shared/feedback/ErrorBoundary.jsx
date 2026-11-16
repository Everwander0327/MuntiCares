import React from 'react';
import { Warning, ArrowsClockwise } from '@phosphor-icons/react';
import { getStoredLanguage, isPortalPath, translate } from '@/i18n';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const pathname = typeof window !== 'undefined' ? window.location?.pathname || '' : '';
      const lang = isPortalPath(pathname) ? getStoredLanguage() : 'en';
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm dark:shadow-slate-900/50 p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Warning className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {translate(lang, 'common.error.title')}
            </h2>
            <p className="text-sm text-tertiary dark:text-tertiary mb-6">
              {this.state.error?.message || translate(lang, 'common.error.fallback')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors"
            >
              <ArrowsClockwise className="w-4 h-4" />
              {translate(lang, 'common.actions.reloadPage')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
