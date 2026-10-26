// Runs inside the browser via page.evaluate — must stay self-contained.
export function auditPage({ name, theme, viewport }) {
  const vw = window.innerWidth;
  const doc = document.documentElement;

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const textOf = (el) =>
    (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 90);

  // ---------------------------------------------------------------- headings
  const headingEls = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  const headingOrder = headingEls.map((el) => ({
    level: Number(el.tagName.slice(1)),
    text: textOf(el).slice(0, 60),
  }));
  const h1Els = headingEls.filter((el) => el.tagName === 'H1');
  const headingViolations = [];
  if (headingOrder.length > 0 && headingOrder[0].level !== 1) {
    headingViolations.push(`first-heading-is-h${headingOrder[0].level}`);
  }
  for (let i = 1; i < headingOrder.length; i += 1) {
    if (headingOrder[i].level - headingOrder[i - 1].level > 1) {
      headingViolations.push(`h${headingOrder[i - 1].level}->h${headingOrder[i].level}`);
    }
  }

  // ------------------------------------------------- text size classification
  const textEls = [...document.querySelectorAll('p,span,div,li,a,button,label,td,th,h1,h2,h3,h4,h5,h6,small,time')].filter(
    (el) => {
      if (!visible(el)) return false;
      if (!el.textContent || !el.textContent.trim()) return false;
      if (
        el.children.length > 0 &&
        !['A', 'BUTTON', 'LABEL', 'SPAN', 'TD', 'TH', 'TIME', 'SMALL'].includes(el.tagName)
      ) {
        return false;
      }
      return true;
    }
  );

  const tinyViolations = [];
  const smallSentences = [];
  let tinyEyebrowCount = 0;
  let tinyTotal = 0;
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (!(fs > 0)) continue;
    const text = textOf(el);
    if (!text) continue;
    const letters = text.replace(/[^A-Za-z]/g, '');
    const allCaps = letters.length > 1 && letters === letters.toUpperCase();
    const uppercase = cs.textTransform === 'uppercase' || allCaps;
    const spaced = cs.letterSpacing !== 'normal' && parseFloat(cs.letterSpacing) > 0.1;
    const isHeading = /^H[1-6]$/.test(el.tagName);
    const eyebrow = !isHeading && uppercase;
    if (fs < 12) {
      tinyTotal += 1;
      if (eyebrow) {
        tinyEyebrowCount += 1;
        // Eyebrows may sit at 10-11px, never 9px.
        if (fs < 10) tinyViolations.push({ px: fs, text, tag: el.tagName, reason: 'eyebrow-below-10px' });
      } else {
        tinyViolations.push({ px: fs, text, tag: el.tagName, reason: eyebrow ? 'eyebrow' : 'text-below-12px' });
      }
    }
    if (fs < 14 && !uppercase && !isHeading && text.length > 40) {
      smallSentences.push({ px: fs, text: text.slice(0, 90), tag: el.tagName });
    }
  }

  // ------------------------------------------------------- contrast (4.5:1)
  const parseColor = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const bgOf = (el) => {
    let n = el;
    while (n && n !== doc) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) return c.a === 1 ? c : blend(c, { r: 255, g: 255, b: 255, a: 1 });
      n = n.parentElement;
    }
    const c = parseColor(getComputedStyle(document.body).backgroundColor);
    return c && c.a > 0 ? (c.a === 1 ? c : blend(c, { r: 255, g: 255, b: 255, a: 1 })) : { r: 255, g: 255, b: 255, a: 1 };
  };
  // The QA report's known false positives: text over photography or gradients.
  // Photos are often layered as absolutely-positioned sibling <img>s, so check
  // both ancestor backgrounds and media siblings painted behind the text.
  const overPaintedMedia = (el) => {
    const textRect = el.getBoundingClientRect();
    const cx = textRect.left + textRect.width / 2;
    const cy = textRect.top + textRect.height / 2;
    let n = el;
    let depth = 0;
    while (n && n !== doc && depth < 6) {
      if (['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'svg'].includes(n.tagName)) return true;
      const s = getComputedStyle(n);
      if (n !== document.body && s.backgroundImage && s.backgroundImage !== 'none') return true;
      if (s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') return true;
      const parent = n.parentElement;
      if (parent) {
        for (const sibling of parent.children) {
          if (sibling === n) continue;
          const siblingStyle = getComputedStyle(sibling);
          const isMedia = ['IMG', 'VIDEO', 'CANVAS', 'PICTURE', 'svg'].includes(sibling.tagName);
          const hasGradient = siblingStyle.backgroundImage && siblingStyle.backgroundImage !== 'none';
          if (!isMedia && !hasGradient) continue;
          if (siblingStyle.position !== 'absolute' && siblingStyle.position !== 'fixed') continue;
          const r = sibling.getBoundingClientRect();
          if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return true;
        }
      }
      n = parent;
      depth += 1;
    }
    return false;
  };

  const contrastSamples = [];
  const seen = new Set();
  let contrastFailures = 0;
  let contrastFailuresBelow12 = 0;
  let contrastExcluded = 0;
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const fg0 = parseColor(cs.color);
    if (!fg0) continue;
    if (overPaintedMedia(el)) {
      contrastExcluded += 1;
      continue;
    }
    const bg = bgOf(el);
    const fg = fg0.a < 1 ? blend(fg0, bg) : fg0;
    const L1 = lum(fg);
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      if (size < 12) {
        contrastFailuresBelow12 += 1;
        continue;
      }
      contrastFailures += 1;
      const key = textOf(el).slice(0, 40) + Math.round(ratio * 10);
      if (!seen.has(key) && contrastSamples.length < 10) {
        seen.add(key);
        contrastSamples.push({
          ratio: Math.round(ratio * 100) / 100,
          need,
          px: size,
          color: cs.color,
          bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
          text: textOf(el).slice(0, 60),
          tag: el.tagName,
        });
      }
    }
  }
  contrastSamples.sort((a, b) => a.ratio - b.ratio);

  // --------------------------------------------------- unlabeled form fields
  const controls = [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')].filter(visible);
  const unlabeled = controls
    .filter((el) => {
      if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
      if (el.closest('label')) return false;
      return true;
    })
    .map((el) => ({ tag: el.tagName, type: el.type || el.tagName, placeholder: el.placeholder || null }));

  // ----------------------------------------------------------- hit targets
  const interactive = [
    ...document.querySelectorAll(
      'a,button,[role="button"],input:not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ),
  ].filter(visible);
  const classifyTarget = (el) => {
    const aria = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase();
    if (/close|dismiss/.test(aria)) return 'close';
    if (el.closest('[data-radix-dialog-close], [data-slot="dialog-close"]')) return 'close';
    const text = (el.textContent || '').trim();
    if (!text && el.querySelector('svg,img')) return 'icon';
    if (/^\d+$/.test(text)) return 'pagination';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return 'input';
    if (el.tagName === 'A') return 'link';
    return 'button';
  };
  const smallByClass = { close: 0, icon: 0, pagination: 0, input: 0, link: 0, button: 0 };
  const smallSamples = [];
  for (const el of interactive) {
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) {
      const cls = classifyTarget(el);
      smallByClass[cls] += 1;
      if (smallSamples.length < 12) {
        smallSamples.push({ tag: el.tagName, cls, text: textOf(el).slice(0, 50), ...rect(el) });
      }
    }
  }

  // --------------------------------------------------------------- images
  const imgs = [...document.querySelectorAll('img')].filter(visible);
  const missingAlt = imgs.filter((i) => !i.hasAttribute('alt'));

  // ------------------------------------------------- banned patterns in DOM
  const banned = {
    hScreen: 0,
    text4xs: 0,
    shadowXs: 0,
    zIndexEscalation: 0,
    purpleClasses: 0,
    uiAvatars: 0,
    pureBlackComputed: 0,
    interComputed: 0,
  };
  const allEls = [...document.querySelectorAll('body *')];
  for (const el of allEls) {
    const cls = typeof el.className === 'string' ? el.className : '';
    if (cls) {
      if (/\bh-screen\b/.test(cls)) banned.hScreen += 1;
      if (/\btext-4xs\b/.test(cls)) banned.text4xs += 1;
      if (/\bshadow-xs\b/.test(cls)) banned.shadowXs += 1;
      if (/z-\[9\d*\]/.test(cls)) banned.zIndexEscalation += 1;
      if (/\b(?:text|bg|border|ring|from|via|to|divide)-(?:purple|violet|fuchsia|indigo)(?:-\d{2,3})?\b/.test(cls)) {
        banned.purpleClasses += 1;
      }
    }
    if (el.tagName === 'IMG' && /ui-avatars\.com/.test(el.currentSrc || el.src || '')) banned.uiAvatars += 1;
  }
  for (const el of allEls.slice(0, 2500)) {
    const cs = getComputedStyle(el);
    if (cs.color === 'rgb(0, 0, 0)' || cs.backgroundColor === 'rgb(0, 0, 0)') banned.pureBlackComputed += 1;
    if (/Inter/.test(cs.fontFamily)) banned.interComputed += 1;
  }

  // ------------------------------------------------------------- overflow
  const overflowEls = allEls
    .filter((el) => {
      if (!visible(el)) return false;
      if (el.closest('[data-qa-allow-overflow]')) return false;
      const r = el.getBoundingClientRect();
      return r.right > vw + 1 || r.left < -1;
    })
    .slice(0, 8)
    .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), text: textOf(el).slice(0, 40), ...rect(el) }));

  return {
    name,
    route: location.pathname,
    theme,
    viewport,
    vw,
    htmlLang: doc.lang,
    mainCount: document.querySelectorAll('main').length,
    h1Count: h1Els.length,
    h1Text: h1Els.length ? textOf(h1Els[0]).slice(0, 80) : null,
    headingOrder: headingOrder.slice(0, 16),
    headingViolations,
    formControlCount: controls.length,
    unlabeled,
    tinyText: {
      total: tinyTotal,
      eyebrows: tinyEyebrowCount,
      violationCount: tinyViolations.length,
      samples: tinyViolations.slice(0, 12),
    },
    smallSentences: { count: smallSentences.length, samples: smallSentences.slice(0, 10) },
    contrast: { failures: contrastFailures, failuresBelow12: contrastFailuresBelow12, excludedPaintedMedia: contrastExcluded, samples: contrastSamples },
    images: { count: imgs.length, missingAlt: missingAlt.length, missingAltSamples: missingAlt.slice(0, 6).map((i) => (i.currentSrc || i.src || '').slice(0, 120)) },
    targets: { interactiveCount: interactive.length, smallByClass, samples: smallSamples },
    banned,
    rootOverflow: {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      xOverflow: doc.scrollWidth > vw + 1,
    },
    overflowEls,
  };
}

