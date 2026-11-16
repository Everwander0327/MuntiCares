import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  encodeRecentEventMessage,
  parseAnnouncementRecord,
  filterEventsForRole,
  isWithinLastSevenDays,
  splitWeeklyUpdatesForRole,
  hasUnseenWeeklyUpdates,
  dismissWeeklyUpdates,
  normalizeEventLink,
  formatEventDateLabel,
  SEVEN_DAYS_MS,
} from './recentEvents';

describe('recentEvents utilities', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  it('encodes and decodes a recent event payload while keeping cleanMessage clean', () => {
    const encoded = encodeRecentEventMessage({
      tag: 'Barangay Health Caravan',
      image: '/images/carousel/caravan.jpg',
      description: 'Free blood pressure checkups at Barangay Alabang Plaza.',
    });

    const parsed = parseAnnouncementRecord({
      id: 42,
      title: 'Alabang Medical Caravan',
      message: encoded,
      target_audience: 'all',
    });

    expect(parsed.isEvent).toBe(true);
    expect(parsed.eventTag).toBe('Barangay Health Caravan');
    expect(parsed.eventImage).toBe('/images/carousel/caravan.jpg');
    expect(parsed.cleanMessage).toBe('Free blood pressure checkups at Barangay Alabang Plaza.');
  });

  it('leaves standard broadcast announcements untouched', () => {
    const parsed = parseAnnouncementRecord({
      id: 7,
      title: 'Scheduled Maintenance',
      message: 'System maintenance tonight at 11 PM.',
      target_audience: 'all',
    });

    expect(parsed.isEvent).toBe(false);
    expect(parsed.cleanMessage).toBe('System maintenance tonight at 11 PM.');
  });

  it('filters recent events by role audience and 7-day expiry window', () => {
    const now = new Date('2026-11-16T12:00:00Z').getTime();
    const recentIso = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const expiredIso = new Date(now - SEVEN_DAYS_MS - 60000).toISOString();

    const rows = [
      {
        id: 1,
        title: 'All Citizens Event',
        created_at: recentIso,
        message: encodeRecentEventMessage({
          tag: 'Community',
          image: '/images/carousel/caravan.jpg',
          description: 'For everyone',
        }),
        target_audience: 'all',
      },
      {
        id: 2,
        title: 'Patients Only Event',
        created_at: recentIso,
        message: encodeRecentEventMessage({
          tag: 'Patient Care',
          image: '/images/carousel/home-care.jpg',
          description: 'For patients',
        }),
        target_audience: 'patients',
      },
      {
        id: 3,
        title: 'Providers Only Event',
        created_at: recentIso,
        message: encodeRecentEventMessage({
          tag: 'Care Protocol',
          image: '/images/carousel/provider-home-visit.jpg',
          description: 'For providers',
        }),
        target_audience: 'providers',
      },
      {
        id: 4,
        title: 'Expired Event',
        created_at: expiredIso,
        message: encodeRecentEventMessage({
          tag: 'Old',
          image: '/images/carousel/caravan.jpg',
          description: 'Older than 7 days',
        }),
        target_audience: 'all',
      },
      {
        id: 5,
        title: 'Plain Broadcast',
        created_at: recentIso,
        message: 'Not a carousel slide',
        target_audience: 'all',
      },
    ];

    expect(isWithinLastSevenDays(recentIso, now)).toBe(true);
    expect(isWithinLastSevenDays(expiredIso, now)).toBe(false);

    const patientSlides = filterEventsForRole(rows, 'patient', { onlyRecent7Days: true, now });
    expect(patientSlides.map((s) => s.title)).toEqual([
      'All Citizens Event',
      'Patients Only Event',
    ]);

    const providerSlides = filterEventsForRole(rows, 'provider', { onlyRecent7Days: true, now });
    expect(providerSlides.map((s) => s.title)).toEqual([
      'All Citizens Event',
      'Providers Only Event',
    ]);
  });

  it('splits weekly events and announcements and respects Dont show again until new item arrives', () => {
    const now = new Date('2026-11-16T12:00:00Z').getTime();
    const recentIso = new Date(now - 3600 * 1000).toISOString();

    const rows = [
      {
        id: 'ev-1',
        title: 'Health Fair',
        created_at: recentIso,
        target_audience: 'all',
        message: encodeRecentEventMessage({
          tag: 'Caravan',
          image: '/images/carousel/caravan.jpg',
          description: 'Join us this Friday.',
        }),
      },
      {
        id: 'ann-1',
        title: 'Clinic Hours Notice',
        created_at: recentIso,
        target_audience: 'patients',
        message: 'Barangay clinic opens at 7 AM.',
      },
    ];

    const split = splitWeeklyUpdatesForRole(rows, 'patient', now);
    expect(split.events).toHaveLength(1);
    expect(split.announcements).toHaveLength(1);
    expect(hasUnseenWeeklyUpdates(split.allItems, 'patient-1')).toBe(true);

    dismissWeeklyUpdates(split.allItems, 'patient-1');
    expect(hasUnseenWeeklyUpdates(split.allItems, 'patient-1')).toBe(false);

    // New item posted later overrides prior dismissal
    const updatedSplit = splitWeeklyUpdatesForRole(
      [
        ...rows,
        {
          id: 'ann-2',
          title: 'New Dengue Advisory',
          created_at: new Date(now - 60000).toISOString(),
          target_audience: 'all',
          message: 'Stay alert.',
        },
      ],
      'patient',
      now
    );
    expect(hasUnseenWeeklyUpdates(updatedSplit.allItems, 'patient-1')).toBe(true);
  });

  it('validates, normalizes, and preserves safe Go-To links while blocking unsafe schemes', () => {
    expect(normalizeEventLink('/patient/providers')).toBe('/patient/providers');
    expect(normalizeEventLink('muntinlupacity.gov.ph/health')).toBe('https://muntinlupacity.gov.ph/health');
    expect(normalizeEventLink('https://doh.gov.ph')).toBe('https://doh.gov.ph/');
    expect(normalizeEventLink('javascript:alert(1)')).toBe('');
    expect(normalizeEventLink('//evil.com')).toBe('');

    const encoded = encodeRecentEventMessage({
      tag: 'Health Fair',
      image: '/images/carousel/caravan.jpg',
      link: '/patient/providers',
      eventDate: '2026-11-22',
      description: 'Book a checkup now.',
    });
    const parsed = parseAnnouncementRecord({
      id: 99,
      title: 'Barangay Fair',
      message: encoded,
      target_audience: 'all',
    });
    expect(parsed.eventLink).toBe('/patient/providers');
    expect(parsed.eventDate).toBe('2026-11-22');
    expect(formatEventDateLabel(parsed.eventDate)).toBe('Nov 22, 2026');
  });
});
