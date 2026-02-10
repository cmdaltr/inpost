import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('allows requests up to max tokens', async () => {
    const limiter = new RateLimiter(3, 1000);

    // Should not block for the first 3 requests
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('delays when tokens are exhausted', async () => {
    const limiter = new RateLimiter(1, 50);

    await limiter.acquire(); // uses the 1 token
    const start = Date.now();
    await limiter.acquire(); // must wait
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(30);
  });
});
