import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('linkedin:token-store');

export interface StoredCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  personUrn: string;
  createdAt: string;
}

function getCredentialsDir(): string {
  return path.join(os.homedir(), '.inpost');
}

function getCredentialsPath(): string {
  return path.join(getCredentialsDir(), 'credentials.json');
}

export function readCredentials(): StoredCredentials | null {
  const credPath = getCredentialsPath();
  try {
    if (!fs.existsSync(credPath)) return null;
    const data = fs.readFileSync(credPath, 'utf-8');
    return JSON.parse(data) as StoredCredentials;
  } catch (error) {
    log.warn({ error }, 'Failed to read credentials');
    return null;
  }
}

export function writeCredentials(creds: StoredCredentials): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const credPath = getCredentialsPath();
  fs.writeFileSync(credPath, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
  log.info('Credentials saved to %s', credPath);
}

export function deleteCredentials(): void {
  const credPath = getCredentialsPath();
  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath);
    log.info('Credentials deleted');
  }
}

export function isTokenExpired(creds: StoredCredentials): boolean {
  const expiresAt = new Date(creds.expiresAt);
  const buffer = 5 * 60 * 1000; // 5 minutes buffer
  return Date.now() >= expiresAt.getTime() - buffer;
}
