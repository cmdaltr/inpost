import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { defaultConfig } from '../../config/default.js';
import { startScheduler } from '../services/pipeline/scheduler.js';

export function registerScheduleCommand(program: Command): void {
  program
    .command('schedule')
    .description('Run the pipeline on a recurring schedule')
    .option(
      '--cron <expression>',
      'Cron expression',
      defaultConfig.schedule.defaultCron,
    )
    .option(
      '--timezone <tz>',
      'Timezone',
      defaultConfig.schedule.timezone,
    )
    .option('--once', 'Run once immediately, then exit', false)
    .action(async (options) => {
      const env = loadEnv();

      console.log(chalk.bold('\nInPost Scheduler\n'));
      console.log(`  Cron:     ${options.cron}`);
      console.log(`  Timezone: ${options.timezone}`);
      console.log();

      await startScheduler({
        cron: options.cron,
        timezone: options.timezone,
        runOnce: options.once,
        notionToken: env.NOTION_API_TOKEN,
        notionDatabaseId: env.NOTION_DATABASE_ID,
        aiConfig: env,
      });
    });
}
