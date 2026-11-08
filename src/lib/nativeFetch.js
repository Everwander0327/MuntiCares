import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Android throttles WebView HTTP after ~5 minutes in the background, which makes
 * Supabase location persistence and heartbeats go stale mid-visit. Routing the
 * Supabase client's fetch through CapacitorHttp (native OkHttp) keeps those
 * requests alive while the app is backgrounded. Web builds keep the browser fetch.
 */

export function toCapacitorRequest(url, options = {}) {
  const req = {
    url: String(url),
    method: (options.method || 'GET').toUpperCase(),
    headers: options.headers || {},
    responseType: 'text',
  };
  if (options.body != null) req.data = options.body;
  return req;
}

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

export function toFetchResponse(result) {
  const status = result.status;
  const body = NULL_BODY_STATUSES.has(status)
    ? null
    : typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data ?? '');
  return new Response(body, { status, headers: result.headers });
}

export function makeCapacitorFetch(http) {
  return async (url, options = {}) => {
    const response = await http.request(toCapacitorRequest(url, options));
    return toFetchResponse(response);
  };
}

export function resolveFetch() {
  return Capacitor.isNativePlatform()
    ? makeCapacitorFetch(CapacitorHttp)
    : globalThis.fetch;
}
