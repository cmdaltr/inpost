import { describe, it, expect } from 'vitest';
import { isTokenExpired } from '../../../../src/services/linkedin/token-store.js';
import type { StoredCredentials } from '../../../../src/services/linkedin/token-store.js';

function makeCreds(expiresAt: string): StoredCredentials {
  return {
    accessToken: 'test-token',
    expiresAt,
    personUrn: 'urn:li:person:123',
    createdAt: new Date().toISOString(),
  };
}

describe('isTokenExpired', () => {
  it('returns false for tokens expiring far in the future', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const creds = makeCreds(futureDate.toISOString());
    expect(isTokenExpired(creds)).toBe(false);
  });

  it('returns true for tokens already expired', () => {
    const pastDate = new Date(Date.now() - 1000);
    const creds = makeCreds(pastDate.toISOString());
    expect(isTokenExpired(creds)).toBe(true);
  });

  it('returns true for tokens expiring within 5-minute buffer', () => {
    const nearFuture = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    const creds = makeCreds(nearFuture.toISOString());
    expect(isTokenExpired(creds)).toBe(true);
  });

  it('returns false for tokens expiring just outside the buffer', () => {
    const outsideBuffer = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const creds = makeCreds(outsideBuffer.toISOString());
    expect(isTokenExpired(creds)).toBe(false);
  });
});
