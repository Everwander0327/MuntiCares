import { useEffect, useId, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { geocodeAddress } from '../services/geocoding';

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

export default function AddressAutocomplete({ onSelect, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showBarangayDrawer, setShowBarangayDrawer] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestId = useRef(0);
  const listboxId = useId();

  useEffect(() => {
    if (initialQuery) {
      setQuery((prev) => (initialQuery !== prev ? initialQuery : prev));
    }
  }, [initialQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowBarangayDrawer(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const search = (text, id) => {
    const qLower = text.toLowerCase();
    const matchedLandmarks = POPULAR_LANDMARKS.filter(
      (l) => l.name.toLowerCase().includes(qLower) || l.sub.toLowerCase().includes(qLower)
    ).map((l) => ({
      lat: l.lat,
      lng: l.lng,
      displayName: `${l.name}, ${l.sub}, Muntinlupa City`,
      tag: 'Landmark',
    }));

    const matchedBarangays = MUNTINLUPA_BARANGAYS.filter(
      (b) => b.name.toLowerCase().includes(qLower)
    ).map((b) => ({
      lat: b.lat,
      lng: b.lng,
      displayName: `Brgy. ${b.name}, Muntinlupa City`,
      tag: 'Barangay',
    }));

    const local = [...matchedLandmarks, ...matchedBarangays];

    setResults(local);
    setHasSearched(true);
    setIsOpen(true);
    setActiveIndex(local.length ? 0 : -1);

    geocodeAddress(text)
      .then((remoteHit) => {
        if (id !== requestId.current) return;
        if (remoteHit && !local.some((c) => Math.abs(c.lat - remoteHit.lat) < 0.001)) {
          setResults((prev) => [
            ...prev,
            {
              lat: remoteHit.lat,
              lng: remoteHit.lng,
              displayName: remoteHit.displayName,
              tag: 'Street',
            },
          ]);
          setActiveIndex((index) => (index === -1 ? 0 : index));
        }
      })
      .catch(() => {
        /* offline or rate limited; local matches still apply */
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };

  const handleChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setActiveIndex(-1);
    setShowBarangayDrawer(false);
    clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      setHasSearched(false);
      setShowBarangayDrawer(true);
      return;
    }

    setLoading(true);
    setHasSearched(false);
    setIsOpen(true);
    debounceTimer.current = setTimeout(() => {
      const id = requestId.current + 1;
      requestId.current = id;
      search(text, id);
    }, DEBOUNCE_MS);
  };

  const selectResult = (item) => {
    setQuery(item.displayName);
    setIsOpen(false);
    setShowBarangayDrawer(false);
    setActiveIndex(-1);
    onSelect?.({
      lat: item.lat,
      lng: item.lng,
      displayName: item.displayName,
    });
  };

  const selectBarangay = (b) => {
    const displayName = `Brgy. ${b.name}, Muntinlupa City`;
    setQuery(displayName);
    setShowBarangayDrawer(false);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect?.({
      lat: b.lat,
      lng: b.lng,
      displayName,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isOpen || showBarangayDrawer) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setShowBarangayDrawer(false);
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
    <div ref={containerRef} className="relative w-full z-[600] space-y-2">
      <div className="neu-inset px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/60 dark:border-white/5">
        <Search className="w-4 h-4 text-link shrink-0 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search street, subdivision, or landmark"
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
            if (results.length || loading) {
              setIsOpen(true);
            } else if (!query.trim()) {
              setShowBarangayDrawer(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search street, subdivision, or barangay in Muntinlupa…"
          className="w-full py-1.5 bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-tertiary placeholder:font-normal focus:outline-none min-w-0"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-link animate-spin shrink-0" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear address search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              requestId.current += 1;
              clearTimeout(debounceTimer.current);
              setQuery('');
              setResults([]);
              setLoading(false);
              setIsOpen(false);
              setHasSearched(false);
              setShowBarangayDrawer(true);
              inputRef.current?.focus();
            }}
            className="neu-btn w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-danger shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setShowBarangayDrawer((prev) => !prev);
            setIsOpen(false);
          }}
          className={`neu-btn px-2.5 py-1.5 rounded-lg text-2xs font-extrabold shrink-0 cursor-pointer transition-colors ${
            showBarangayDrawer ? 'text-link ring-1 ring-primary/30' : 'text-slate-700 dark:text-slate-200 hover:text-link'
          }`}
        >
          Barangays ▾
        </button>
      </div>

      {/* Quick Jump: Muntinlupa Barangays 3-Col Grid Drawer */}
      {showBarangayDrawer && (
        <div className="neu-flat rounded-2xl p-3 border border-white/80 dark:border-white/10 shadow-xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-2xs font-extrabold uppercase tracking-wider text-tertiary">
              Quick Jump · Muntinlupa Barangays
            </span>
            <button
              type="button"
              onClick={() => setShowBarangayDrawer(false)}
              className="text-2xs font-extrabold text-link hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MUNTINLUPA_BARANGAYS.map((b) => {
              const isCurrent = query.toLowerCase().includes(b.name.toLowerCase());
              return (
                <button
                  key={b.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectBarangay(b)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer truncate ${
                    isCurrent
                      ? 'bg-primary text-white font-extrabold'
                      : 'neu-flat-sm text-slate-700 dark:text-slate-200 hover:text-link'
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Suggestions Dropdown */}
      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-1.5 neu-flat border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-[700]">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-xs font-semibold text-tertiary" role="status">
              Searching Muntinlupa…
            </p>
          ) : showEmpty ? (
            <p className="px-4 py-3 text-xs font-semibold text-tertiary" role="status">
              No matches in Muntinlupa. Try selecting a barangay above, or drag the map to place the pin.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Address suggestions" className="divide-y divide-slate-200/60 dark:divide-white/5">
              {results.map((item, idx) => (
                <li
                  key={`${item.lat}-${item.lng}-${idx}`}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectResult(item)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? 'bg-primary/10 dark:bg-primary/20'
                      : 'hover:bg-slate-200/40 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {item.displayName.split(',')[0]}
                    </p>
                    <p className="text-xs text-tertiary font-medium truncate">
                      {item.displayName}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-link text-2xs font-extrabold uppercase tracking-wider shrink-0">
                    {item.tag || 'Select'}
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
