import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { startScheduler } from '../services/pipeline/scheduler.js';

export function registerScheduleCommand(program: Command): void {
  program
    .command('schedule')
    .description('Run the pipeline on a recurring schedule')
    .option('--cron <expression>', 'Cron expression (overrides SCHEDULE_CRON in .env)')
    .option('--timezone <tz>', 'Timezone (overrides SCHEDULE_TIMEZONE in .env)')
    .option('--limit <number>', 'Max posts per run (overrides SCHEDULE_LIMIT in .env)')
    .option('--once', 'Run once immediately, then exit', false)
    .action(async (options) => {
      const env = loadEnv();

      const cron = options.cron ?? env.SCHEDULE_CRON;
      const timezone = options.timezone ?? env.SCHEDULE_TIMEZONE;
      const limit = options.limit ? parseInt(options.limit, 10) : env.SCHEDULE_LIMIT;

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
      });
    });
}
