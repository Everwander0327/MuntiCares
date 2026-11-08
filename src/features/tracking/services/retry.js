const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries an async operation with exponential backoff.
 * Re-throws the last error once maxAttempts is exhausted or shouldRetry declines.
 */
export async function retryWithBackoff(fn, {
  maxAttempts = 3,
  baseDelayMs = 1000,
  shouldRetry = () => true,
  onRetry,
  sleepFn = sleep,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) throw err;
      await sleepFn(baseDelayMs * 2 ** (attempt - 1));
      onRetry?.(attempt, err);
    }
  }
  throw lastError;
}
