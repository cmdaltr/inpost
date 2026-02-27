import type {
  BlockObjectResponse,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { createNotionClient } from './client.js';
import { blocksToMarkdown } from './converter.js';
import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { notionLimiter } from '../../utils/rate-limiter.js';
import { createChildLogger } from '../../utils/logger.js';
import type { NotionPost } from '../../types/index.js';
import type { Tone } from '../../types/index.js';

const log = createChildLogger('notion:reader');

function extractTitle(page: PageObjectResponse): string {
  const prop = page.properties[defaultConfig.notion.titleProperty];
  if (prop?.type === 'title') {
    return prop.title.map((t) => t.plain_text).join('');
  }
  return 'Untitled';
}

function extractSelect(
  page: PageObjectResponse,
  property: string,
): string | undefined {
  const prop = page.properties[property];
  if (prop?.type === 'select' && prop.select) {
    return prop.select.name;
  }
  return undefined;
}

function extractMultiSelect(
  page: PageObjectResponse,
  property: string,
): string[] {
  const prop = page.properties[property];
  if (prop?.type === 'multi_select') {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

function extractUrl(
  page: PageObjectResponse,
  property: string,
): string | undefined {
  const prop = page.properties[property];
  if (prop?.type === 'url') {
    return prop.url ?? undefined;
  }
  return undefined;
}

function extractRichText(
  page: PageObjectResponse,
  property: string,
): string | undefined {
  const prop = page.properties[property];
  if (prop?.type === 'rich_text') {
    const text = prop.rich_text.map((t) => t.plain_text).join('');
    return text || undefined;
  }
  return undefined;
}

export interface NotionPostSummary {
  id: string;
  title: string;
  status: string;
}

export interface NotionReader {
  fetchByStatus(status: string, limit: number): Promise<NotionPost[]>;
  fetchByTitle(title: string): Promise<NotionPost | null>;
  fetchPage(pageId: string): Promise<NotionPost>;
  listTitles(limit: number): Promise<NotionPostSummary[]>;
  listStatuses(): Promise<string[]>;
}

export function createNotionReader(
  token: string,
  databaseId: string,
): NotionReader {
  const client = createNotionClient(token);
  const cfg = defaultConfig.notion;

  async function getPageBlocks(pageId: string): Promise<BlockObjectResponse[]> {
    const blocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      await notionLimiter.acquire();
      const response = await withRetry(() =>
        client.blocks.children.list({
          block_id: pageId,
          start_cursor: cursor,
          page_size: 100,
        }),
      );

      for (const block of response.results) {
        if ('type' in block) {
          blocks.push(block as BlockObjectResponse);
        }
      }

      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return blocks;
  }

  function pageToPost(
    page: PageObjectResponse,
    content: string,
  ): NotionPost {
    return {
      id: page.id,
      title: extractTitle(page),
      status: extractSelect(page, cfg.statusProperty) || 'Unknown',
      content,
      tone: extractSelect(page, cfg.toneProperty) as Tone | undefined,
      tags: extractMultiSelect(page, cfg.tagsProperty),
      linkedinUrl: extractUrl(page, cfg.linkedinUrlProperty),
      aiSummary: extractRichText(page, cfg.aiSummaryProperty),
      blogUrl: extractUrl(page, cfg.blogUrlProperty) || page.url,
    };
  }

  return {
    async fetchByStatus(status: string, limit: number): Promise<NotionPost[]> {
      log.info({ status, limit }, 'Fetching posts from Notion');

      await notionLimiter.acquire();
      const response = await withRetry(() =>
        client.request({
          path: `databases/${databaseId}/query`,
          method: 'post',
          body: {
            filter: {
              property: cfg.statusProperty,
              select: { equals: status },
            },
            page_size: Math.min(limit, 100),
          },
        }),
      ) as { results: unknown[] };

      const posts: NotionPost[] = [];
      for (const page of response.results as Record<string, unknown>[]) {
        if (!('properties' in page)) continue;
        const typedPage = page as PageObjectResponse;
        const blocks = await getPageBlocks(typedPage.id);
        const content = blocksToMarkdown(blocks);
        posts.push(pageToPost(typedPage, content));
      }

      log.info({ count: posts.length }, 'Fetched posts');
      return posts;
    },

    async fetchByTitle(title: string): Promise<NotionPost | null> {
      log.info({ title }, 'Fetching page by title');

      await notionLimiter.acquire();
      const response = await withRetry(() =>
        client.request({
          path: `databases/${databaseId}/query`,
          method: 'post',
          body: {
            filter: {
              property: cfg.titleProperty,
              title: { equals: title },
            },
            page_size: 1,
          },
        }),
      ) as { results: Record<string, unknown>[] };

      if (response.results.length === 0) {
        return null;
      }

      const page = response.results[0] as PageObjectResponse;
      const blocks = await getPageBlocks(page.id);
      const content = blocksToMarkdown(blocks);

      return pageToPost(page, content);
    },

    async fetchPage(pageId: string): Promise<NotionPost> {
      log.info({ pageId }, 'Fetching single page');

      await notionLimiter.acquire();
      const page = (await withRetry(() =>
        client.pages.retrieve({ page_id: pageId }),
      )) as PageObjectResponse;

      const blocks = await getPageBlocks(pageId);
      const content = blocksToMarkdown(blocks);

      return pageToPost(page, content);
    },

    async listTitles(limit: number): Promise<NotionPostSummary[]> {
      log.info({ limit }, 'Listing all titles from Notion');

      const summaries: NotionPostSummary[] = [];
      let cursor: string | undefined;

      do {
        await notionLimiter.acquire();
        const response = await withRetry(() =>
          client.request({
            path: `databases/${databaseId}/query`,
            method: 'post',
            body: {
              sorts: [{ property: cfg.titleProperty, direction: 'ascending' }],
              page_size: Math.min(limit - summaries.length, 100),
              ...(cursor ? { start_cursor: cursor } : {}),
            },
          }),
        ) as { results: unknown[]; has_more: boolean; next_cursor: string | null };

        for (const page of response.results as Record<string, unknown>[]) {
          if (!('properties' in page)) continue;
          const typedPage = page as PageObjectResponse;
          summaries.push({
            id: typedPage.id,
            title: extractTitle(typedPage),
            status: extractSelect(typedPage, cfg.statusProperty) || 'Unknown',
          });
        }

        cursor = response.has_more && summaries.length < limit
          ? response.next_cursor ?? undefined
          : undefined;
      } while (cursor);

      log.info({ count: summaries.length }, 'Listed titles');
      return summaries;
    },

    async listStatuses(): Promise<string[]> {
      log.info({}, 'Fetching available statuses from database schema');

      await notionLimiter.acquire();
      const db = await withRetry(() =>
        client.databases.retrieve({ database_id: databaseId }),
      );

      if (!('properties' in db)) return [];

      const properties = db.properties as Record<string, { type: string; select?: { options: { name: string }[] } }>;
      const prop = properties[cfg.statusProperty];
      if (prop?.type === 'select' && prop.select) {
        return prop.select.options.map((o) => o.name);
      }

      return [];
    },
  };
}
