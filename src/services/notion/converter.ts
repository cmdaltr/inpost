import type {
  BlockObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('notion:converter');

function richTextToPlain(richText: RichTextItemResponse[]): string {
  return richText.map((rt) => rt.plain_text).join('');
}

function richTextToMarkdown(richText: RichTextItemResponse[]): string {
  return richText
    .map((rt) => {
      let text = rt.plain_text;
      if (rt.annotations.bold) text = `**${text}**`;
      if (rt.annotations.italic) text = `*${text}*`;
      if (rt.annotations.code) text = `\`${text}\``;
      if (rt.annotations.strikethrough) text = `~~${text}~~`;
      if (rt.href) text = `[${text}](${rt.href})`;
      return text;
    })
    .join('');
}

function blockToMarkdown(block: BlockObjectResponse): string {
  switch (block.type) {
    case 'paragraph':
      return richTextToMarkdown(block.paragraph.rich_text);

    case 'heading_1':
      return `# ${richTextToMarkdown(block.heading_1.rich_text)}`;

    case 'heading_2':
      return `## ${richTextToMarkdown(block.heading_2.rich_text)}`;

    case 'heading_3':
      return `### ${richTextToMarkdown(block.heading_3.rich_text)}`;

    case 'bulleted_list_item':
      return `- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`;

    case 'numbered_list_item':
      return `1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`;

    case 'to_do': {
      const checked = block.to_do.checked ? 'x' : ' ';
      return `- [${checked}] ${richTextToMarkdown(block.to_do.rich_text)}`;
    }

    case 'toggle':
      return richTextToMarkdown(block.toggle.rich_text);

    case 'code':
      return `\`\`\`${block.code.language}\n${richTextToPlain(block.code.rich_text)}\n\`\`\``;

    case 'quote':
      return `> ${richTextToMarkdown(block.quote.rich_text)}`;

    case 'callout':
      return `> ${richTextToMarkdown(block.callout.rich_text)}`;

    case 'divider':
      return '---';

    case 'image': {
      const caption =
        block.image.caption.length > 0
          ? richTextToPlain(block.image.caption)
          : 'Image';
      return `[${caption}]`;
    }

    case 'bookmark':
      return block.bookmark.url;

    case 'embed':
      return block.embed.url;

    default:
      log.debug({ type: block.type }, 'Unsupported block type, skipping');
      return '';
  }
}

function blockToPlainText(block: BlockObjectResponse): string {
  switch (block.type) {
    case 'paragraph':
      return richTextToPlain(block.paragraph.rich_text);

    case 'heading_1':
      return richTextToPlain(block.heading_1.rich_text).toUpperCase();

    case 'heading_2':
      return richTextToPlain(block.heading_2.rich_text);

    case 'heading_3':
      return richTextToPlain(block.heading_3.rich_text);

    case 'bulleted_list_item':
      return `• ${richTextToPlain(block.bulleted_list_item.rich_text)}`;

    case 'numbered_list_item':
      return richTextToPlain(block.numbered_list_item.rich_text);

    case 'to_do':
      return richTextToPlain(block.to_do.rich_text);

    case 'toggle':
      return richTextToPlain(block.toggle.rich_text);

    case 'code':
      return richTextToPlain(block.code.rich_text);

    case 'quote':
      return richTextToPlain(block.quote.rich_text);

    case 'callout':
      return richTextToPlain(block.callout.rich_text);

    case 'divider':
      return '';

    case 'image':
      return '';

    default:
      return '';
  }
}

export function blocksToMarkdown(blocks: BlockObjectResponse[]): string {
  return blocks
    .map(blockToMarkdown)
    .filter((line) => line !== '')
    .join('\n\n');
}

export function blocksToPlainText(blocks: BlockObjectResponse[]): string {
  return blocks
    .map(blockToPlainText)
    .filter((line) => line !== '')
    .join('\n\n');
}
