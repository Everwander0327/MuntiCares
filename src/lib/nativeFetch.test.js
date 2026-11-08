import { describe, it, expect, vi } from 'vitest';
import { toCapacitorRequest, toFetchResponse, makeCapacitorFetch } from './nativeFetch';

describe('toCapacitorRequest', () => {
  it('maps a GET with no options', () => {
    expect(toCapacitorRequest('https://x.supabase.co/rest/v1/users')).toEqual({
      url: 'https://x.supabase.co/rest/v1/users',
      method: 'GET',
      headers: {},
      responseType: 'text',
    });
  });

  it('uppercases the method and forwards headers and body', () => {
    const req = toCapacitorRequest('https://x.supabase.co/rest/v1/users', {
      method: 'post',
      headers: { apikey: 'k', 'content-type': 'application/json' },
      body: '{"a":1}',
    });
    expect(req.method).toBe('POST');
    expect(req.headers).toEqual({ apikey: 'k', 'content-type': 'application/json' });
    expect(req.data).toBe('{"a":1}');
  });

  it('omits data when there is no body', () => {
    expect(toCapacitorRequest('https://x/', { method: 'DELETE' })).not.toHaveProperty('data');
  });

  it('coerces a non-string URL', () => {
    expect(toCapacitorRequest({ toString: () => 'https://x/' }).url).toBe('https://x/');
  });
});

describe('toFetchResponse', () => {
  it('wraps string data as the body', async () => {
    const res = toFetchResponse({
      data: '{"ok":true}',
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('stringifies object data', async () => {
    const res = toFetchResponse({ data: { ok: true }, status: 201, headers: {} });
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('produces an empty body for missing data', async () => {
    const res = toFetchResponse({ data: undefined, status: 204, headers: {} });
    expect(await res.text()).toBe('');
  });
});

describe('makeCapacitorFetch', () => {
  it('routes through the native http client and returns a Response', async () => {
    const http = {
      request: vi.fn(async () => ({
        data: '{"ok":true}',
        status: 200,
        headers: { 'content-type': 'application/json' },
      })),
    };
    const fetchFn = makeCapacitorFetch(http);

    const res = await fetchFn('https://x.supabase.co/rest/v1/users', {
      method: 'POST',
      headers: { apikey: 'k' },
      body: '{"a":1}',
    });

    expect(http.request).toHaveBeenCalledWith({
      url: 'https://x.supabase.co/rest/v1/users',
      method: 'POST',
      headers: { apikey: 'k' },
      responseType: 'text',
      data: '{"a":1}',
    });
    expect(res).toBeInstanceOf(Response);
    expect(await res.json()).toEqual({ ok: true });
  });
});
