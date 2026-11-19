import { supabase } from '@/lib/supabase';
import { parseAnnouncementRecord } from '@/features/admin/utils/recentEvents';

const CACHE_TTL_MS = 60 * 1000;
const ELIGIBLE_VISIT_STATUSES = new Set([
  'Accepted',
  'On The Way',
  'Arrived',
  'Completed',
]);

const roleCache = new Map();
const inflightFetches = new Map();
let cacheEpoch = 0;

const cacheKeyFor = (role, userId) => `${role}:${userId}`;

export const sanitizePostgrestQuery = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[,()%*\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const clearSearchCache = (role, userId) => {
  cacheEpoch += 1;
  if (role && userId) {
    const key = cacheKeyFor(role, userId);
    roleCache.delete(key);
    inflightFetches.delete(key);
    return;
  }
  roleCache.clear();
  inflightFetches.clear();
};

const normalizeDateOnly = (rawDate) => {
  if (!rawDate) return '';
  return String(rawDate).split('T')[0];
};

const includesText = (values, q) =>
  values.some((v) => typeof v === 'string' && v.toLowerCase().includes(q));

const loadPatientDataset = async (userId) => {
  const [providersRes, requestsRes] = await Promise.all([
    supabase
      .from('providers')
      .select(
        'id, user_id, services, location, rating, user:user_id(id, full_name, avatar_url)'
      )
      .eq('is_approved', true)
      .limit(100),
    supabase
      .from('requests')
      .select(
        'id, service, status, date, time, provider_id, provider:provider_id(id, full_name, avatar_url)'
      )
      .eq('patient_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const hasError = Boolean(providersRes?.error || requestsRes?.error);
  return {
    data: {
      providers: providersRes?.error ? [] : providersRes?.data || [],
      requests: requestsRes?.error ? [] : requestsRes?.data || [],
    },
    hasError,
  };
};

const loadProviderDataset = async (userId) => {
  const requestsRes = await supabase
    .from('requests')
    .select(
      'id, service, status, date, time, patient_id, patient:patient_id(id, full_name, avatar_url)'
    )
    .eq('provider_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const hasError = Boolean(requestsRes?.error);
  return {
    data: {
      requests: requestsRes?.error ? [] : requestsRes?.data || [],
    },
    hasError,
  };
};

const getCachedRoleDataset = async (role, userId) => {
  const key = cacheKeyFor(role, userId);
  const existing = roleCache.get(key);
  if (existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
    return existing.data;
  }

  if (inflightFetches.has(key)) {
    return inflightFetches.get(key);
  }

  const startEpoch = cacheEpoch;
  const loader =
    role === 'patient'
      ? loadPatientDataset(userId)
      : role === 'provider'
      ? loadProviderDataset(userId)
      : Promise.resolve({ data: null, hasError: true });

  const promise = loader
    .then(({ data, hasError }) => {
      if (!hasError && cacheEpoch === startEpoch) {
        roleCache.set(key, { data, fetchedAt: Date.now() });
      }
      return data;
    })
    .finally(() => {
      if (inflightFetches.get(key) === promise) {
        inflightFetches.delete(key);
      }
    });

  inflightFetches.set(key, promise);
  return promise;
};

export const warmRoleSearchCache = async (role, userId) => {
  if (!userId || (role !== 'patient' && role !== 'provider')) return;
  try {
    await getCachedRoleDataset(role, userId);
  } catch {
    // Soft-fail pre-warm
  }
};

const buildPatientResults = (dataset, q, { translateService, translateStatus, t }) => {
  const groups = [];
  const providers = dataset?.providers || [];
  const requests = dataset?.requests || [];

  const matchedProviders = providers
    .filter((p) => {
      const services = Array.isArray(p.services) ? p.services : [];
      const translatedServices = services.map((s) => translateService(s));
      return includesText(
        [p.user?.full_name, p.location, ...services, ...translatedServices],
        q
      );
    })
    .slice(0, 5)
    .map((p) => {
      const name = p.user?.full_name || t('common.roles.provider');
      const primaryService =
        Array.isArray(p.services) && p.services.length > 0
          ? translateService(p.services[0])
          : t('common.services.generalConsultation');
      const subtitle = [primaryService, p.location].filter(Boolean).join(' • ');
      return {
        id: `provider:${p.user_id}`,
        label: name,
        subtitle,
        to: `/patient/providers/${p.user_id}/profile`,
        avatar: p.user?.avatar_url || '',
        kind: 'provider',
      };
    });

  if (matchedProviders.length > 0) {
    groups.push({
      key: 'providers',
      label: t('nav.search.providers'),
      items: matchedProviders,
    });
  }

  const matchedRequests = requests
    .filter((r) => {
      const svc = r.service || '';
      const status = r.status || '';
      return includesText(
        [
          r.provider?.full_name,
          svc,
          translateService(svc),
          status,
          translateStatus(status),
          normalizeDateOnly(r.date),
        ],
        q
      );
    })
    .slice(0, 5)
    .map((r) => {
      const providerName = r.provider?.full_name || '';
      const serviceLabel =
        translateService(r.service) || t('common.services.generalConsultation');
      const statusLabel = translateStatus(r.status);
      const searchTerm = providerName || r.service || '';
      return {
        id: `request:${r.id}`,
        label: providerName || serviceLabel,
        subtitle: [serviceLabel, statusLabel, normalizeDateOnly(r.date)]
          .filter(Boolean)
          .join(' • '),
        to: `/patient/requests?q=${encodeURIComponent(searchTerm)}&tab=all`,
        avatar: r.provider?.avatar_url || '',
        kind: 'request',
      };
    });

  if (matchedRequests.length > 0) {
    groups.push({
      key: 'requests',
      label: t('nav.search.myRequests'),
      items: matchedRequests,
    });
  }

  const seenPartners = new Set();
  const matchedConversations = [];
  for (const r of requests) {
    if (!ELIGIBLE_VISIT_STATUSES.has(r.status)) continue;
    const partnerId = r.provider_id || r.provider?.id;
    const partnerName = r.provider?.full_name || '';
    if (!partnerId || !partnerName || seenPartners.has(partnerId)) continue;
    if (!partnerName.toLowerCase().includes(q)) continue;
    seenPartners.add(partnerId);
    matchedConversations.push({
      id: `chat:${partnerId}`,
      label: partnerName,
      subtitle: t('nav.search.chatSubtitle'),
      to: `/patient/messages?partner=${encodeURIComponent(partnerId)}&name=${encodeURIComponent(partnerName)}`,
      avatar: r.provider?.avatar_url || '',
      kind: 'conversation',
    });
    if (matchedConversations.length >= 4) break;
  }

  if (matchedConversations.length > 0) {
    groups.push({
      key: 'conversations',
      label: t('nav.search.conversations'),
      items: matchedConversations,
    });
  }

  return groups;
};

const buildProviderResults = (dataset, q, { translateService, translateStatus, t }) => {
  const groups = [];
  const requests = dataset?.requests || [];

  const seenPatients = new Set();
  const matchedPatients = [];
  for (const r of requests) {
    if (!ELIGIBLE_VISIT_STATUSES.has(r.status)) continue;
    const patientId = r.patient_id || r.patient?.id;
    const patientName = r.patient?.full_name || '';
    if (!patientId || !patientName || seenPatients.has(patientId)) continue;
    if (!patientName.toLowerCase().includes(q)) continue;
    seenPatients.add(patientId);
    matchedPatients.push({
      id: `patient:${patientId}`,
      label: patientName,
      subtitle: t('nav.search.patientProfileSubtitle'),
      to: `/provider/patients/${patientId}/profile`,
      avatar: r.patient?.avatar_url || '',
      kind: 'patient',
    });
    if (matchedPatients.length >= 5) break;
  }

  if (matchedPatients.length > 0) {
    groups.push({
      key: 'patients',
      label: t('nav.search.myPatients'),
      items: matchedPatients,
    });
  }

  const matchedRequests = requests
    .filter((r) => {
      const svc = r.service || '';
      const status = r.status || '';
      return includesText(
        [
          r.patient?.full_name,
          svc,
          translateService(svc),
          status,
          translateStatus(status),
          normalizeDateOnly(r.date),
        ],
        q
      );
    })
    .slice(0, 5)
    .map((r) => {
      const patientName = r.patient?.full_name || t('common.roles.patient');
      const serviceLabel =
        translateService(r.service) || t('common.services.generalConsultation');
      const statusLabel = translateStatus(r.status);
      const searchTerm = r.patient?.full_name || r.service || '';
      return {
        id: `request:${r.id}`,
        label: patientName,
        subtitle: [serviceLabel, statusLabel, normalizeDateOnly(r.date)]
          .filter(Boolean)
          .join(' • '),
        to: `/provider/requests?q=${encodeURIComponent(searchTerm)}`,
        avatar: r.patient?.avatar_url || '',
        kind: 'request',
      };
    });

  if (matchedRequests.length > 0) {
    groups.push({
      key: 'requests',
      label: t('nav.search.requests'),
      items: matchedRequests,
    });
  }

  const matchedSchedule = requests
    .filter((r) => {
      if (!ELIGIBLE_VISIT_STATUSES.has(r.status)) return false;
      const dateOnly = normalizeDateOnly(r.date);
      if (!dateOnly) return false;
      const svc = r.service || '';
      return includesText(
        [r.patient?.full_name, svc, translateService(svc), dateOnly, r.time],
        q
      );
    })
    .slice(0, 4)
    .map((r) => {
      const dateOnly = normalizeDateOnly(r.date);
      const patientName = r.patient?.full_name || t('common.roles.patient');
      const serviceLabel =
        translateService(r.service) || t('common.services.generalConsultation');
      return {
        id: `schedule:${r.id}`,
        label: patientName,
        subtitle: [dateOnly, r.time, serviceLabel].filter(Boolean).join(' • '),
        to: `/provider/schedule?date=${encodeURIComponent(dateOnly)}&appt=${encodeURIComponent(r.id)}`,
        avatar: r.patient?.avatar_url || '',
        kind: 'schedule',
      };
    });

  if (matchedSchedule.length > 0) {
    groups.push({
      key: 'schedule',
      label: t('nav.search.schedule'),
      items: matchedSchedule,
    });
  }

  const seenChats = new Set();
  const matchedConversations = [];
  for (const r of requests) {
    if (!ELIGIBLE_VISIT_STATUSES.has(r.status)) continue;
    const partnerId = r.patient_id || r.patient?.id;
    const partnerName = r.patient?.full_name || '';
    if (!partnerId || !partnerName || seenChats.has(partnerId)) continue;
    if (!partnerName.toLowerCase().includes(q)) continue;
    seenChats.add(partnerId);
    matchedConversations.push({
      id: `chat:${partnerId}`,
      label: partnerName,
      subtitle: t('nav.search.chatSubtitle'),
      to: `/provider/messages?partner=${encodeURIComponent(partnerId)}&name=${encodeURIComponent(partnerName)}`,
      avatar: r.patient?.avatar_url || '',
      kind: 'conversation',
    });
    if (matchedConversations.length >= 4) break;
  }

  if (matchedConversations.length > 0) {
    groups.push({
      key: 'conversations',
      label: t('nav.search.conversations'),
      items: matchedConversations,
    });
  }

  return groups;
};

const searchAdminRecords = async (rawQuery, { translateService, translateStatus, t }) => {
  const safe = sanitizePostgrestQuery(rawQuery);
  if (safe.length < 2) return [];

  const pattern = `%${safe}%`;
  const lower = safe.toLowerCase();

  const [patientsRes, providersRes, announcementsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, email, avatar_url, is_banned')
      .eq('role', 'patient')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('users')
      .select('id, full_name, email, avatar_url, is_banned')
      .eq('role', 'provider')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(5),
    supabase
      .from('announcements')
      .select('id, title, message, target_audience, created_at')
      .or(`title.ilike.${pattern},message.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const matchedPatients = patientsRes?.error ? [] : patientsRes?.data || [];
  const matchedProviders = providersRes?.error ? [] : providersRes?.data || [];

  const requestOrClauses = [
    `service.ilike.${pattern}`,
    `status.ilike.${pattern}`,
  ];
  const patientIds = matchedPatients.map((u) => u.id).filter(Boolean);
  const providerIds = matchedProviders.map((u) => u.id).filter(Boolean);
  if (patientIds.length > 0) {
    requestOrClauses.push(`patient_id.in.(${patientIds.join(',')})`);
  }
  if (providerIds.length > 0) {
    requestOrClauses.push(`provider_id.in.(${providerIds.join(',')})`);
  }

  const requestsRes = await supabase
    .from('requests')
    .select(
      'id, service, status, date, time, patient:patient_id(full_name), provider:provider_id(full_name)'
    )
    .or(requestOrClauses.join(','))
    .order('created_at', { ascending: false })
    .limit(5);

  const groups = [];

  if (matchedPatients.length > 0) {
    groups.push({
      key: 'patients',
      label: t('nav.search.patients'),
      items: matchedPatients.map((u) => {
        const name = u.full_name || t('common.roles.patient');
        const statusText = u.is_banned
          ? t('nav.search.statusBanned')
          : t('nav.search.statusActive');
        return {
          id: `admin-patient:${u.id}`,
          label: name,
          subtitle: u.email || statusText,
          recentSubtitle: `${t('common.roles.patient')} • ${statusText}`,
          to: `/admin/patients?q=${encodeURIComponent(name)}`,
          avatar: u.avatar_url || '',
          kind: 'patient',
        };
      }),
    });
  }

  if (matchedProviders.length > 0) {
    groups.push({
      key: 'providers',
      label: t('nav.search.providers'),
      items: matchedProviders.map((u) => {
        const name = u.full_name || t('common.roles.provider');
        const statusText = u.is_banned
          ? t('nav.search.statusBanned')
          : t('nav.search.statusActive');
        return {
          id: `admin-provider:${u.id}`,
          label: name,
          subtitle: u.email || statusText,
          recentSubtitle: `${t('common.roles.provider')} • ${statusText}`,
          to: `/admin/providers?q=${encodeURIComponent(name)}`,
          avatar: u.avatar_url || '',
          kind: 'provider',
        };
      }),
    });
  }

  const matchedRequests = requestsRes?.error ? [] : requestsRes?.data || [];
  if (matchedRequests.length > 0) {
    groups.push({
      key: 'requests',
      label: t('nav.search.requests'),
      items: matchedRequests.map((r) => {
        const patientName = r.patient?.full_name || '';
        const providerName = r.provider?.full_name || '';
        const serviceLabel =
          translateService(r.service) || t('common.services.generalConsultation');
        const statusLabel = translateStatus(r.status);
        const searchTerm = patientName || providerName || r.service || '';
        return {
          id: `admin-request:${r.id}`,
          label: patientName || serviceLabel,
          subtitle: [serviceLabel, providerName, statusLabel]
            .filter(Boolean)
            .join(' • '),
          to: `/admin/requests?q=${encodeURIComponent(searchTerm)}`,
          kind: 'request',
        };
      }),
    });
  }

  const annErrorCode = announcementsRes?.error?.code;
  const annRows =
    announcementsRes?.error &&
    (annErrorCode === '42P01' || annErrorCode === 'PGRST205')
      ? []
      : announcementsRes?.error
      ? []
      : announcementsRes?.data || [];

  const matchedAnnouncements = annRows
    .map(parseAnnouncementRecord)
    .filter(Boolean)
    .filter((rec) =>
      includesText([rec.title, rec.cleanMessage, rec.eventTag], lower)
    )
    .slice(0, 5)
    .map((rec) => ({
      id: `admin-announcement:${rec.id}`,
      label: rec.title || t('nav.search.announcements'),
      subtitle: [rec.eventTag, rec.cleanMessage].filter(Boolean).join(' • '),
      to: `/admin/announcements?q=${encodeURIComponent(rec.title || '')}`,
      kind: 'announcement',
    }));

  if (matchedAnnouncements.length > 0) {
    groups.push({
      key: 'announcements',
      label: t('nav.search.announcements'),
      items: matchedAnnouncements,
    });
  }

  return groups;
};

export const searchLiveRecords = async ({
  role,
  userId,
  query,
  translateService = (s) => s,
  translateStatus = (s) => s,
  t = (k) => k,
}) => {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (trimmed.length < 2 || !userId) return [];

  try {
    if (role === 'patient') {
      const dataset = await getCachedRoleDataset('patient', userId);
      return buildPatientResults(dataset, trimmed.toLowerCase(), {
        translateService,
        translateStatus,
        t,
      });
    }
    if (role === 'provider') {
      const dataset = await getCachedRoleDataset('provider', userId);
      return buildProviderResults(dataset, trimmed.toLowerCase(), {
        translateService,
        translateStatus,
        t,
      });
    }
    if (role === 'admin') {
      return await searchAdminRecords(trimmed, {
        translateService,
        translateStatus,
        t,
      });
    }
    return [];
  } catch {
    return [];
  }
};
