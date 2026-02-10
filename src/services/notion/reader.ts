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

export interface NotionReader {
  fetchByStatus(status: string, limit: number): Promise<NotionPost[]>;
  fetchPage(pageId: string): Promise<NotionPost>;
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
    };
  }

  return {
    async fetchByStatus(status: string, limit: number): Promise<NotionPost[]> {
      log.info({ status, limit }, 'Fetching posts from Notion');

      await notionLimiter.acquire();
      const response = await withRetry(() =>
        client.dataSources.query({
          data_source_id: databaseId,
          filter: {
            property: cfg.statusProperty,
            select: { equals: status },
          },
          page_size: Math.min(limit, 100),
        }),
      );

      const posts: NotionPost[] = [];
      for (const page of response.results) {
        if (!('properties' in page)) continue;
        const typedPage = page as PageObjectResponse;
        const blocks = await getPageBlocks(typedPage.id);
        const content = blocksToMarkdown(blocks);
        posts.push(pageToPost(typedPage, content));
      }

      log.info({ count: posts.length }, 'Fetched posts');
      return posts;
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
  };
}
