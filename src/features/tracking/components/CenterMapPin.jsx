import { useLanguage } from '@/contexts/LanguageContext';

/**
 * CenterMapPin — "Care Home Beacon"
 * Custom MuntiCares stationary center-screen pin:
 * - Floating primary squircle badge with a Home Roof + Heart emblem
 * - Tapered precision stem whose tip is anchored at the exact map center (50%, 50%)
 * - Two-state visual: subdued before placement (`confirmed=false`), active with
 *   pulsing radar ring once placed (`confirmed=true`)
 */
export default function CenterMapPin({
  isPanning,
  loading,
  confirmed = true,
  hideLabel = false,
  centerOffsetY = 0,
}) {
  const { t } = useLanguage();
  const centerTop = centerOffsetY ? `calc(50% + ${centerOffsetY}px)` : '50%';
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 select-none"
      aria-hidden="true"
    >
      {/* Ground Radar Anchor Wrapper — keeps translate(-50%, -50%) isolated from animate-ping scale() */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ top: centerTop }}
      >
        {/* Pulsing Ground Radar Ring only when pin is confirmed */}
        {confirmed && !isPanning && (
          <span
            className="absolute w-7 h-7 rounded-full border border-primary/50 dark:border-primary-400/50 bg-primary/15 animate-ping"
            style={{ animationDuration: '2.2s' }}
          />
        )}

        {/* Secondary Target Halo (circular so it reads as the stem's anchor ring) */}
        <span
          className={`rounded-full border transition-all duration-200 ${
            isPanning
              ? 'w-4 h-4 border-primary/70 dark:border-primary-400/80 bg-primary/10 scale-90'
              : confirmed
                ? 'w-6 h-6 border-primary/35 dark:border-primary-400/40 bg-primary/10 scale-100'
                : 'w-6 h-6 border-dashed border-slate-400/70 dark:border-slate-500/70 bg-slate-400/10 scale-100'
          }`}
        />
      </div>

      {/* Dynamic Ground Shadow — centered on the true map center */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-950/40 blur-[2px] transition-all duration-200 ${
          isPanning ? 'w-3 opacity-30 scale-75' : 'w-5 opacity-75 scale-100'
        }`}
        style={{ top: centerTop }}
      />

      {/* Caption + Care Home Beacon stack; bottom edge (stem tip) sits on exact map center */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-full flex w-full flex-col items-center px-3"
        style={{ top: centerTop }}
      >
        {/* Compact Squircle Status Badge ONLY while panning or loading */}
        {!hideLabel && (isPanning || loading) && (
          <div
            className="mb-2 max-w-[15rem] px-2.5 py-1 rounded-xl text-xs font-bold shadow-md backdrop-blur-md transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap bg-slate-900/90 text-white border border-white/15"
          >
            <span className="truncate">
              {loading ? t('tracking.pin.locating') : t('tracking.pin.release')}
            </span>
          </div>
        )}

        {/* Care Home Beacon SVG (Squircle Badge + Roof/Heart + Precision Stem) */}
        <div
          className={`relative transition-all duration-200 ease-out ${
            isPanning
              ? '-translate-y-3.5 scale-105 opacity-100'
              : confirmed
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-0 scale-95 opacity-80 saturate-75'
          }`}
          style={{
            filter: 'drop-shadow(0 8px 14px rgba(15, 23, 42, 0.32))',
            transformOrigin: 'bottom center',
          }}
        >
          <svg
            viewBox="0 0 44 56"
            width="44"
            height="56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="block"
          >
            <defs>
              {/* Theme Primary Squircle Gradient */}
              <linearGradient
                id="mcBeaconBg"
                x1="6"
                y1="2"
                x2="38"
                y2="38"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="rgb(var(--primary-mid-rgb))" />
                <stop offset="0.55" stopColor="rgb(var(--primary-rgb))" />
                <stop offset="1" stopColor="rgb(var(--primary-hover-rgb))" />
              </linearGradient>

              {/* Top Specular Gloss */}
              <linearGradient
                id="mcBeaconGloss"
                x1="22"
                y1="3"
                x2="22"
                y2="20"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="white" stopOpacity="0.32" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </linearGradient>

              {/* Precision Stem Gradient */}
              <linearGradient
                id="mcBeaconStem"
                x1="22"
                y1="36"
                x2="22"
                y2="55"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="rgb(var(--primary-hover-rgb))" />
                <stop offset="1" stopColor="rgb(var(--primary-rgb))" />
              </linearGradient>
            </defs>

            {/* Tapered Precision Stem (connects squircle bottom to exact tip at y=55) */}
            <path
              d="M19.2 35.5H24.8L23.1 53.8C23.0 54.6 22.55 55.2 22 55.2C21.45 55.2 21.0 54.6 20.9 53.8L19.2 35.5Z"
              fill="url(#mcBeaconStem)"
            />
            {/* Stem Collar Ring */}
            <rect
              x="17.5"
              y="35"
              width="9"
              height="3"
              rx="1.5"
              fill="white"
            />

            {/* Outer White Halo Squircle */}
            <rect
              x="4"
              y="2"
              width="36"
              height="35"
              rx="12"
              fill="white"
            />

            {/* Main Theme Primary Squircle Body */}
            <rect
              x="6"
              y="4"
              width="32"
              height="31"
              rx="10"
              fill="url(#mcBeaconBg)"
            />

            {/* Subtle Top Inner Highlight */}
            <rect
              x="7.5"
              y="5.5"
              width="29"
              height="14"
              rx="8.5"
              fill="url(#mcBeaconGloss)"
            />

            {/* Home Roofline Arch */}
            <path
              d="M12.5 19.2L22 11.2L31.5 19.2"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Caring Heart + Cross Emblem inside the Home */}
            <path
              d="M22 28.8C22 28.8 15.2 24.5 15.2 20.1C15.2 18.1 16.75 16.6 18.65 16.6C19.88 16.6 21.05 17.25 22 18.35C22.95 17.25 24.12 16.6 25.35 16.6C27.25 16.6 28.8 18.1 28.8 20.1C28.8 24.5 22 28.8 22 28.8Z"
              fill="white"
            />
            {/* Subtle Medical Cross Cutout inside Heart */}
            <path
              d="M22 19.6V24.4M19.6 22H24.4"
              stroke="rgb(var(--primary-rgb))"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Exact Center Reticle Dot */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm ${
          confirmed ? 'bg-primary dark:bg-primary-400' : 'bg-slate-500 dark:bg-slate-400'
        }`}
        style={{ top: centerTop }}
      />
    </div>
  );
}
