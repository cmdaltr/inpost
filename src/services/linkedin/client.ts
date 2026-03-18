import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { linkedInLimiter } from '../../utils/rate-limiter.js';
import { LinkedInError, LinkedInAuthError } from '../../utils/errors.js';
import {
  readCredentials,
  isTokenExpired,
} from './token-store.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('linkedin:client');
const cfg = defaultConfig.linkedin;

export interface LinkedInClient {
  createPost(text: string, visibility: 'PUBLIC' | 'CONNECTIONS'): Promise<{
    postId: string;
    postUrl: string;
  }>;
}

export function createLinkedInClient(): LinkedInClient {
  function getCredentials() {
    const creds = readCredentials();
    if (!creds) {
      throw new LinkedInAuthError(
        'Not authenticated. Run "inpost auth" first.',
      );
    }
    if (isTokenExpired(creds)) {
      throw new LinkedInAuthError(
        'LinkedIn token has expired. Run "inpost auth" to re-authenticate.',
      );
    }
    return creds;
  }

  return {
    async createPost(text: string, visibility: 'PUBLIC' | 'CONNECTIONS') {
      const creds = getCredentials();

      const body = {
        author: creds.personUrn,
        commentary: text,
        visibility,
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      log.info({ visibility, commentaryLength: text.length }, 'Creating LinkedIn post');
      log.debug({ commentary: text }, 'Full post text being sent');

      await linkedInLimiter.acquire();

      const response = await withRetry(
        async () => {
          const res = await fetch(`${cfg.baseUrl}${cfg.postsEndpoint}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.accessToken}`,
              'Content-Type': 'application/json',
              'LinkedIn-Version': cfg.apiVersion,
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errorText = await res.text();
            const err = new LinkedInError(
              `LinkedIn API error (${res.status}): ${errorText}`,
              `LINKEDIN_${res.status}`,
            );
            (err as LinkedInError & { status: number }).status = res.status;
            throw err;
          }

          return res;
        },
        { retryableStatusCodes: [429, 500, 502, 503] },
      );

      const postId =
        response.headers.get('x-restli-id') || '';
      const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

      log.info({ postId, postUrl }, 'Post created successfully');

      return { postId, postUrl };
    },
  };
}
