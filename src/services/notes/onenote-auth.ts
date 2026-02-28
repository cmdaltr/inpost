/**
 * OneNote OAuth flow
 *
 * Called by `inpost auth --onenote`.
 * Opens a browser to Microsoft's OAuth page, receives the callback,
 * exchanges the code for tokens, and saves to ~/.inpost/onenote-credentials.json.
 *
 * Requires in .env:
 *   ONENOTE_CLIENT_ID
 *   ONENOTE_CLIENT_SECRET
 *   ONENOTE_TENANT_ID      (default: "consumers" for personal Microsoft accounts)
 *   ONENOTE_REDIRECT_URI   (default: http://localhost:3456/callback)
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import open from 'open';

const CREDENTIALS_PATH = path.join(os.homedir(), '.inpost', 'onenote-credentials.json');

export async function startOneNoteOAuthFlow(port: number): Promise<void> {
  const clientId = process.env.ONENOTE_CLIENT_ID;
  const clientSecret = process.env.ONENOTE_CLIENT_SECRET;
  const tenantId = process.env.ONENOTE_TENANT_ID ?? 'consumers';
  const redirectUri = process.env.ONENOTE_REDIRECT_URI ?? `http://localhost:${port}/callback`;

  if (!clientId || !clientSecret) {
    console.error(
      chalk.red('Missing OneNote credentials. Set ONENOTE_CLIENT_ID and ONENOTE_CLIENT_SECRET in .env')
    );
    process.exit(1);
  }

  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'Notes.ReadWrite.All offline_access');
  authUrl.searchParams.set('state', state);

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
        reject(new Error(`OneNote authorization denied: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('Invalid state parameter');
        server.close();
        reject(new Error('OneNote OAuth state mismatch'));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        server.close();
        reject(new Error('No authorization code received'));
        return;
      }

      try {
        console.log(chalk.dim('Exchanging code for access token...'));

        const tokenRes = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              scope: 'Notes.ReadWrite.All offline_access',
            }),
          }
        );

        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
        }

        const tokenData = (await tokenRes.json()) as {
          access_token: string;
          refresh_token: string;
          expires_in: number;
        };

        const credentials = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        };

        fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true, mode: 0o700 });
        fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });

        const daysUntilExpiry = Math.ceil(tokenData.expires_in / 86400);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>OneNote authentication successful!</h1><p>You can close this window.</p></body></html>');

        console.log(chalk.green('\nOneNote authentication successful!'));
        console.log(`  Token valid: ${daysUntilExpiry} days`);
        console.log(`  Saved to:    ${CREDENTIALS_PATH}\n`);

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
      console.log(chalk.bold('\nOpening browser for Microsoft OneNote authorization...\n'));
      open(authUrl.toString()).catch(() => {
        console.log(chalk.yellow('Could not open browser. Visit this URL manually:\n'));
        console.log(`  ${authUrl.toString()}\n`);
      });
    });

    setTimeout(() => {
      server.close();
      reject(new Error('OneNote OAuth flow timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}
