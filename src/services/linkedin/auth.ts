import http from 'node:http';
import crypto from 'node:crypto';
import chalk from 'chalk';
import open from 'open';
import { defaultConfig } from '../../../config/default.js';
import { tryLoadEnv } from '../../../config/index.js';
import { linkedInAuthSchema } from '../../../config/schema.js';
import {
  writeCredentials,
  type StoredCredentials,
} from './token-store.js';
import { LinkedInAuthError } from '../../utils/errors.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('linkedin:auth');
const cfg = defaultConfig.linkedin;

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new LinkedInAuthError(`Token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<{
    access_token: string;
    expires_in: number;
  }>;
}

async function fetchPersonUrn(accessToken: string): Promise<string> {
  const response = await fetch(cfg.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new LinkedInAuthError(`Failed to fetch user info (${response.status})`);
  }

  const data = (await response.json()) as { sub: string };
  return `urn:li:person:${data.sub}`;
}

export async function startOAuthFlow(port: number): Promise<void> {
  const env = tryLoadEnv();
  const authResult = linkedInAuthSchema.safeParse(env);
  if (!authResult.success) {
    console.error(
      chalk.red(
        'Missing LinkedIn credentials. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env',
      ),
    );
    process.exit(1);
  }

  const { LINKEDIN_CLIENT_ID: clientId, LINKEDIN_CLIENT_SECRET: clientSecret } =
    authResult.data;
  const redirectUri = `http://localhost:${port}/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(cfg.authUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', cfg.scopes.join(' '));

  return new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`Authorization failed: ${error}`);
        server.close();
        reject(new LinkedInAuthError(`Authorization denied: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('Invalid state parameter');
        server.close();
        reject(new LinkedInAuthError('CSRF state mismatch'));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        server.close();
        reject(new LinkedInAuthError('No authorization code received'));
        return;
      }

      try {
        console.log(chalk.dim('Exchanging code for access token...'));
        const tokenData = await exchangeCodeForToken(
          code,
          clientId,
          clientSecret,
          redirectUri,
        );

        console.log(chalk.dim('Fetching user profile...'));
        const personUrn = await fetchPersonUrn(tokenData.access_token);

        const expiresAt = new Date(
          Date.now() + tokenData.expires_in * 1000,
        ).toISOString();

        const creds: StoredCredentials = {
          accessToken: tokenData.access_token,
          expiresAt,
          personUrn,
          createdAt: new Date().toISOString(),
        };

        writeCredentials(creds);

        const daysUntilExpiry = Math.ceil(tokenData.expires_in / 86400);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body><h1>Authentication successful!</h1><p>You can close this window.</p></body></html>',
        );

        console.log(chalk.green('\nAuthentication successful!'));
        console.log(`  Person URN:  ${personUrn}`);
        console.log(`  Token valid: ${daysUntilExpiry} days`);
        console.log(`  Expires at:  ${expiresAt}\n`);

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500);
        res.end('Authentication failed');
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      log.info({ port }, 'OAuth callback server started');
      console.log(chalk.dim(`Callback server listening on port ${port}`));
      console.log(chalk.bold('\nOpening browser for LinkedIn authorization...\n'));
      open(authUrl.toString()).catch(() => {
        console.log(
          chalk.yellow('Could not open browser. Visit this URL manually:\n'),
        );
        console.log(`  ${authUrl.toString()}\n`);
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new LinkedInAuthError('OAuth flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}
