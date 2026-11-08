function upsert(doc, selector, create, attr, value) {
  let el = doc.head.querySelector(selector);
  if (!el) {
    el = create(doc);
    doc.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const meta = (key, name) => (doc) => {
  const el = doc.createElement('meta');
  el.setAttribute(key, name);
  return el;
};

const canonicalLink = (doc) => {
  const el = doc.createElement('link');
  el.setAttribute('rel', 'canonical');
  return el;
};

/** Writes title, description, robots, canonical and OG url/title/description into <head>, updating existing tags in place. */
export function applyPageMeta({ title, description, canonical, robots }, doc = document) {
  doc.title = title;
  upsert(doc, 'meta[name="description"]', meta('name', 'description'), 'content', description);
  upsert(doc, 'meta[name="robots"]', meta('name', 'robots'), 'content', robots);
  upsert(doc, 'link[rel="canonical"]', canonicalLink, 'href', canonical);
  upsert(doc, 'meta[property="og:url"]', meta('property', 'og:url'), 'content', canonical);
  upsert(doc, 'meta[property="og:title"]', meta('property', 'og:title'), 'content', title);
  upsert(doc, 'meta[property="og:description"]', meta('property', 'og:description'), 'content', description);
}
