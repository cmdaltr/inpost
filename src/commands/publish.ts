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

export function registerPublishCommand(program: Command): void {
  program
    .command('publish [text]')
    .description('Publish content to LinkedIn')
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
      const env = loadEnv();

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

      const publisher = createLinkedInPublisher();

      console.log(chalk.dim('\nPublishing to LinkedIn...\n'));

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
