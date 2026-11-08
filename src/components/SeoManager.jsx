import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageMeta } from '@/lib/seo/pageMeta';
import { normalizeSiteUrl } from '@/lib/seo/seoConfig';
import { applyPageMeta } from '@/lib/seo/applyPageMeta';

const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);

/** Keeps <head> title, canonical and robots in sync with the current route. */
export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applyPageMeta(getPageMeta(pathname, SITE_URL));
  }, [pathname]);

  return null;
}
