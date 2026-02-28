import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { createOrchestrator } from '../services/pipeline/orchestrator.js';
import { printCommandHelp } from '../utils/help.js';
import type { Tone } from '../types/index.js';

export function registerPipelineCommand(program: Command): void {
  program
    .command('pipeline')
    .description(
      'Full pipeline: fetch Ready posts -> AI transform -> publish to LinkedIn',
    )
    .argument('[query]', 'Pass ? for help')
    .option('--status <value>', 'Notion status to fetch', 'Ready')
    .option('--limit <number>', 'Maximum posts to process', '5')
    .option('--tone <tone>', 'Default tone for AI transformation', 'professional')
    .option('--hooks', 'Include hooks in generated content', false)
    .option('--hashtags', 'Include hashtags in generated content', false)
    .option('--dry-run', 'Run everything except actual LinkedIn publish', false)
    .option('--confirm', 'Require confirmation before each publish', true)
    .option('--no-confirm', 'Skip confirmation prompts')
    .action(async (query, options) => {
      if (query === '?') {
        printCommandHelp({
          command: 'pipeline',
          summary: 'Fetch ready posts, transform with AI, and publish to LinkedIn in one go.',
          sections: [
            {
              heading: 'Options',
              options: [
                { flag: '--status <value>', description: 'Notebook status to fetch', default: 'Ready' },
                { flag: '--limit <number>', description: 'Max posts to process per run', default: '5' },
                { flag: '--tone <tone>', description: 'AI tone: professional|casual|authority|storytelling|educational', default: 'professional' },
                { flag: '--hooks', description: 'Add attention-grabbing hooks to each post' },
                { flag: '--hashtags', description: 'Add auto-generated hashtags to each post' },
                { flag: '--dry-run', description: 'Run the full pipeline but skip the LinkedIn publish' },
                { flag: '--no-confirm', description: 'Skip the confirmation prompt before each publish' },
              ],
            },
          ],
          examples: [
            'inpost pipeline',
            'inpost pipeline --dry-run',
            'inpost pipeline --status Ready --limit 1 --tone casual',
            'inpost pipeline --dry-run --hashtags --no-confirm',
          ],
        });
        return;
      }

      const env = loadEnv();

      console.log(chalk.bold('\nInPost Pipeline\n'));

      const orchestrator = createOrchestrator({
        notionToken: env.NOTION_API_TOKEN,
        notionDatabaseId: env.NOTION_DATABASE_ID,
        aiConfig: env,
        defaultTone: options.tone as Tone,
        includeHooks: options.hooks,
        includeHashtags: options.hashtags,
        isDryRun: options.dryRun,
        requireConfirmation: options.confirm,
      });

      const results = await orchestrator.run(
        options.status,
        parseInt(options.limit, 10),
      );

      // Summary
      const published = results.filter((r) => r.status === 'published');
      const errors = results.filter((r) => r.status === 'error');

      console.log(chalk.bold('\nPipeline Complete:'));
      console.log(
        `  ${chalk.green(`${published.length} published`)}  ${chalk.red(`${errors.length} errors`)}`,
      );

      if (errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        for (const err of errors) {
          console.log(`  - ${err.title}: ${err.error}`);
        }
      }

      console.log();
    });
}
