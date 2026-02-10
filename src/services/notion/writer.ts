import { createNotionClient } from './client.js';
import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { notionLimiter } from '../../utils/rate-limiter.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('notion:writer');

export interface NotionWriter {
  updateStatus(pageId: string, status: string): Promise<void>;
  markPublished(
    pageId: string,
    linkedinUrl: string,
    postId: string,
  ): Promise<void>;
  markError(pageId: string, errorMessage: string): Promise<void>;
  updateAISummary(pageId: string, summary: string): Promise<void>;
  updateVariants(pageId: string, variants: string): Promise<void>;
}

export function createNotionWriter(token: string): NotionWriter {
  const client = createNotionClient(token);
  const cfg = defaultConfig.notion;

  async function updateProperties(
    pageId: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    await notionLimiter.acquire();
    await withRetry(() =>
      client.pages.update({
        page_id: pageId,
        properties: properties as Parameters<typeof client.pages.update>[0]['properties'],
      }),
    );
  }

  return {
    async updateStatus(pageId: string, status: string): Promise<void> {
      log.info({ pageId, status }, 'Updating status');
      await updateProperties(pageId, {
        [cfg.statusProperty]: { select: { name: status } },
      });
    },

    async markPublished(
      pageId: string,
      linkedinUrl: string,
      postId: string,
    ): Promise<void> {
      log.info({ pageId, linkedinUrl }, 'Marking as published');
      await updateProperties(pageId, {
        [cfg.statusProperty]: { select: { name: cfg.publishedValue } },
        [cfg.linkedinUrlProperty]: { url: linkedinUrl },
        [cfg.publishedDateProperty]: {
          date: { start: new Date().toISOString() },
        },
        [cfg.linkedinPostIdProperty]: {
          rich_text: [{ text: { content: postId } }],
        },
      });
    },

    async markError(pageId: string, errorMessage: string): Promise<void> {
      log.warn({ pageId, error: errorMessage }, 'Marking as error');
      await updateProperties(pageId, {
        [cfg.statusProperty]: { select: { name: cfg.errorValue } },
        [cfg.errorLogProperty]: {
          rich_text: [
            {
              text: {
                content: `${new Date().toISOString()}: ${errorMessage}`.slice(
                  0,
                  2000,
                ),
              },
            },
          ],
        },
      });
    },

    async updateAISummary(pageId: string, summary: string): Promise<void> {
      log.info({ pageId }, 'Updating AI summary');
      await updateProperties(pageId, {
        [cfg.aiSummaryProperty]: {
          rich_text: [{ text: { content: summary.slice(0, 2000) } }],
        },
      });
    },

    async updateVariants(pageId: string, variants: string): Promise<void> {
      log.info({ pageId }, 'Updating variants');
      await updateProperties(pageId, {
        [cfg.variantsProperty]: {
          rich_text: [{ text: { content: variants.slice(0, 2000) } }],
        },
      });
    },
  };
}
