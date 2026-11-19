import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encodeRecentEventMessage } from '@/features/admin/utils/recentEvents';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  sanitizePostgrestQuery,
  clearSearchCache,
  searchLiveRecords,
} from './searchDataSource';

const createQueryChain = (result) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
};

const mockT = (key) => {
  const map = {
    'nav.search.providers': 'Providers',
    'nav.search.myRequests': 'My Requests',
    'nav.search.conversations': 'Conversations',
    'nav.search.myPatients': 'My Patients',
    'nav.search.requests': 'Requests',
    'nav.search.schedule': 'Schedule',
    'nav.search.patients': 'Patients',
    'nav.search.announcements': 'Announcements',
    'nav.search.chatSubtitle': 'Open conversation',
    'nav.search.patientProfileSubtitle': 'View patient profile',
    'nav.search.statusBanned': 'Restricted',
    'nav.search.statusActive': 'Active',
    'common.roles.patient': 'Patient',
    'common.roles.provider': 'Provider',
    'common.services.generalConsultation': 'General Consultation',
  };
  return map[key] || key;
};

describe('searchDataSource', () => {
  beforeEach(() => {
    fromMock.mockReset();
    clearSearchCache();
  });

  it('sanitizes PostgREST filter metacharacters while keeping email dots intact', () => {
    expect(sanitizePostgrestQuery('  maria,%(test)*\\  ')).toBe('maria test');
    expect(sanitizePostgrestQuery('%,()*\\')).toBe('');
    expect(sanitizePostgrestQuery('ana@example.com')).toBe('ana@example.com');
  });

  it('searches patient providers, requests (including Tagalog translations), and eligible conversations with 60s cache', async () => {
    fromMock.mockImplementation((table) => {
      if (table === 'providers') {
        return createQueryChain({
          data: [
            {
              id: 'prov-row-1',
              user_id: 'prov-1',
              services: ['Home Nursing', 'Wound Care'],
              location: 'Alabang, Muntinlupa',
              rating: 4.9,
              user: { id: 'prov-1', full_name: 'Nurse Maria Santos', avatar_url: '' },
            },
          ],
          error: null,
        });
      }
      if (table === 'requests') {
        return createQueryChain({
          data: [
            {
              id: 'req-1',
              service: 'Home Nursing',
              status: 'Accepted',
              date: '2026-11-20',
              time: '09:00',
              provider_id: 'prov-1',
              provider: { id: 'prov-1', full_name: 'Nurse Maria Santos', avatar_url: '' },
            },
            {
              id: 'req-2',
              service: 'Physical Therapy',
              status: 'Pending',
              date: '2026-11-21',
              time: '14:00',
              provider_id: 'prov-2',
              provider: { id: 'prov-2', full_name: 'Pending Pete', avatar_url: '' },
            },
          ],
          error: null,
        });
      }
      return createQueryChain({ data: [], error: null });
    });

    const translateService = (svc) =>
      svc === 'Home Nursing' ? 'Pangangalaga sa Bahay' : svc;
    const translateStatus = (st) => st;

    const first = await searchLiveRecords({
      role: 'patient',
      userId: 'pat-1',
      query: 'bahay',
      translateService,
      translateStatus,
      t: mockT,
    });

    const providersGroup = first.find((g) => g.key === 'providers');
    const requestsGroup = first.find((g) => g.key === 'requests');
    expect(providersGroup?.items[0]).toMatchObject({
      label: 'Nurse Maria Santos',
      to: '/patient/providers/prov-1/profile',
    });
    expect(requestsGroup?.items[0]).toMatchObject({
      to: '/patient/requests?q=Nurse%20Maria%20Santos&tab=all',
    });

    // Second query reuses cache and checks eligible conversations exclude Pending
    const second = await searchLiveRecords({
      role: 'patient',
      userId: 'pat-1',
      query: 'pending',
      translateService,
      translateStatus,
      t: mockT,
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(second.find((g) => g.key === 'conversations')).toBeUndefined();

    const third = await searchLiveRecords({
      role: 'patient',
      userId: 'pat-1',
      query: 'maria',
      translateService,
      translateStatus,
      t: mockT,
    });
    expect(third.find((g) => g.key === 'conversations')?.items[0]).toMatchObject({
      label: 'Nurse Maria Santos',
      to: '/patient/messages?partner=prov-1&name=Nurse%20Maria%20Santos',
    });
  });

  it('scopes provider My Patients, Schedule, and Conversations to eligible statuses while keeping Pending in Requests', async () => {
    fromMock.mockImplementation(() =>
      createQueryChain({
        data: [
          {
            id: 'req-acc',
            service: 'Vital Signs',
            status: 'Accepted',
            date: '2026-11-22T00:00:00Z',
            time: '10:30',
            patient_id: 'pat-1',
            patient: { id: 'pat-1', full_name: 'Juan Cruz', avatar_url: '' },
          },
          {
            id: 'req-pend',
            service: 'Vital Signs',
            status: 'Pending',
            date: '2026-11-23',
            time: '11:00',
            patient_id: 'pat-2',
            patient: { id: 'pat-2', full_name: 'Juan Pending', avatar_url: '' },
          },
        ],
        error: null,
      })
    );

    const groups = await searchLiveRecords({
      role: 'provider',
      userId: 'prov-1',
      query: 'juan',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });

    const patientsGroup = groups.find((g) => g.key === 'patients');
    const requestsGroup = groups.find((g) => g.key === 'requests');
    const scheduleGroup = groups.find((g) => g.key === 'schedule');
    const convGroup = groups.find((g) => g.key === 'conversations');

    expect(patientsGroup?.items.map((i) => i.label)).toEqual(['Juan Cruz']);
    expect(patientsGroup?.items[0].to).toBe('/provider/patients/pat-1/profile');
    expect(requestsGroup?.items).toHaveLength(2);
    expect(scheduleGroup?.items.map((i) => i.to)).toEqual([
      '/provider/schedule?date=2026-11-22&appt=req-acc',
    ]);
    expect(convGroup?.items.map((i) => i.label)).toEqual(['Juan Cruz']);
  });

  it('runs sanitized admin queries, avoids emails in URLs/recentSubtitle, and filters MC_EVENT metadata false matches', async () => {
    const encodedEvent = encodeRecentEventMessage({
      tag: 'Health Caravan',
      image: 'https://cdn.example.com/carousel/banner.jpg',
      link: 'https://munticares.ph/events',
      description: 'Free blood pressure checkups at Alabang.',
    });

    const chains = [];
    fromMock.mockImplementation((table) => {
      if (table === 'users') {
        const chain = createQueryChain({
          data: [
            {
              id: 'u-pat-1',
              full_name: 'Ana Reyes',
              email: 'ana@example.com',
              avatar_url: '',
              role: 'patient',
              is_banned: false,
            },
          ],
          error: null,
        });
        chains.push({ table, chain });
        return chain;
      }
      if (table === 'requests') {
        const chain = createQueryChain({ data: [], error: null });
        chains.push({ table, chain });
        return chain;
      }
      if (table === 'announcements') {
        const chain = createQueryChain({
          data: [
            {
              id: 'ann-1',
              title: 'Alabang Medical Caravan',
              message: encodedEvent,
              target_audience: 'all',
              created_at: '2026-11-18T00:00:00Z',
            },
          ],
          error: null,
        });
        chains.push({ table, chain });
        return chain;
      }
      return createQueryChain({ data: [], error: null });
    });

    // Searching "https" should NOT match the encoded image/link JSON inside message
    const metaCheck = await searchLiveRecords({
      role: 'admin',
      userId: 'admin-1',
      query: 'https',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    expect(metaCheck.find((g) => g.key === 'announcements')).toBeUndefined();

    // Searching "ana,()" strips metacharacters and keeps email out of `to` and `recentSubtitle`
    const adminResults = await searchLiveRecords({
      role: 'admin',
      userId: 'admin-1',
      query: 'ana,()',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    const patientsGroup = adminResults.find((g) => g.key === 'patients');
    expect(patientsGroup?.items[0]).toMatchObject({
      label: 'Ana Reyes',
      subtitle: 'ana@example.com',
      recentSubtitle: 'Patient • Active',
      to: '/admin/patients?q=Ana%20Reyes',
    });
    expect(patientsGroup?.items[0].to).not.toContain('ana@example.com');

    // Searching "caravan" matches parsed announcement and shows clean subtitle without [MC_EVENT:
    const annResults = await searchLiveRecords({
      role: 'admin',
      userId: 'admin-1',
      query: 'caravan',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    const annItem = annResults.find((g) => g.key === 'announcements')?.items[0];
    expect(annItem).toMatchObject({
      label: 'Alabang Medical Caravan',
      to: '/admin/announcements?q=Alabang%20Medical%20Caravan',
    });
    expect(annItem.subtitle).not.toContain('[MC_EVENT:');
    expect(annItem.subtitle).toContain('Health Caravan');
  });

  it('soft-fails and returns empty array when Supabase throws', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('network down');
    });

    const res = await searchLiveRecords({
      role: 'patient',
      userId: 'pat-err',
      query: 'maria',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    expect(res).toEqual([]);
  });

  it('does not poison the 60s cache on transient Supabase errors and blocks in-flight resurrection after clearSearchCache', async () => {
    // 1. Transient error must not cache empty dataset
    fromMock.mockImplementationOnce(() =>
      createQueryChain({ data: null, error: { message: 'temporary timeout' } })
    );

    const failed = await searchLiveRecords({
      role: 'provider',
      userId: 'prov-retry',
      query: 'juan',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    expect(failed).toEqual([]);

    fromMock.mockImplementationOnce(() =>
      createQueryChain({
        data: [
          {
            id: 'req-ok',
            service: 'Vital Signs',
            status: 'Accepted',
            date: '2026-11-22',
            time: '10:00',
            patient_id: 'pat-1',
            patient: { id: 'pat-1', full_name: 'Juan Recovered', avatar_url: '' },
          },
        ],
        error: null,
      })
    );

    const recovered = await searchLiveRecords({
      role: 'provider',
      userId: 'prov-retry',
      query: 'juan',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    expect(recovered.find((g) => g.key === 'patients')?.items[0]?.label).toBe(
      'Juan Recovered'
    );

    // 2. In-flight fetch started before clearSearchCache must not populate cache after clear
    clearSearchCache();
    let resolveInflight;
    fromMock.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(() => new Promise((res) => { resolveInflight = res; })),
    }));

    const inflightPromise = searchLiveRecords({
      role: 'provider',
      userId: 'prov-clear',
      query: 'old',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });

    // Clear cache while fetch is still in flight
    clearSearchCache();

    resolveInflight({
      data: [
        {
          id: 'req-old',
          service: 'Vital Signs',
          status: 'Accepted',
          date: '2026-11-22',
          time: '10:00',
          patient_id: 'pat-old',
          patient: { id: 'pat-old', full_name: 'Old Session User', avatar_url: '' },
        },
      ],
      error: null,
    });
    await inflightPromise;

    // Next search must re-fetch instead of reading resurrected stale cache
    fromMock.mockImplementationOnce(() =>
      createQueryChain({ data: [], error: null })
    );
    const fresh = await searchLiveRecords({
      role: 'provider',
      userId: 'prov-clear',
      query: 'old',
      translateService: (s) => s,
      translateStatus: (s) => s,
      t: mockT,
    });
    expect(fresh).toEqual([]);
  });
});
