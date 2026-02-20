import { Command } from 'commander';
import chalk from 'chalk';
import { tryLoadEnv } from '../../config/index.js';
import { defaultConfig } from '../../config/default.js';
import { readCredentials } from '../services/linkedin/token-store.js';

function check(label: string, ok: boolean, detail: string): void {
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  const detailColor = ok ? chalk.dim(detail) : chalk.yellow(detail);
  console.log(`  ${icon} ${label.padEnd(22)} ${detailColor}`);
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check configuration and connection status')
    .action(async () => {
      console.log(chalk.bold('\nInPost Status\n'));

      const env = tryLoadEnv();

      // Notion
      const hasNotionToken = Boolean(env.NOTION_API_TOKEN);
      const hasNotionDb = Boolean(env.NOTION_DATABASE_ID);
      check(
        'Notion API Token',
        hasNotionToken,
        hasNotionToken ? 'Configured' : 'Missing NOTION_API_TOKEN',
      );
      check(
        'Notion Database ID',
        hasNotionDb,
        hasNotionDb ? 'Configured' : 'Missing NOTION_DATABASE_ID',
      );

      // LinkedIn
      const hasClientId = Boolean(env.LINKEDIN_CLIENT_ID);
      const hasClientSecret = Boolean(env.LINKEDIN_CLIENT_SECRET);
      check(
        'LinkedIn Client ID',
        hasClientId,
        hasClientId ? 'Configured' : 'Missing (run: inpost auth)',
      );
      check(
        'LinkedIn Client Secret',
        hasClientSecret,
        hasClientSecret ? 'Configured' : 'Missing (run: inpost auth)',
      );

      // LinkedIn tokens
      const creds = readCredentials();
      if (creds) {
        const expiresAt = new Date(creds.expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        const tokenOk = daysLeft > 0;
        check(
          'LinkedIn Token',
          tokenOk,
          tokenOk
            ? `Valid (expires in ${daysLeft} days)`
            : 'Expired (run: inpost auth)',
        );
        check('LinkedIn Person URN', Boolean(creds.personUrn), creds.personUrn || 'Missing');
      } else {
        check(
          'LinkedIn Token',
          false,
          'Not authenticated (run: inpost auth)',
        );
      }

      // AI Provider (priority: Groq > Gemini > Anthropic)
      const hasGroqKey = Boolean(env.GROQ_API_KEY);
      const hasGeminiKey = Boolean(env.GEMINI_API_KEY);
      const hasAnthropicKey = Boolean(env.ANTHROPIC_API_KEY);

      if (hasGroqKey) {
        check(
          'AI Provider',
          true,
          `Groq (model: ${defaultConfig.ai.groqModel})`,
        );
      } else if (hasGeminiKey) {
        check(
          'AI Provider',
          true,
          `Gemini (model: ${defaultConfig.ai.geminiModel})`,
        );
      } else if (hasAnthropicKey) {
        check(
          'AI Provider',
          true,
          `Anthropic (model: ${defaultConfig.ai.model})`,
        );
      } else {
        check(
          'AI Provider',
          false,
          'Missing GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY',
        );
      }

      // Schedule
      const cron = env.SCHEDULE_CRON || defaultConfig.schedule.defaultCron;
      console.log(
        `\n  ${chalk.dim('Schedule:')} ${cron} (${defaultConfig.schedule.timezone})`,
      );

      console.log();
    });
}
