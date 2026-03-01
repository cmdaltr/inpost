import cron from 'node-cron';
import chalk from 'chalk';
import { createOrchestrator } from './orchestrator.js';
import { createChildLogger } from '../../utils/logger.js';
import type { SchedulerConfig } from './types.js';

const log = createChildLogger('schedule:tick');

export async function startScheduler(config: SchedulerConfig): Promise<void> {
  const orchestrator = createOrchestrator({
    notionToken: config.notionToken,
    notionDatabaseId: config.notionDatabaseId,
    aiConfig: config.aiConfig,
    defaultTone: 'professional',
    includeHooks: false,
    includeHashtags: true,
    isDryRun: false,
    requireConfirmation: false,
    order: config.order,
  });

  async function runPipeline() {
    const timestamp = new Date().toISOString();
    log.info({ timestamp }, 'Scheduled pipeline run starting');
    console.log(chalk.dim(`\n[${timestamp}] Running scheduled pipeline...`));

    try {
      const results = await orchestrator.run('Ready', config.limit);
      const published = results.filter((r) => r.status === 'published').length;
      const errors = results.filter((r) => r.status === 'error').length;
      console.log(
        chalk.dim(
          `[${timestamp}] Complete: ${published} published, ${errors} errors`,
        ),
      );
    } catch (error) {
      log.error({ error }, 'Scheduled pipeline run failed');
      console.error(chalk.red(`Pipeline run failed: ${error}`));
    }
  }

  if (config.runOnce) {
    await runPipeline();
    return;
  }

  if (!cron.validate(config.cron)) {
    console.error(chalk.red(`Invalid cron expression: ${config.cron}`));
    process.exit(1);
  }

  console.log(chalk.green('Scheduler started. Press Ctrl+C to stop.\n'));

  cron.schedule(config.cron, runPipeline, {
    timezone: config.timezone,
  });

  // Keep process alive
  await new Promise<void>(() => {});
}
