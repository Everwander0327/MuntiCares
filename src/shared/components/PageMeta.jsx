import { useEffect } from 'react';
import { SITE_URL } from '@/config/constants';

const upsertMeta = (key, value, attribute = 'name') => {
  let el = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attribute, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

const PageMeta = ({ title, description, path = '/' }) => {
  useEffect(() => {
    const url = `${SITE_URL}${path === '/' ? '' : path}`;
    document.title = title;
    upsertMeta('description', description);
    upsertMeta('og:title', title, 'property');
    upsertMeta('og:description', description, 'property');
    upsertMeta('og:url', url, 'property');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }, [title, description, path]);

  return null;
};

export default PageMeta;
