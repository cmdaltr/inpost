import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { createOrchestrator } from '../services/pipeline/orchestrator.js';
import type { Tone } from '../types/index.js';

export function registerPipelineCommand(program: Command): void {
  program
    .command('pipeline')
    .description(
      'Full pipeline: fetch Ready posts -> AI transform -> publish to LinkedIn',
    )
    .option('--status <value>', 'Notion status to fetch', 'Ready')
    .option('--limit <number>', 'Maximum posts to process', '5')
    .option('--tone <tone>', 'Default tone for AI transformation', 'professional')
    .option('--hooks', 'Include hooks in generated content', false)
    .option('--hashtags', 'Include hashtags in generated content', false)
    .option('--dry-run', 'Run everything except actual LinkedIn publish', false)
    .option('--confirm', 'Require confirmation before each publish', true)
    .option('--no-confirm', 'Skip confirmation prompts')
    .action(async (options) => {
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
