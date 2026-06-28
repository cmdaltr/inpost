import { createChildLogger } from './logger.js';

const log = createChildLogger('retry');

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 529],
};

export function isRetryableError(
  error: unknown,
  retryableStatusCodes: number[],
): boolean {
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    return retryableStatusCodes.includes(status);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === opts.maxAttempts) break;

      if (
        !isRetryableError(error, opts.retryableStatusCodes ?? [])
      ) {
        throw lastError;
      }

      log.warn(
        { attempt, maxAttempts: opts.maxAttempts, delayMs: delay },
        `Attempt ${attempt} failed, retrying in ${delay}ms...`,
      );

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}
