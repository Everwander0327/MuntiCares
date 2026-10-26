import { Loader2 } from 'lucide-react';

/**
 * CenterMapPin — "Care Home Beacon"
 * Custom MuntiCares stationary center-screen pin:
 * - Floating clinical-blue squircle badge with a Home Roof + Heart emblem
 * - Tapered precision stem whose tip is anchored at the exact map center (50%, 50%)
 * - Pulsing ground radar ring centered via wrapper so `animate-ping` scales from true center
 */
export default function CenterMapPin({ isPanning, addressPreview, loading }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[500] select-none"
      aria-hidden="true"
    >
      {/* Ground Radar Anchor Wrapper — keeps translate(-50%, -50%) isolated from animate-ping scale() */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
        {/* Pulsing Ground Radar Ring */}
        {!isPanning && (
          <span
            className="absolute w-8 h-8 rounded-full border border-[#2F6FB5]/55 dark:border-[#8CBDF0]/55 bg-[#2F6FB5]/15 animate-ping"
            style={{ animationDuration: '2.2s' }}
          />
        )}

        {/* Secondary Target Halo */}
        <span
          className={`rounded-full border transition-all duration-200 ${
            isPanning
              ? 'w-5 h-5 border-[#2F6FB5]/70 dark:border-[#8CBDF0]/80 bg-[#2F6FB5]/10 scale-90'
              : 'w-7 h-7 border-[#2F6FB5]/35 dark:border-[#8CBDF0]/40 bg-[#2F6FB5]/10 scale-100'
          }`}
        />
      </div>

      {/* Dynamic Ground Shadow — centered on the true map center */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-950/45 blur-[2px] transition-all duration-200 ${
          isPanning ? 'w-3 opacity-30 scale-75' : 'w-6 opacity-80 scale-100'
        }`}
      />

      {/* Caption + Care Home Beacon stack; bottom edge (stem tip) sits on exact map center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center">
        {/* Floating Address Pill above beacon */}
        <div
          className={`mb-2 max-w-[80vw] sm:max-w-md px-3 py-1.5 rounded-full text-2xs font-semibold shadow-lg backdrop-blur-md transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
            isPanning
              ? 'scale-95 -translate-y-1 opacity-85 bg-slate-900/90 text-white border border-white/15'
              : 'scale-100 translate-y-0 opacity-100 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/15'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-[#2F6FB5] dark:text-[#8CBDF0] shrink-0" />
              <span className="truncate">Locating care address…</span>
            </>
          ) : (
            <span className="truncate">
              {isPanning
                ? 'Release map to lock care location'
                : addressPreview || 'Drag map to set care visit location'}
            </span>
          )}
        </div>

        {/* Care Home Beacon SVG (Squircle Badge + Roof/Heart + Precision Stem) */}
        <div
          className={`relative transition-all duration-200 ease-out ${
            isPanning ? '-translate-y-3.5 scale-105' : 'translate-y-0 scale-100'
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
              {/* Clinical Trust Blue Squircle Gradient */}
              <linearGradient
                id="mcBeaconBg"
                x1="6"
                y1="2"
                x2="38"
                y2="38"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#3B82F6" />
                <stop offset="0.55" stopColor="#2F6FB5" />
                <stop offset="1" stopColor="#1E4273" />
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
                <stop stopColor="#1E4273" />
                <stop offset="1" stopColor="#2F6FB5" />
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

            {/* Main Clinical Blue Squircle Body */}
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
              stroke="#2F6FB5"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Exact Center Reticle Dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#2F6FB5] dark:bg-[#8CBDF0] ring-2 ring-white dark:ring-slate-900 shadow-sm" />
    </div>
  );
}
