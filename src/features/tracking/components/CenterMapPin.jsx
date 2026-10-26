import { Loader2 } from 'lucide-react';

/**
 * CenterMapPin
 * Foodpanda / Grab style stationary center-screen pin.
 * The pin TIP is anchored exactly at the geometric center of the map viewport
 * (top: 50%, left: 50%) so it matches `map.getCenter()` precisely.
 * Elevates and shrinks shadow during map panning; drops with bounce on release.
 */
export default function CenterMapPin({ isPanning, addressPreview, loading }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[500] select-none"
      aria-hidden="true"
    >
      {/* Dynamic Ground Shadow — centered on the true map center */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-950/40 blur-[2px] transition-all duration-200 ${
          isPanning ? 'w-3 opacity-30 scale-75' : 'w-5 opacity-80 scale-100'
        }`}
      />

      {/* Caption + pin stack; bottom edge (pin tip) sits on the map center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
        {/* Minimal Address Caption above pin */}
        <div
          className={`mb-2.5 max-w-[80vw] sm:max-w-md px-3 py-1.5 rounded-lg text-2xs font-medium shadow-md backdrop-blur-md transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
            isPanning
              ? 'scale-95 opacity-70 bg-slate-900/85 text-white'
              : 'scale-100 opacity-100 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-200/70 dark:border-white/10'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
              <span className="truncate">Locating address…</span>
            </>
          ) : (
            <span className="truncate">
              {isPanning ? 'Release map to set pin' : addressPreview || 'Move map to adjust location'}
            </span>
          )}
        </div>

        {/* Center Pin Icon with lift-and-drop bounce */}
        <div
          className={`relative transition-all duration-200 ease-out ${
            isPanning ? '-translate-y-4 scale-105' : 'translate-y-0 scale-100'
          }`}
          style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.25))', transformOrigin: 'bottom center' }}
        >
          <svg
            viewBox="0 0 32 42"
            width="36"
            height="48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="block"
          >
            {/* Pin Body */}
            <path
              d="M16 0C7.16344 0 0 7.16344 0 16C0 27.2 14.4 40.8 15.04 41.4C15.56 41.88 16.44 41.88 16.96 41.4C17.6 40.8 32 27.2 32 16C32 7.16344 24.8366 0 16 0Z"
              fill="url(#pinGradient)"
            />
            {/* Inner Circle / Dot */}
            <circle cx="16" cy="16" r="6" fill="white" />
            <circle cx="16" cy="16" r="3.5" fill="#0284c7" />

            <defs>
              <linearGradient id="pinGradient" x1="0" y1="0" x2="32" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0ea5e9" />
                <stop offset="1" stopColor="#0284c7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Reticle target dot at the exact map center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary ring-2 ring-white/90 dark:ring-slate-900" />
    </div>
  );
}
