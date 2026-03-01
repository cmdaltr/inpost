import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { startScheduler } from '../services/pipeline/scheduler.js';
import { printCommandHelp } from '../utils/help.js';

export function registerScheduleCommand(program: Command): void {
  program
    .command('schedule')
    .description('Run the pipeline on a recurring schedule')
    .argument('[query]', 'Pass ? for help')
    .option('--cron <expression>', 'Cron expression (overrides SCHEDULE_CRON in .env)')
    .option('--timezone <tz>', 'Timezone (overrides SCHEDULE_TIMEZONE in .env)')
    .option('--limit <number>', 'Max posts per run (overrides SCHEDULE_LIMIT in .env)')
    .option('--once', 'Run once immediately, then exit', false)
    .option('--order <order>', 'Post selection order: oldest | newest (overrides PIPELINE_ORDER in .env)')
    .action(async (query, options) => {
      if (query === '?') {
        printCommandHelp({
          command: 'schedule',
          summary: 'Run the publish pipeline on a recurring cron schedule (or once immediately).',
          sections: [
            {
              heading: 'Options',
              options: [
                { flag: '--cron <expression>', description: 'Cron schedule', default: 'SCHEDULE_CRON in .env' },
                { flag: '--timezone <tz>', description: 'Timezone for the cron schedule', default: 'SCHEDULE_TIMEZONE in .env' },
                { flag: '--limit <number>', description: 'Max posts to publish per run', default: 'SCHEDULE_LIMIT in .env' },
                { flag: '--once', description: 'Run once immediately then exit (useful for CI/GitHub Actions)' },
                { flag: '--order <oldest|newest>', description: 'Pick the oldest or newest ready posts first', default: 'PIPELINE_ORDER in .env (oldest)' },
              ],
            },
          ],
          examples: [
            'inpost schedule --once',
            'inpost schedule --once --limit 2',
            'inpost schedule --cron "0 9 * * 1-5" --timezone "America/New_York"',
            'inpost schedule  # runs indefinitely using .env values',
          ],
        });
        return;
      }

      const env = loadEnv();

      const cron = options.cron ?? env.SCHEDULE_CRON;
      const timezone = options.timezone ?? env.SCHEDULE_TIMEZONE;
      const limit = options.limit ? parseInt(options.limit, 10) : env.SCHEDULE_LIMIT;
      const order = (options.order ?? env.PIPELINE_ORDER) as 'oldest' | 'newest';

      console.log(chalk.bold('\nInPost Scheduler\n'));
      console.log(`  Cron:     ${cron}`);
      console.log(`  Timezone: ${timezone}`);
      console.log(`  Limit:    ${limit} post(s) per run`);
      console.log();

      await startScheduler({
        cron,
        timezone,
        limit,
        runOnce: options.once,
        notionToken: env.NOTION_API_TOKEN,
        notionDatabaseId: env.NOTION_DATABASE_ID,
        aiConfig: env,
        order,
      });
    });
}
