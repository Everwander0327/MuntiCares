import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';

const ROOF_PATH =
  'M52 112C64.67 103 77.33 94 90 85C102.67 76 115.33 67 128 58C140.67 67 153.33 76 166 85C178.67 94 191.33 103 204 112';
const ARC_PATH =
  'M82.1 207.5C53.5 187.5 41.2 151.2 51.7 117.9C62.2 84.6 93.1 62 128 62C162.9 62 193.8 84.6 204.3 117.9C214.8 151.2 202.5 187.5 173.9 207.5';
const CHECK_PATH =
  'M82 146C87 151 92 156 97 161C102 166 107 171 112 176C123 165 134 154 145 143C156 132 167 121 178 110';
const HEART_PATH =
  'M128 198C128 198 78 152 78 130C78 112 92 102 106 102C117 102 125 108 128 114C131 108 139 102 150 102C164 102 178 112 178 130C178 152 128 198 128 198Z';

function sanitizeId(rawId) {
  return `mc-mask-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Shared mask punching the clinical plus cutout out of the heart silhouette. */
function CrossCutMask({ id }) {
  return (
    <defs>
      <mask id={id} maskUnits="userSpaceOnUse" x="60" y="90" width="140" height="130">
        <rect x="60" y="90" width="140" height="130" fill="#fff" />
        <rect x="122" y="126" width="12" height="36" rx="3" fill="#000" />
        <rect x="110" y="138" width="36" height="12" rx="3" fill="#000" />
      </mask>
    </defs>
  );
}

/**
 * Static MuntiCares home-care brand mark.
 * - `badge`: rounded-square container in theme primary with white mark (nav, auth, footer).
 * - `glyph`: transparent-background mark using `currentColor` (neumorphic icon buttons).
 */
export function BrandLogo({
  variant = 'badge',
  size,
  className = '',
  decorative = false,
  label = 'MuntiCares',
}) {
  const maskId = sanitizeId(useId());
  const a11yProps = decorative
    ? { 'aria-hidden': 'true', focusable: 'false' }
    : { role: 'img', 'aria-label': label };

  if (variant === 'glyph') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="28 32 200 200"
        width={size}
        height={size}
        className={className}
        {...a11yProps}
      >
        <CrossCutMask id={maskId} />
        <g transform="translate(0 4)">
          <rect x="77" y="66" width="14" height="28" rx="3" fill="currentColor" />
          <path
            d={ROOF_PATH}
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d={HEART_PATH} fill="currentColor" mask={`url(#${maskId})`} />
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      {...a11yProps}
    >
      <rect width="256" height="256" rx="58" fill="rgb(var(--primary-rgb))" />
      <g transform="translate(0 4)">
        <rect x="77" y="66" width="14" height="28" rx="3" fill="rgb(var(--on-primary-rgb))" />
        <path
          d={ROOF_PATH}
          fill="none"
          stroke="rgb(var(--on-primary-rgb))"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={HEART_PATH} fill="rgb(var(--on-primary-rgb))" />
        <rect x="122" y="126" width="12" height="36" rx="3" fill="rgb(var(--primary-rgb))" />
        <rect x="110" y="138" width="36" height="12" rx="3" fill="rgb(var(--primary-rgb))" />
      </g>
    </svg>
  );
}

/**
 * Animated MuntiCares loading mark: heart double-bounce + roof-to-arc 720-degree spin.
 * Drops SMIL motion under `prefers-reduced-motion: reduce`.
 */