// Runs inside the browser after an overlay is opened.
export function probeDialogState({ overlayId }) {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isFullscreenRoot = (el) => {
    if (!visible(el)) return false;
    const style = getComputedStyle(el);
    if (style.position !== 'fixed') return false;
    if (Number.parseInt(style.zIndex, 10) < 10) return false;
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.8;
  };
  const dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(visible);
  const dlg = dialogs[0] || null;
  const active = document.activeElement;
  let closeBtn = dlg
    ? dlg.querySelector('[aria-label*="close" i], [data-radix-dialog-close], [data-slot="dialog-close"]')
    : document.querySelector('[aria-label*="close" i]');
  if (!closeBtn && dlg) {
    // Radix's Close renders an icon-only button without a data hook; take the
    // button nearest the dialog's top-right corner.
    const dialogRect = dlg.getBoundingClientRect();
    const ranked = [...dlg.querySelectorAll('button')]
      .map((button) => {
        const r = button.getBoundingClientRect();
        return { button, distance: Math.hypot(r.right - dialogRect.right, r.top - dialogRect.top) };
      })
      .sort((a, b) => a.distance - b.distance);
    if (ranked[0] && ranked[0].distance < 96) closeBtn = ranked[0].button;
  }
  const nameOf = (el) =>
    ((el.getAttribute && el.getAttribute('aria-label')) || (el.textContent || '')).trim().slice(0, 40);
  const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
  const roots = [...document.querySelectorAll('body *')].filter(isFullscreenRoot);
  return {
    overlayId,
    overlayRootCount: roots.length,
    newOverlayRootCount: roots.filter((el) => !el.hasAttribute('data-qa-pre')).length,
    dialogCount: dialogs.length,
    ariaModal: dlg ? dlg.getAttribute('aria-modal') : null,
    labelledby: dlg ? dlg.getAttribute('aria-labelledby') : null,
    hasAccessibleName: dlg
      ? Boolean(dlg.getAttribute('aria-labelledby') || dlg.getAttribute('aria-label'))
      : false,
    focusInsideDialog: Boolean(dlg && active && dlg.contains(active)),
    activeElement: active ? `${active.tagName}:${(active.textContent || '').trim().slice(0, 30)}` : null,
    closeButtonPresent: Boolean(closeBtn),
    closeButtonAccessibleName: closeBtn ? Boolean(nameOf(closeBtn)) : null,
    closeButtonSize: closeRect
      ? { w: Math.round(closeRect.width), h: Math.round(closeRect.height) }
      : null,
  };
}

export function probeFocusReturn() {
  const active = document.activeElement;
  return {
    focusReturnedToTrigger: Boolean(active && active.hasAttribute && active.hasAttribute('data-qa-trigger')),
    activeElement: active ? `${active.tagName}:${(active.textContent || '').trim().slice(0, 30)}` : null,
  };
}

export function markFullscreenRoots() {
  const isFullscreenRoot = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    if (s.position !== 'fixed') return false;
    if (Number.parseInt(s.zIndex, 10) < 10) return false;
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.8;
  };
  const roots = [...document.querySelectorAll('body *')].filter(isFullscreenRoot);
  for (const root of roots) root.setAttribute('data-qa-pre', '1');
  return roots.length;
}

export function probeOverlayClosed() {
  const isFullscreenRoot = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    if (s.position !== 'fixed') return false;
    if (Number.parseInt(s.zIndex, 10) < 10) return false;
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.8;
  };
  const roots = [...document.querySelectorAll('body *')].filter(isFullscreenRoot);
  return {
    overlayRootCount: roots.length,
    newOverlayRootCount: roots.filter((el) => !el.hasAttribute('data-qa-pre')).length,
  };
}
