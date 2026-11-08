import { HOME_DESCRIPTION, HOME_TITLE, PUBLIC_PAGES } from './seoConfig';

const INDEX = 'index, follow';
const NOINDEX = 'noindex, nofollow';

function normalizePath(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/**
 * Meta for a route. Only PUBLIC_PAGES are indexable; auth, dashboard, and
 * unknown routes get noindex with the home title/description.
 */
export function getPageMeta(pathname, siteUrl) {
  const path = normalizePath(pathname);
  const page = PUBLIC_PAGES.find((p) => p.path === path);

  return {
    title: page ? page.title : HOME_TITLE,
    description: page ? page.description : HOME_DESCRIPTION,
    canonical: `${siteUrl}${path}`,
    robots: page ? INDEX : NOINDEX,
  };
}
