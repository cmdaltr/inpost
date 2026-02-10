import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { createLinkedInPublisher } from '../services/linkedin/publisher.js';
import { createNotionReader } from '../services/notion/reader.js';
import { createNotionWriter } from '../services/notion/writer.js';
import { validatePostLength } from '../utils/validation.js';

export function registerPublishCommand(program: Command): void {
  program
    .command('publish')
    .description('Publish content to LinkedIn')
    .option('--notion-id <id>', 'Publish AI Summary from a Notion page')
    .option('--text <string>', 'Publish text directly')
    .option('--dry-run', 'Preview without actually posting', false)
    .option(
      '--visibility <vis>',
      'PUBLIC | CONNECTIONS',
      'PUBLIC',
    )
    .option('--update-notion', 'Update Notion page after publishing', true)
    .action(async (options) => {
      const env = loadEnv();

      // Resolve text to publish
      let text: string;
      let notionPageId: string | undefined;

      if (options.notionId) {
        notionPageId = options.notionId;
        const reader = createNotionReader(
          env.NOTION_API_TOKEN,
          env.NOTION_DATABASE_ID,
        );
        const post = await reader.fetchPage(options.notionId);
        // Use AI Summary if available, otherwise use raw content
        text = post.content;
      } else if (options.text) {
        text = options.text;
      } else {
        console.error(chalk.red('Error: Provide --notion-id or --text'));
        process.exit(1);
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

      if (options.dryRun) {
        console.log(chalk.bold('\n[DRY RUN] Would publish:\n'));
        console.log(text);
        console.log(
          chalk.dim(`\n(${text.length}/${validation.maxLength} characters, visibility: ${options.visibility})\n`),
        );
        return;
      }

      const publisher = createLinkedInPublisher();

      console.log(chalk.dim('\nPublishing to LinkedIn...\n'));

      const result = await publisher.publish({
        text,
        visibility: options.visibility as 'PUBLIC' | 'CONNECTIONS',
        isDryRun: false,
      });

      console.log(chalk.green('Published successfully!'));
      console.log(`  Post URL: ${chalk.cyan(result.postUrl)}`);
      console.log(`  Post ID:  ${result.postId}`);

      // Update Notion if requested
      if (options.updateNotion && notionPageId) {
        const writer = createNotionWriter(env.NOTION_API_TOKEN);
        await writer.markPublished(notionPageId, result.postUrl, result.postId);
        console.log(chalk.dim('  Notion page updated.'));
      }

      console.log();
    });
}
