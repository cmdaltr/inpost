/**
 * OneNoteProvider
 *
 * Reads pages from Microsoft OneNote via the Microsoft Graph API.
 * Requires an Azure AD app registration with the Notes.ReadWrite.All scope.
 *
 * Environment variables:
 *   ONENOTE_CLIENT_ID       Azure AD app client ID
 *   ONENOTE_CLIENT_SECRET   Azure AD app client secret
 *   ONENOTE_TENANT_ID       Azure AD tenant ID (use "consumers" for personal accounts)
 *   ONENOTE_REDIRECT_URI    OAuth redirect URI (default: http://localhost:3456/callback)
 *
 * Credentials are cached in ~/.inpost/onenote-credentials.json
 * Run `inpost auth --onenote` to authenticate.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { NoteContent, NoteProvider } from './NoteProvider.js';

const CREDENTIALS_PATH = path.join(os.homedir(), '.inpost', 'onenote-credentials.json');
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me/onenote';

interface OnenoteCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface GraphPage {
  id: string;
  title: string;
  lastModifiedDateTime: string;
  contentUrl: string;
}

interface GraphResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export class OneNoteProvider implements NoteProvider {
  readonly providerName = 'OneNote';

  private credentials: OnenoteCredentials | null = null;

  // ─── Auth ────────────────────────────────────────────────────────────────

  private loadCredentials(): OnenoteCredentials {
    if (this.credentials) return this.credentials;
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        'OneNote credentials not found. Run `inpost auth --onenote` to authenticate.'
      );
    }
    this.credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    return this.credentials!;
  }

  private async getValidToken(): Promise<string> {
    const creds = this.loadCredentials();
    const expiresAt = new Date(creds.expiresAt).getTime();

    // Refresh if within 5 minutes of expiry
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      return this.refreshAccessToken(creds.refreshToken);
    }

    return creds.accessToken;
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const tenantId = process.env.ONENOTE_TENANT_ID ?? 'consumers';
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.ONENOTE_CLIENT_ID ?? '',
          client_secret: process.env.ONENOTE_CLIENT_SECRET ?? '',
          scope: 'Notes.ReadWrite.All offline_access',
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`OneNote token refresh failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const updated: OnenoteCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };

    fs.mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(updated, null, 2), { mode: 0o600 });
    this.credentials = updated;

    return updated.accessToken;
  }

  // ─── Graph helpers ───────────────────────────────────────────────────────

  private async graphGet<T>(endpoint: string): Promise<T> {
    const token = await this.getValidToken();
    const res = await fetch(`${GRAPH_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`OneNote Graph API error: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  private async graphPatch(endpoint: string, body: string): Promise<void> {
    const token = await this.getValidToken();
    const res = await fetch(`${GRAPH_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`OneNote Graph API patch error: ${res.status} ${await res.text()}`);
    }
  }

  /** Extract plain text from OneNote HTML content */
  private async fetchPageContent(page: GraphPage): Promise<string> {
    const token = await this.getValidToken();
    const res = await fetch(page.contentUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch OneNote page content: ${res.status}`);
    }
    const html = await res.text();
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private pageToNoteContent(page: GraphPage, text: string): NoteContent {
    return {
      id: page.id,
      title: page.title,
      text,
      updatedAt: page.lastModifiedDateTime,
    };
  }

  // ─── NoteProvider interface ──────────────────────────────────────────────

  async fetchByTitle(title: string): Promise<NoteContent> {
    const encoded = encodeURIComponent(title);
    const data = await this.graphGet<GraphResponse<GraphPage>>(
      `/pages?$filter=contains(title,'${encoded}')&$select=id,title,lastModifiedDateTime,contentUrl&$top=1`
    );

    if (!data.value?.length) {
      throw new Error(`OneNote: no page found with title containing "${title}"`);
    }

    const page = data.value[0];
    const text = await this.fetchPageContent(page);
    return this.pageToNoteContent(page, text);
  }

  async fetchById(id: string): Promise<NoteContent> {
    const page = await this.graphGet<GraphPage>(
      `/pages/${id}?$select=id,title,lastModifiedDateTime,contentUrl`
    );
    const text = await this.fetchPageContent(page);
    return this.pageToNoteContent(page, text);
  }

  async saveAISummary(id: string, summary: string): Promise<void> {
    const commands = JSON.stringify([
      {
        target: 'body',
        action: 'append',
        content: `<p><strong>AI Summary (InPost)</strong></p><p>${summary.replace(/\n/g, '<br/>')}</p>`,
      },
    ]);
    await this.graphPatch(`/pages/${id}/content`, commands);
  }
}
