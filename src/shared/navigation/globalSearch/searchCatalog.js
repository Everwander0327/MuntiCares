const SETTINGS_SECTIONS = [
  {
    id: 'appearance',
    labelKey: 'settings.sections.appearance.label',
    keywordsKey: 'settings.sections.appearance.keywords',
  },
  {
    id: 'personalization',
    labelKey: 'settings.sections.personalization.label',
    keywordsKey: 'settings.sections.personalization.keywords',
  },
  {
    id: 'notifications',
    labelKey: 'settings.sections.notifications.label',
    keywordsKey: 'settings.sections.notifications.keywords',
  },
  {
    id: 'privacy',
    labelKey: 'settings.sections.privacy.label',
    keywordsKey: 'settings.sections.privacy.keywords',
  },
];

export const buildStaticCatalog = ({
  role = 'patient',
  links = [],
  t,
  dark = false,
  language = 'en',
}) => {
  const safeRole = role === 'provider' || role === 'admin' ? role : 'patient';

  const pages = links.map((link) => ({
    id: `page:${link.to}`,
    label: link.label,
    shortLabel: link.shortLabel || '',
    to: link.to,
    icon: link.icon || null,
    iconName: 'page',
    kind: 'page',
    keywords: [link.label, link.shortLabel].filter(Boolean).join(' '),
  }));

  const seenRoutes = new Set(pages.map((p) => p.to));
  const addExtraPage = (entry) => {
    if (seenRoutes.has(entry.to)) return;
    seenRoutes.add(entry.to);
    pages.push(entry);
  };

  if (safeRole === 'patient') {
    addExtraPage({
      id: 'page:/patient/consent',
      label: t('nav.search.pageConsent'),
      to: '/patient/consent',
      iconName: 'consent',
      kind: 'page',
      keywords: t('nav.search.pageConsentKeywords'),
    });
  }

  addExtraPage({
    id: `page:/${safeRole}/profile`,
    label: t('nav.search.pageProfile'),
    to: `/${safeRole}/profile`,
    iconName: 'profile',
    kind: 'page',
    keywords: t('nav.search.pageProfileKeywords'),
  });

  addExtraPage({
    id: `page:/${safeRole}/settings`,
    label: t('nav.search.pageSettings'),
    to: `/${safeRole}/settings`,
    iconName: 'settings',
    kind: 'page',
    keywords: t('nav.search.pageSettingsKeywords'),
  });

  const settings = SETTINGS_SECTIONS.map((sec) => ({
    id: `settings:${safeRole}:${sec.id}`,
    label: t(sec.labelKey),
    subtitle: t('nav.search.pageSettings'),
    to: `/${safeRole}/settings?tab=${sec.id}`,
    iconName: `settings-${sec.id}`,
    kind: 'settings',
    keywords: `${t(sec.labelKey)} ${t(sec.keywordsKey)} ${t('nav.search.pageSettings')}`,
  }));

  const actions = [
    {
      id: 'action:toggle-theme',
      actionId: 'toggle-theme',
      label: dark ? t('nav.search.actionToggleLight') : t('nav.search.actionToggleDark'),
      iconName: dark ? 'sun' : 'moon',
      kind: 'action',
      keywords: t('nav.search.actionThemeKeywords'),
    },
    {
      id: 'action:toggle-language',
      actionId: 'toggle-language',
      label:
        language === 'en'
          ? t('nav.search.actionSwitchToTagalog')
          : t('nav.search.actionSwitchToEnglish'),
      iconName: 'language',
      kind: 'action',
      keywords: t('nav.search.actionLanguageKeywords'),
    },
  ];

  if (safeRole !== 'admin') {
    actions.push({
      id: 'action:weekly-updates',
      actionId: 'weekly-updates',
      label: t('nav.search.actionWeeklyUpdates'),
      iconName: 'updates',
      kind: 'action',
      keywords: t('nav.search.actionWeeklyKeywords'),
    });
  }

  actions.push({
    id: 'action:sign-out',
    actionId: 'sign-out',
    label: t('nav.search.actionSignOut'),
    iconName: 'logout',
    kind: 'action',
    keywords: t('nav.search.actionSignOutKeywords'),
  });

  return { pages, settings, actions };
};

export const filterCatalogItems = (items = [], query = '') => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = [item.label, item.shortLabel, item.subtitle, item.keywords]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
};

export const splitHighlightSegments = (text, query) => {
  const source = typeof text === 'string' ? text : '';
  const needle = typeof query === 'string' ? query.trim() : '';
  if (!source || !needle) {
    return [{ text: source, match: false }];
  }
  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments = [];
  let cursor = 0;
  let idx = lowerSource.indexOf(lowerNeedle, cursor);
  while (idx !== -1) {
    if (idx > cursor) {
      segments.push({ text: source.slice(cursor, idx), match: false });
    }
    segments.push({
      text: source.slice(idx, idx + needle.length),
      match: true,
    });
    cursor = idx + needle.length;
    idx = lowerSource.indexOf(lowerNeedle, cursor);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), match: false });
  }
  return segments.length > 0 ? segments : [{ text: source, match: false }];
};