export function BrandLoader({
  size = 64,
  loop = true,
  className = '',
  decorative = false,
  label = 'Loading',
}) {
  const maskId = sanitizeId(useId());
  const prefersReducedMotion = useReducedMotion();
  const repeatProps = loop
    ? { repeatCount: 'indefinite' }
    : { repeatCount: '1', fill: 'freeze' };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
      {...(decorative
        ? { 'aria-hidden': 'true' }
        : { role: 'progressbar', 'aria-label': label, 'aria-valuetext': label })}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="28 32 200 200"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
      >
        <CrossCutMask id={maskId} />
        <g transform="translate(0 4)">
          <g>
            {!prefersReducedMotion && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                dur="3.6s"
                {...repeatProps}
                calcMode="spline"
                keyTimes="0;.15;.75;1"
                keySplines="0 0 1 1;.4 0 .6 1;0 0 1 1"
                values="0 128 142;0 128 142;720 128 142;720 128 142"
              />
            )}
            <path
              d={prefersReducedMotion ? ARC_PATH : ROOF_PATH}
              fill="none"
              stroke="var(--text-link)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {!prefersReducedMotion && (
                <animate
                  attributeName="d"
                  dur="3.6s"
                  {...repeatProps}
                  keyTimes="0;.12;.35;.75;.92;1"
                  calcMode="spline"
                  keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1"
                  values={`${ROOF_PATH};${ROOF_PATH};${ARC_PATH};${ARC_PATH};${ROOF_PATH};${ROOF_PATH}`}
                />
              )}
            </path>
          </g>
          <g>
            {!prefersReducedMotion && (
              <animateTransform
                attributeName="transform"
                type="translate"
                dur="3.6s"
                {...repeatProps}
                keyTimes="0;.04;.08;.11;.14;.78;.82;.87;.9;.93;1"
                values="0 0;0 -16;0 0;0 -5;0 0;0 0;0 -16;0 0;0 -5;0 0;0 0"
              />
            )}
            <path d={HEART_PATH} fill="var(--text-link)" mask={`url(#${maskId})`} />
          </g>
        </g>
      </svg>
    </span>
  );
}

/**
 * Animated MuntiCares confirmation mark: house + heart morphing into a success checkmark.
 * Plays once and settles on the checkmark by default (`loop={false}`); renders the final
 * checkmark directly under `prefers-reduced-motion: reduce`.
 */
export function BrandSuccess({
  size = 72,
  loop = false,
  className = '',
  decorative = false,
  label = 'Success',
}) {
  const maskId = sanitizeId(useId());
  const prefersReducedMotion = useReducedMotion();
  const a11yProps = decorative
    ? { 'aria-hidden': 'true', focusable: 'false' }
    : { role: 'img', 'aria-label': label };

  if (prefersReducedMotion) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="28 32 200 200"
        width={size}
        height={size}
        className={className}
        {...a11yProps}
      >
        <g transform="translate(0 4)">
          <path
            d={CHECK_PATH}
            fill="none"
            stroke="var(--status-success)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="28 32 200 200"
      width={size}
      height={size}
      className={className}
      {...a11yProps}
    >
      <CrossCutMask id={maskId} />
      <g transform="translate(0 4)">
        <rect x="77" y="66" width="14" height="28" rx="3" fill="var(--text-link)">
          {loop ? (
            <animate
              attributeName="opacity"
              dur="4.4s"
              repeatCount="indefinite"
              keyTimes="0;.14;.22;.9;.98;1"
              values="1;1;0;0;1;1"
            />
          ) : (
            <animate
              attributeName="opacity"
              dur="0.85s"
              fill="freeze"
              keyTimes="0;.25;.45;1"
              values="1;1;0;0"
            />
          )}
        </rect>
        <path
          d={ROOF_PATH}
          fill="none"
          stroke="var(--text-link)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={loop ? 'mc-brand-success-stroke-loop' : 'mc-brand-success-stroke'}
        >
          {loop ? (
            <animate
              attributeName="d"
              dur="4.4s"
              repeatCount="indefinite"
              keyTimes="0;.22;.42;.8;.92;1"
              calcMode="spline"
              keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1"
              values={`${ROOF_PATH};${ROOF_PATH};${CHECK_PATH};${CHECK_PATH};${ROOF_PATH};${ROOF_PATH}`}
            />
          ) : (
            <animate
              attributeName="d"
              dur="0.85s"
              fill="freeze"
              keyTimes="0;.28;.92;1"
              calcMode="spline"
              keySplines="0 0 1 1;.32 .72 0 1;0 0 1 1"
              values={`${ROOF_PATH};${ROOF_PATH};${CHECK_PATH};${CHECK_PATH}`}
            />
          )}
        </path>
        <g>
          {loop ? (
            <animate
              attributeName="opacity"
              dur="4.4s"
              repeatCount="indefinite"
              keyTimes="0;.14;.26;.88;.98;1"
              values="1;1;0;0;1;1"
            />
          ) : (
            <animate
              attributeName="opacity"
              dur="0.85s"
              fill="freeze"
              keyTimes="0;.22;.48;1"
              values="1;1;0;0"
            />
          )}
          <path d={HEART_PATH} fill="var(--text-link)" mask={`url(#${maskId})`} />
        </g>
      </g>
    </svg>
  );
}
