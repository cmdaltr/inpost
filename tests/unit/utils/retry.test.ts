import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRetryableError } from '../../../src/utils/retry.js';

describe('isRetryableError', () => {
  it('returns true for retryable status codes', () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 });
    expect(isRetryableError(error, [429, 500, 503])).toBe(true);
  });

  it('returns false for non-retryable status codes', () => {
    const error = Object.assign(new Error('bad request'), { status: 400 });
    expect(isRetryableError(error, [429, 500, 503])).toBe(false);
  });

  it('returns false for errors without status', () => {
    const error = new Error('network error');
    expect(isRetryableError(error, [429, 500])).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable errors and succeeds', async () => {
    const retryableError = Object.assign(new Error('rate limited'), {
      status: 429,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 1,
      retryableStatusCodes: [429],
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retryable errors', async () => {
    const nonRetryableError = Object.assign(new Error('bad request'), {
      status: 400,
    });
    const fn = vi.fn().mockRejectedValue(nonRetryableError);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
        retryableStatusCodes: [429],
      }),
    ).rejects.toThrow('bad request');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all attempts', async () => {
    const retryableError = Object.assign(new Error('server error'), {
      status: 500,
    });
    const fn = vi.fn().mockRejectedValue(retryableError);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1,
        retryableStatusCodes: [500],
      }),
    ).rejects.toThrow('server error');

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
