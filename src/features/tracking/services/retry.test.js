import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  it('returns the result on the first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1, sleepFn: () => Promise.resolve() })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue('recovered');
    const onRetry = vi.fn();
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1, sleepFn: () => Promise.resolve(), onRetry })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1, sleepFn: () => Promise.resolve() })).rejects.toThrow('network');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));
    await expect(retryWithBackoff(fn, { maxAttempts: 5, baseDelayMs: 1, sleepFn: () => Promise.resolve(), shouldRetry: () => false })).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially between attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue('ok');
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1000, sleepFn });
    expect(sleepFn).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 2000);
  });
});
