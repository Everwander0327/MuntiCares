import { useEffect, useId, useRef, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { geocodeAddress } from '../services/geocoding';
import { useLanguage } from '@/contexts/LanguageContext';

const MUNTINLUPA_BARANGAYS = [
  { name: 'Alabang', lat: 14.4258, lng: 121.0422 },
  { name: 'Ayala Alabang', lat: 14.4312, lng: 121.0289 },
  { name: 'Bayanan', lat: 14.4089, lng: 121.0493 },
  { name: 'Buli', lat: 14.4485, lng: 121.0494 },
  { name: 'Cupang', lat: 14.4362, lng: 121.0498 },
  { name: 'Poblacion', lat: 14.3916, lng: 121.0415 },
  { name: 'Putatan', lat: 14.4013, lng: 121.0418 },
  { name: 'Sucat', lat: 14.4552, lng: 121.0487 },
  { name: 'Tunasan', lat: 14.3752, lng: 121.0456 },
];

const POPULAR_LANDMARKS = [
  { name: 'Ayala Alabang Village', sub: 'Brgy. Ayala Alabang', lat: 14.4295, lng: 121.0261 },
  { name: 'Victoria Homes', sub: 'Brgy. Tunasan', lat: 14.3685, lng: 121.0312 },
  { name: "Soldier's Hills", sub: 'Brgy. Putatan', lat: 14.4022, lng: 121.0345 },
  { name: 'Katarungan Village', sub: 'Brgy. Poblacion', lat: 14.3821, lng: 121.0256 },
  { name: 'Asian Hospital & Medical Center', sub: 'Filinvest, Alabang', lat: 14.4172, lng: 121.0428 },
  { name: 'Ospital ng Muntinlupa', sub: 'Filinvest, Alabang', lat: 14.4145, lng: 121.0436 },
  { name: 'Muntinlupa City Hall', sub: 'Brgy. Putatan', lat: 14.4012, lng: 121.0417 },
  { name: 'Festival Supermall', sub: 'Filinvest, Alabang', lat: 14.4178, lng: 121.0405 },
  { name: 'Northgate Cyberzone', sub: 'Filinvest, Alabang', lat: 14.4234, lng: 121.0382 },
];

const DEBOUNCE_MS = 300;

export default function AddressAutocomplete({ id, onSelect, initialQuery = '', inputWrapperClassName = '' }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestId = useRef(0);
  const listboxId = useId();
  const fallbackInputId = useId();
  const inputId = id || fallbackInputId;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const search = (text, reqId) => {
    const qLower = text.toLowerCase();
    const matchedLandmarks = POPULAR_LANDMARKS.filter(
      (l) => l.name.toLowerCase().includes(qLower) || l.sub.toLowerCase().includes(qLower)
    ).map((l) => ({
      lat: l.lat,
      lng: l.lng,
      displayName: `${l.name}, ${l.sub}, Muntinlupa City`,
      tag: t('tracking.address.tagLandmark'),
    }));

    const matchedBarangays = MUNTINLUPA_BARANGAYS.filter(
      (b) => b.name.toLowerCase().includes(qLower)
    ).map((b) => ({
      lat: b.lat,
      lng: b.lng,
      displayName: `Brgy. ${b.name}, Muntinlupa City`,
      tag: t('tracking.address.tagBarangay'),
    }));

    const local = [...matchedLandmarks, ...matchedBarangays];

    setResults(local);
    setHasSearched(true);
    setIsOpen(true);
    setActiveIndex(local.length ? 0 : -1);

    geocodeAddress(text)
      .then((remoteHit) => {
        if (reqId !== requestId.current) return;
        if (remoteHit && !local.some((c) => Math.abs(c.lat - remoteHit.lat) < 0.001)) {
          setResults((prev) => [
            ...prev,
            {
              lat: remoteHit.lat,
              lng: remoteHit.lng,
              displayName: remoteHit.displayName,
              tag: t('tracking.address.tagStreet'),
            },
          ]);
          setActiveIndex((index) => (index === -1 ? 0 : index));
        }
      })
      .catch(() => {
        /* offline or rate limited; local matches still apply */
      })
      .finally(() => {
        if (reqId === requestId.current) setLoading(false);
      });
  };

  const handleChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setActiveIndex(-1);
    clearTimeout(debounceTimer.current);
    const reqId = ++requestId.current;

    if (!text.trim()) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(false);
    setIsOpen(true);
    debounceTimer.current = setTimeout(() => {
      search(text, reqId);
    }, DEBOUNCE_MS);
  };

  const selectResult = (item) => {
    clearTimeout(debounceTimer.current);
    requestId.current += 1;
    setLoading(false);
    setQuery(item.displayName);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect?.({
      lat: item.lat,
      lng: item.lng,
      displayName: item.displayName,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setActiveIndex(-1);
      }
      return;
    }

    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    }
  };

  const showPanel = isOpen && Boolean(query.trim()) && (loading || hasSearched);
  const showEmpty = showPanel && !loading && hasSearched && results.length === 0;

  return (
    <div ref={containerRef} className="relative w-full z-30">
      <div className={`neu-inset min-h-[48px] pl-3.5 pr-1 py-1 rounded-xl flex items-center gap-2 border border-field focus-within:ring-2 focus-within:ring-[var(--focus-ring)] ${inputWrapperClassName}`}>
        <MagnifyingGlass className="w-4 h-4 text-link shrink-0 pointer-events-none" aria-hidden="true" />
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t('tracking.address.ariaCombo')}
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listboxId : undefined}
          aria-activedescendant={
            showPanel && activeIndex >= 0 && results[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (query.trim() && (results.length || loading)) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('tracking.address.placeholder')}
          className="w-full py-2 bg-transparent text-base sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-tertiary placeholder:font-normal focus:outline-none min-w-0"
        />
        {query ? (
          <button
            type="button"
            aria-label={t('tracking.address.clearAria')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              requestId.current += 1;
              clearTimeout(debounceTimer.current);
              setQuery('');
              setResults([]);
              setLoading(false);
              setIsOpen(false);
              setHasSearched(false);
              inputRef.current?.focus();
            }}
            className="inline-flex min-w-[44px] min-h-[44px] w-11 h-11 items-center justify-center bg-transparent border-0 shadow-none text-tertiary hover:text-ink dark:hover:text-white shrink-0 cursor-pointer rounded-lg"
          >
            <X className="w-4 h-4" weight="bold" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Search Suggestions Dropdown */}
      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-1.5 neu-flat border border-surface-border rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-30">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-[max(0.75rem,12px)] font-semibold text-tertiary" role="status">
              {t('tracking.address.searching')}
            </p>
          ) : showEmpty ? (
            <p className="px-4 py-3 text-[max(0.75rem,12px)] font-semibold text-tertiary" role="status">
              {t('tracking.address.noMatches')}
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label={t('tracking.address.suggestionsAria')} className="divide-y divide-slate-200/60 dark:divide-white/5">
              {results.map((item, idx) => (
                <li
                  key={`${item.lat}-${item.lng}-${idx}`}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectResult(item)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? 'bg-primary/10 dark:bg-primary/20'
                      : 'hover:bg-slate-200/40 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[max(0.75rem,12px)] font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {item.displayName.split(',')[0]}
                    </p>
                    <p className="text-[max(0.75rem,12px)] text-tertiary font-medium truncate">
                      {item.displayName}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-link text-2xs font-extrabold uppercase tracking-wider shrink-0">
                    {item.tag || t('tracking.address.tagSelect')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
