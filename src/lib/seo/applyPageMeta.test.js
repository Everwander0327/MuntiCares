import { describe, it, expect, beforeEach } from 'vitest';
import { applyPageMeta } from './applyPageMeta';

const first = {
  title: 'First | MuntiCares',
  description: 'First description',
  canonical: 'https://munti-cares.vercel.app/',
  robots: 'index, follow',
};
const second = {
  title: 'Second | MuntiCares',
  description: 'Second description',
  canonical: 'https://munti-cares.vercel.app/login',
  robots: 'noindex, nofollow',
};

const SELECTORS = {
  description: 'meta[name="description"]',
  robots: 'meta[name="robots"]',
  canonical: 'link[rel="canonical"]',
  ogUrl: 'meta[property="og:url"]',
  ogTitle: 'meta[property="og:title"]',
  ogDescription: 'meta[property="og:description"]',
};

function read(sel) {
  const nodes = document.head.querySelectorAll(sel);
  expect(nodes).toHaveLength(1);
  const el = nodes[0];
  return el.tagName === 'LINK' ? el.getAttribute('href') : el.getAttribute('content');
}

describe('applyPageMeta', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="description" content="from index.html">';
    document.title = '';
  });

  it('sets title and exactly one of each tag', () => {
    applyPageMeta(first);
    expect(document.title).toBe(first.title);
    expect(read(SELECTORS.description)).toBe(first.description);
    expect(read(SELECTORS.robots)).toBe(first.robots);
    expect(read(SELECTORS.canonical)).toBe(first.canonical);
    expect(read(SELECTORS.ogUrl)).toBe(first.canonical);
    expect(read(SELECTORS.ogTitle)).toBe(first.title);
    expect(read(SELECTORS.ogDescription)).toBe(first.description);
  });

  it('updates in place on navigation without duplicating tags', () => {
    applyPageMeta(first);
    applyPageMeta(second);
    expect(document.title).toBe(second.title);
    expect(read(SELECTORS.description)).toBe(second.description);
    expect(read(SELECTORS.robots)).toBe(second.robots);
    expect(read(SELECTORS.canonical)).toBe(second.canonical);
    expect(read(SELECTORS.ogUrl)).toBe(second.canonical);
  });
});
