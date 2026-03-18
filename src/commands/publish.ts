import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { createLinkedInPublisher } from '../services/linkedin/publisher.js';
import { createNotionReader } from '../services/notion/reader.js';
import { createNotionWriter } from '../services/notion/writer.js';
import { createAIClientFromEnv } from '../services/ai/provider.js';
import { generateHashtags } from '../services/ai/hashtags.js';
import { validatePostLength } from '../utils/validation.js';
import { resolveNote } from '../services/notes/NoteProviderFactory.js';
import { printCommandHelp } from '../utils/help.js';

export function registerPublishCommand(program: Command): void {
  program
    .command('publish [text]')
    .description('Publish content to LinkedIn')
    // ── Generic notebook shorthand ───────────────────────────────────────────
    .option('--notebook <provider>', 'Notebook provider (overrides DEFAULT_NOTEBOOK): notion | onenote | obsidian | evernote')
    .option('--notion', 'Shorthand for --notebook notion', false)
    .option('--onenote', 'Shorthand for --notebook onenote', false)
    .option('--obsidian', 'Shorthand for --notebook obsidian', false)
    .option('--evernote', 'Shorthand for --notebook evernote', false)
    .option('--title <title>', 'Note title — used with --notebook/provider flag as shorthand for --<provider>-title')
    .option('--id <id>', 'Note ID — used with --notebook/provider flag as shorthand for --<provider>-id')
    // ── Notion ──────────────────────────────────────────────────────────────
    .option('--notion-id <id>', 'Publish AI Summary from a Notion page by ID')
    .option('--notion-title <title>', 'Publish AI Summary from a Notion page by title')
    // ── OneNote ─────────────────────────────────────────────────────────────
    .option('--onenote-title <title>', 'Fetch content from OneNote by page title')
    .option('--onenote-id <id>', 'Fetch content from OneNote by page ID')
    // ── Obsidian ────────────────────────────────────────────────────────────
    .option('--obsidian-title <title>', 'Fetch content from Obsidian vault by note title')
    .option('--obsidian-id <id>', 'Fetch content from Obsidian vault by relative path')
    // ── Evernote ────────────────────────────────────────────────────────────
    .option('--evernote-title <title>', 'Fetch content from Evernote by note title')
    .option('--evernote-id <id>', 'Fetch content from Evernote by note GUID')
    // ── Publish options ──────────────────────────────────────────────────────
    .option('--no-hashtags', 'Disable auto-generated hashtags')
    .option('--no-link', 'Disable blog link in post')
    .option('--dry-run', 'Preview without actually posting', false)
    .option('--connections', 'Limit visibility to connections only', false)
    .action(async (textArg, options) => {
      if (textArg === '?') {
        printCommandHelp({
          command: 'publish [text]',
          summary: 'Publish a post to LinkedIn from a notebook source or direct text.',
          sections: [
            {
              heading: 'Source',
              options: [
                { flag: '--notebook <provider>', description: 'notion | onenote | obsidian | evernote', default: 'notion' },
                { flag: '--notion | --obsidian | --onenote | --evernote', description: 'Provider shorthands (combine with --title)' },
                { flag: '--title <title>', description: 'Note title — use with a provider flag' },
                { flag: '--notion-title <title>', description: 'Publish AI Summary from Notion page' },
                { flag: '--obsidian-title <title>', description: 'Publish from Obsidian note' },
                { flag: '--onenote-title <title>', description: 'Publish from OneNote page' },
                { flag: '--evernote-title <title>', description: 'Publish from Evernote note' },
              ],
            },
            {
              heading: 'Options',
              options: [
                { flag: '--dry-run', description: 'Preview without posting to LinkedIn' },
                { flag: '--no-hashtags', description: 'Disable auto-generated hashtags' },
                { flag: '--no-link', description: "Don't include the blog link in the post" },
                { flag: '--connections', description: 'Limit visibility to connections only' },
              ],
            },
          ],
          examples: [
            'inpost publish --notion-title "My Post"',
            'inpost publish --notion-title "My Post" --dry-run',
            'inpost publish --obsidian --title "My Post"',
            'inpost publish "Paste your post text here"',
          ],
        });
        return;
      }

      const env = loadEnv();

      // ── Resolve --notebook/provider shorthand + --title/--id ──────────────
      if ((options.notebook || options.notion || options.onenote || options.obsidian || options.evernote) && (options.title || options.id)) {
        const nb =
          options.notion ? 'notion' :
          options.onenote ? 'onenote' :
          options.obsidian ? 'obsidian' :
          options.evernote ? 'evernote' :
          options.notebook ?? env.DEFAULT_NOTEBOOK;
        if (nb === 'notion') {
          if (options.title) options.notionTitle = options.title;
          if (options.id) options.notionId = options.id;
        } else if (nb === 'onenote') {
          if (options.title) options.onenoteTitle = options.title;
          if (options.id) options.onenoteId = options.id;
        } else if (nb === 'obsidian') {
          if (options.title) options.obsidianTitle = options.title;
          if (options.id) options.obsidianId = options.id;
        } else if (nb === 'evernote') {
          if (options.title) options.evernoteTitle = options.title;
          if (options.id) options.evernoteId = options.id;
        }
      }

      // Resolve text to publish
      let text: string;
      let notionPageId: string | undefined;
      let tags: string[] = [];
      let blogUrl: string | undefined;

      if (options.onenoteTitle || options.onenoteId || options.obsidianTitle || options.obsidianId || options.evernoteTitle || options.evernoteId) {
        // ── New providers ────────────────────────────────────────────────
        const { provider, content: note } = await resolveNote({
          onenoteTitle: options.onenoteTitle,
          onenoteId: options.onenoteId,
          obsidianTitle: options.obsidianTitle,
          obsidianId: options.obsidianId,
          evernoteTitle: options.evernoteTitle,
          evernoteId: options.evernoteId,
        });

        console.log(chalk.dim(`\nFetched "${note.title}" from ${provider.providerName}`));
        console.log(chalk.yellow('Tip: Run `inpost transform --save` first to generate and review an AI summary before publishing.\n'));

        text = note.text;
        tags = note.tags ?? [];

      } else if (options.notionId || options.notionTitle) {
        const reader = createNotionReader(
          env.NOTION_API_TOKEN,
          env.NOTION_DATABASE_ID,
        );

        let post;
        if (options.notionId) {
          notionPageId = options.notionId;
          post = await reader.fetchPage(options.notionId);
        } else {
          post = await reader.fetchByTitle(options.notionTitle);
          if (!post) {
            console.error(
              chalk.red(`No page found with title: "${options.notionTitle}"`),
            );
            process.exit(1);
          }
          notionPageId = post.id;
        }

        tags = post.tags || [];
        blogUrl = post.blogUrl;
        // Use AI Summary if available, otherwise use raw content
        if (post.aiSummary) {
          text = post.aiSummary;
          console.log(chalk.dim(`AI Summary from Notion (${text.length} chars):`));
          console.log(chalk.dim(text));
          console.log();
        } else {
          console.error(
            chalk.yellow(
              'No AI Summary found. Run `inpost transform --notion-id <id> --save` first.',
            ),
          );
          text = post.content;
        }
      } else if (textArg) {
        text = textArg;
      } else {
        console.error(chalk.red('Error: Provide text, --notion-id, or --notion-title'));
        process.exit(1);
      }

      // Check if text already has hashtags (from AI Summary)
      const hashtagMatch = text.match(/(\n\n)(#\w+[\s#\w]*)\s*$/);
      let existingHashtags = '';
      if (hashtagMatch) {
        existingHashtags = hashtagMatch[2];
        text = text.slice(0, hashtagMatch.index);
      }

      // Append blog link (enabled by default, use --no-link to disable)
      if (options.link !== false && blogUrl) {
        text = `${text}\n\n🔗 ${blogUrl}`;
      }

      // Add hashtags at the end
      if (options.hashtags !== false) {
        if (existingHashtags) {
          // Use existing hashtags from AI Summary
          text = `${text}\n\n${existingHashtags}`;
        } else {
          // Generate new hashtags
          const env2 = loadEnv();
          const { client } = createAIClientFromEnv(env2);
          console.log(chalk.dim('Generating hashtags...'));
          const hashtags = await generateHashtags(client, text, tags);
          if (hashtags.length > 0) {
            text = `${text}\n\n${hashtags.join(' ')}`;
          }
        }
      }

      // Validate length
      const validation = validatePostLength(text);
      if (!validation.valid) {
        console.error(
          chalk.red(
            `Post exceeds LinkedIn character limit (${validation.length}/${validation.maxLength}). ` +
              `Consider using --thread or shortening the content.`,
          ),
        );
        process.exit(1);
      }

      const visibility = options.connections ? 'CONNECTIONS' : 'PUBLIC';

      if (options.dryRun) {
        console.log(chalk.bold('\n[DRY RUN] Would publish:\n'));
        console.log(text);
        console.log(
          chalk.dim(`\n(${text.length}/${validation.maxLength} characters, visibility: ${visibility})\n`),
        );
        return;
      }

      // Always show the full post text before publishing
      console.log(chalk.bold('\nFull post text being sent:\n'));
      console.log(chalk.dim('--- START ---'));
      console.log(text);
      console.log(chalk.dim('--- END ---'));
      console.log(chalk.dim(`(${text.length} characters)\n`));

      const publisher = createLinkedInPublisher();

      console.log(chalk.dim('Publishing to LinkedIn...\n'));

      const result = await publisher.publish({
        text,
        visibility,
        isDryRun: false,
      });

      console.log(chalk.green('Published successfully!'));
      console.log(`  Post URL: ${chalk.cyan(result.postUrl)}`);
      console.log(`  Post ID:  ${result.postId}`);

      // Update Notion page with LinkedIn URL
      if (notionPageId) {
        const writer = createNotionWriter(env.NOTION_API_TOKEN);
        await writer.markPublished(notionPageId, result.postUrl, result.postId);
        console.log(chalk.dim('  Notion page updated.'));
      }

      console.log();
    });
}
