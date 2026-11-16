import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_LANGUAGE, formatLocalizedDate } from '@/i18n';

const EVENT_PREFIX = '[MC_EVENT:';
const FALLBACK_EVENT_IMAGE = '/images/carousel/caravan.jpg';
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const normalizeEventLink = (rawLink) => {
  if (typeof rawLink !== 'string') return '';
  const trimmed = rawLink.trim();
  if (!trimmed) return '';

  // Allow relative app routes starting with single '/'
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return '';
    return trimmed;
  }

  // Block dangerous schemes explicitly
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return '';
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    // Require a valid hostname with a dot or localhost
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

export const isExternalEventLink = (link) => /^https?:\/\//i.test(link || '');

export const formatEventDateLabel = (dateStr, language = DEFAULT_LANGUAGE) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const parsed = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return formatLocalizedDate(parsed, language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const isWithinLastSevenDays = (createdAt, now = Date.now()) => {
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts <= SEVEN_DAYS_MS;
};

export const compressEventImage = (file, { maxWidth = 1280, quality = 0.82 } = {}) =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve({
        blob: file,
        dataUrl: null,
        ext: (file.name.split('.').pop() || 'jpg').toLowerCase(),
        contentType: file.type || 'image/jpeg',
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            resolve({
              blob: blob || file,
              dataUrl,
              ext: 'jpg',
              contentType: 'image/jpeg',
            });
          },
          'image/jpeg',
          quality
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve({
          blob: file,
          dataUrl: null,
          ext: (file.name.split('.').pop() || 'jpg').toLowerCase(),
          contentType: file.type || 'image/jpeg',
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        blob: file,
        dataUrl: null,
        ext: (file.name.split('.').pop() || 'jpg').toLowerCase(),
        contentType: file.type || 'image/jpeg',
      });
    };

    img.src = objectUrl;
  });

export const encodeRecentEventMessage = ({ tag, image, link, eventDate, description }) => {
  const safeLink = normalizeEventLink(link || '');
  const cleanDate = typeof eventDate === 'string' ? eventDate.trim() : '';
  const meta = {
    tag: (tag || 'Recent Event').trim(),
    image: (image || FALLBACK_EVENT_IMAGE).trim(),
  };
  if (safeLink) meta.link = safeLink;
  if (cleanDate) meta.date = cleanDate;
  return `${EVENT_PREFIX}${JSON.stringify(meta)}]\n${(description || '').trim()}`;
};

export const parseAnnouncementRecord = (row) => {
  if (!row) return null;
  const rawMessage = typeof row.message === 'string' ? row.message : '';

  if (rawMessage.startsWith(EVENT_PREFIX)) {
    const endWithNewline = rawMessage.indexOf('}]\n');
    const endPlain = rawMessage.indexOf('}]');
    const closeBraceIdx = endWithNewline !== -1 ? endWithNewline : endPlain;
    if (closeBraceIdx !== -1) {
      const jsonPart = rawMessage.slice(EVENT_PREFIX.length, closeBraceIdx + 1);
      const bodyPart = rawMessage
        .slice(closeBraceIdx + (endWithNewline !== -1 ? 3 : 2))
        .trim();
      try {
        const meta = JSON.parse(jsonPart);
        return {
          ...row,
          isEvent: true,
          eventTag: meta.tag || 'Recent Event',
          eventImage: meta.image || FALLBACK_EVENT_IMAGE,
          eventLink: normalizeEventLink(meta.link || ''),
          eventDate: typeof meta.date === 'string' ? meta.date.trim() : '',
          cleanMessage: bodyPart,
        };
      } catch {
        // fall through to standard record
      }
    }
  }

  if (row.is_event || row.show_in_carousel) {
    return {
      ...row,
      isEvent: true,
      eventTag: row.event_tag || row.carousel_tag || 'Recent Event',
      eventImage: row.image_url || FALLBACK_EVENT_IMAGE,
      eventLink: normalizeEventLink(row.link_url || row.action_url || ''),
      eventDate: typeof row.event_date === 'string' ? row.event_date.trim() : '',
      cleanMessage: rawMessage,
    };
  }

  return {
    ...row,
    isEvent: false,
    eventTag: null,
    eventImage: null,
    eventLink: '',
    eventDate: '',
    cleanMessage: rawMessage,
  };
};

export const filterEventsForRole = (rows, role, { onlyRecent7Days = false, now = Date.now() } = {}) => {
  const allowedTargets = role === 'provider' ? ['all', 'providers'] : ['all', 'patients'];
  return (rows || [])
    .filter((row) => !onlyRecent7Days || isWithinLastSevenDays(row?.created_at, now))
    .map(parseAnnouncementRecord)
    .filter(
      (item) =>
        item &&
        item.isEvent &&
        allowedTargets.includes((item.target_audience || 'all').toLowerCase())
    )
    .map((item) => ({
      id: `event-${item.id}`,
      tag: item.eventTag || 'Recent Event',
      title: item.title,
      description: item.cleanMessage,
      image: item.eventImage || FALLBACK_EVENT_IMAGE,
      link: item.eventLink || '',
      eventDate: item.eventDate || '',
      isLiveEvent: true,
    }));
};

export const splitWeeklyUpdatesForRole = (rows, role, now = Date.now()) => {
  const allowedTargets = role === 'provider' ? ['all', 'providers'] : ['all', 'patients'];
  const active = (rows || [])
    .filter((row) => isWithinLastSevenDays(row?.created_at, now))
    .filter((row) => allowedTargets.includes((row?.target_audience || 'all').toLowerCase()))
    .map(parseAnnouncementRecord)
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    events: active.filter((item) => item.isEvent),
    announcements: active.filter((item) => !item.isEvent),
    allItems: active,
  };
};

const getDismissedStorageKey = (userId) => `mc_weekly_updates_dismissed_${userId}`;

export const readDismissedUpdateIds = (userId) => {
  if (!userId) return [];
  try {
    if (typeof localStorage === 'undefined') return [];
    const parsed = JSON.parse(localStorage.getItem(getDismissedStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const dismissWeeklyUpdates = (items, userId) => {
  if (!userId || !Array.isArray(items)) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const existing = new Set(readDismissedUpdateIds(userId));
    items.forEach((item) => {
      if (item?.id != null) existing.add(String(item.id));
    });
    const trimmed = Array.from(existing).slice(-100);
    localStorage.setItem(getDismissedStorageKey(userId), JSON.stringify(trimmed));
  } catch {
    // ignore storage errors
  }
};

export const hasUnseenWeeklyUpdates = (items, userId) => {
  if (!Array.isArray(items) || items.length === 0) return false;
  if (!userId) return true;
  const dismissed = new Set(readDismissedUpdateIds(userId));
  return items.some((item) => item?.id != null && !dismissed.has(String(item.id)));
};

export const useRecentCarouselEvents = (role, defaultSlides = []) => {
  const [liveSlides, setLiveSlides] = useState([]);

  const fetchEvents = useCallback(async () => {
    try {
      const cutoffIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error || !data) return;
      setLiveSlides(filterEventsForRole(data, role, { onlyRecent7Days: true }));
    } catch {
      // gracefully fall back to default slides
    }
  }, [role]);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel(`carousel-events-${role}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents, role]);

  return liveSlides.length > 0 ? [...liveSlides, ...defaultSlides] : defaultSlides;
};
