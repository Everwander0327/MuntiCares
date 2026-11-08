import { describe, it, expect, vi } from 'vitest';
import { isCallActive, stopStreamTracks } from './callLifecycle';

describe('isCallActive', () => {
  it('is active when the same call is connected', () => {
    expect(isCallActive('connected', 'a', 'a')).toBe(true);
  });

  it('is active when the same call is still connecting', () => {
    expect(isCallActive('connecting', 'a', 'a')).toBe(true);
  });

  it('is inactive when a different call has started', () => {
    expect(isCallActive('connected', 'b', 'a')).toBe(false);
  });

  it('is inactive when the same call has ended', () => {
    expect(isCallActive('ended', 'a', 'a')).toBe(false);
  });

  it('is inactive when idle', () => {
    expect(isCallActive('idle', 'a', 'a')).toBe(false);
  });
});

describe('stopStreamTracks', () => {
  it('stops every track on the stream', () => {
    const stop = vi.fn();
    stopStreamTracks({ getTracks: () => [{ stop }, { stop }] });
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('is safe with a null stream', () => {
    expect(() => stopStreamTracks(null)).not.toThrow();
  });
});
