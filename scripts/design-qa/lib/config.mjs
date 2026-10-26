import path from 'node:path';

export const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
export const OUT_DIR = path.resolve('test-results/design-qa');
export const SHOTS_DIR = path.join(OUT_DIR, 'shots');
export const REPORT_FILE = path.join(OUT_DIR, 'report.json');
export const BASELINE_DIR = path.resolve('docs/design-qa');

export const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
];

export const THEMES = ['light', 'dark'];

export const PUBLIC_ROUTES = ['/', '/login', '/register', '/onboarding'];

export const ROLE_ROUTES = {
  patient: [
    '/patient/dashboard',
    '/patient/providers',
    '/patient/requests',
    '/patient/messages',
    '/patient/consent',
    '/patient/profile',
    '/patient/onboarding',
  ],
  provider: [
    '/provider/dashboard',
    '/provider/requests',
    '/provider/patients',
    '/provider/schedule',
    '/provider/messages',
    '/provider/profile',
  ],
  admin: [
    '/admin/dashboard',
    '/admin/patients',
    '/admin/providers',
    '/admin/requests',
    '/admin/profile',
    '/admin/announcements',
  ],
};

// Gate 8 covers the controls named in the QA report §1.7. Probes measure the
// final rendered box (including padding-based hit-area expansion), not the icon.
export const TARGET_PROBES = [
  {
    id: 'landing-nav-links',
    role: 'public',
    route: '/',
    selector: 'header a, header button, nav a, nav button',
  },
  {
    id: 'patient-pagination',
    role: 'patient',
    route: '/patient/requests',
    selector: 'button',
    textRegex: '^\\d+$',
  },
  {
    id: 'calendar-day-cell',
    role: 'provider',
    route: '/provider/schedule',
    selector: 'button[class*="aspect-square"]',
  },
  {
    id: 'calendar-month-arrow',
    role: 'provider',
    route: '/provider/schedule',
    selector: '[title="Previous Month"], [title="Next Month"]',
  },
  {
    id: 'provider-quick-action',
    role: 'provider',
    route: '/provider/dashboard',
    selector: 'button',
    textRegex: '^(Accept|Decline)$',
  },
  {
    id: 'provider-messages-clear',
    role: 'provider',
    route: '/provider/messages',
    selector: 'button[title="Clear search"]',
    prepare: async (page) => {
      const search = page.locator('input[placeholder*="Search patient"]').first();
      if (await search.count()) {
        await search.fill('Andrew');
        await page.waitForTimeout(700);
      }
    },
  },
];

// Overlay probes exercise the dialog semantics gate (report §8 gate 2 / blocker B2).
// `prepare` runs first, `trigger` is marked and clicked to open the overlay.
export const OVERLAY_PROBES = [
  {
    id: 'patient-provider-sheet',
    role: 'patient',
    route: '/patient/providers',
    trigger: (page) => page.getByRole('button', { name: /view (profile|details)/i }).first(),
    settle: 1400,
  },
  {
    id: 'patient-booking-modal',
    role: 'patient',
    route: '/patient/providers',
    prepare: async (page) => {
      await page.getByRole('button', { name: /view (profile|details)/i }).first().click();
      await page.waitForTimeout(1400);
    },
    trigger: (page) => page.getByRole('button', { name: /book appointment/i }).first(),
    settle: 1600,
  },
  {
    id: 'provider-patient-record',
    role: 'provider',
    route: '/provider/patients',
    trigger: (page) => page.getByRole('button', { name: /medical chart/i }).first(),
    settle: 1600,
  },
  {
    id: 'admin-patient-modal',
    role: 'admin',
    route: '/admin/patients',
    trigger: (page) => page.locator('tbody tr').first(),
    settle: 1400,
  },
  {
    id: 'admin-request-modal',
    role: 'admin',
    route: '/admin/requests',
    trigger: (page) => page.locator('tbody tr').first(),
    settle: 1400,
  },
  {
    id: 'patient-permissions-sheet',
    role: 'patient',
    route: '/patient/consent',
    trigger: (page) => page.getByRole('button', { name: /manage permissions/i }).first(),
    settle: 1400,
  },
  {
    id: 'patient-audit-trail',
    role: 'patient',
    route: '/patient/consent',
    trigger: (page) => page.getByRole('button', { name: /audit trail/i }).first(),
    settle: 1400,
  },
];

export const GATE_THRESHOLDS = {
  minTextPx: 12,
  minSentencePx: 14,
  minTargetPx: 44,
  h1Count: 1,
  maxSentences: 0,
};
