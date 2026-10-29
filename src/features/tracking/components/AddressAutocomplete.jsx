import { useEffect, useId, useRef, useState } from 'react';
import { Search, MapPin, X, Loader2, Building, Home } from 'lucide-react';
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
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
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
      isLandmark: true,
    }));

    const matchedBarangays = MUNTINLUPA_BARANGAYS.filter(
      (b) => b.name.toLowerCase().includes(qLower)
    ).map((b) => ({
      lat: b.lat,
      lng: b.lng,
      displayName: `Brgy. ${b.name}, Muntinlupa City`,
      isBarangay: true,
    }));

    const local = [...matchedLandmarks, ...matchedBarangays];

    // Show local matches at once; the remote lookup only appends to them.
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
              isRemote: true,
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
    clearTimeout(debounceTimer.current);

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
      const id = requestId.current + 1;
      requestId.current = id;
      search(text, id);
    }, DEBOUNCE_MS);
  };

  const selectResult = (item) => {
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
    <div ref={containerRef} className="relative w-full z-[600]">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-tertiary pointer-events-none" />
        <input
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
            if (results.length || loading) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Let option clicks land before closing.
            setTimeout(() => setIsOpen(false), 120);
          }}
          placeholder="Search street, subdivision, or landmark in Muntinlupa…"
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        />
        {loading ? (
          <Loader2 className="absolute right-3 w-4 h-4 text-link animate-spin" />
        ) : query ? (
          <button
            type="button"
            aria-label="Clear address search"
            onClick={() => {
              requestId.current += 1;
              clearTimeout(debounceTimer.current);
              setQuery('');
              setResults([]);
              setLoading(false);
              setIsOpen(false);
              setHasSearched(false);
            }}
            className="absolute right-0 flex h-11 w-11 items-center justify-center text-tertiary hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto z-[700]">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-xs font-semibold text-tertiary" role="status">
              Searching Muntinlupa…
            </p>
          ) : showEmpty ? (
            <p className="px-4 py-3 text-xs font-semibold text-tertiary" role="status">
              No matches in Muntinlupa. Try a nearby landmark, or drag the map to set the pin.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Address suggestions">
              {results.map((item, idx) => (
                <li
                  key={`${item.lat}-${item.lng}-${idx}`}
                  id={`${listboxId}-option-${idx}`}
                  role="option"
                  aria-selected={idx === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectResult(item)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors ${
                    idx === activeIndex
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-link shrink-0">
                    {item.isLandmark ? (
                      <Building className="w-3.5 h-3.5" />
                    ) : item.isBarangay ? (
                      <Home className="w-3.5 h-3.5" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.displayName.split(',')[0]}
                    </p>
                    <p className="text-xs text-tertiary font-semibold truncate">
                      {item.displayName}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
