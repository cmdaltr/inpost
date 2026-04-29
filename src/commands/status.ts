import fs from 'fs';
import os from 'os';
import { Command } from 'commander';
import chalk from 'chalk';
import { tryLoadEnv } from '../../config/index.js';
import { defaultConfig } from '../../config/default.js';
import { readCredentials } from '../services/linkedin/token-store.js';
import { printCommandHelp } from '../utils/help.js';

function check(label: string, ok: boolean, detail: string): void {
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  const detailColor = ok ? chalk.dim(detail) : chalk.yellow(detail);
  console.log(`  ${icon} ${label.padEnd(22)} ${detailColor}`);
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Check configuration and connection status')
    .argument('[query]', 'Pass ? for help')
    .option('--notebook <provider>', 'Notebook provider to check (overrides DEFAULT_NOTEBOOK)')
    .option('--notion', 'Shorthand for --notebook notion', false)
    .option('--onenote', 'Shorthand for --notebook onenote', false)
    .option('--obsidian', 'Shorthand for --notebook obsidian', false)
    .option('--evernote', 'Shorthand for --notebook evernote', false)
    .action(async (query, options) => {
      if (query === '?') {
        printCommandHelp({
          command: 'status',
          summary: 'Check your InPost configuration and connection status.',
          sections: [
            {
              heading: 'Options',
              options: [
                { flag: '--notebook <provider>', description: 'Show config for a specific notebook provider', default: 'DEFAULT_NOTEBOOK in .env' },
                { flag: '--notion | --obsidian | --onenote | --evernote', description: 'Provider shorthands' },
              ],
            },
          ],
          examples: [
            'inpost status',
            'inpost status --obsidian',
            'inpost status --notebook onenote',
          ],
        });
        return;
      }

      console.log(chalk.bold('\nInPost Status\n'));

      const env = tryLoadEnv();
      const notebook =
        options.notion ? 'notion' :
        options.onenote ? 'onenote' :
        options.obsidian ? 'obsidian' :
        options.evernote ? 'evernote' :
        options.notebook ?? env.DEFAULT_NOTEBOOK ?? 'notion';

      // ── Active notebook ──────────────────────────────────────────────────
      console.log(`  ${chalk.dim('Default notebook:')} ${chalk.cyan(notebook)}\n`);

      if (notebook === 'notion') {
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
      } else if (notebook === 'obsidian') {
        const vaultPath = env.OBSIDIAN_VAULT_PATH;
        const vaultExists = Boolean(vaultPath) && fs.existsSync(vaultPath!);
        check(
          'Obsidian Vault Path',
          vaultExists,
          vaultExists ? vaultPath! : vaultPath ? `Path not found: ${vaultPath}` : 'Missing OBSIDIAN_VAULT_PATH',
        );
        if (env.OBSIDIAN_NOTES_DIR) {
          check('Obsidian Notes Dir', true, env.OBSIDIAN_NOTES_DIR);
        }
      } else if (notebook === 'onenote') {
        const hasClientId = Boolean(env.ONENOTE_CLIENT_ID);
        const credPath = `${os.homedir()}/.inpost/onenote-credentials.json`;
        const hasCreds = fs.existsSync(credPath);
        check(
          'OneNote Client ID',
          hasClientId,
          hasClientId ? 'Configured' : 'Missing ONENOTE_CLIENT_ID',
        );
        check(
          'OneNote Auth',
          hasCreds,
          hasCreds ? credPath : 'Not authenticated (run: inpost auth --onenote)',
        );
      } else if (notebook === 'evernote') {
        const hasToken = Boolean(env.EVERNOTE_TOKEN);
        check(
          'Evernote Token',
          hasToken,
          hasToken ? 'Configured' : 'Missing EVERNOTE_TOKEN',
        );
        if (env.EVERNOTE_NOTEBOOK) {
          check('Evernote Notebook', true, env.EVERNOTE_NOTEBOOK);
        }
      }

      console.log();

      // ── LinkedIn ─────────────────────────────────────────────────────────
      const hasClientId = Boolean(env.LINKEDIN_CLIENT_ID);
      const hasClientSecret = Boolean(env.LINKEDIN_CLIENT_SECRET);
      check(
        'LinkedIn Client ID',
        hasClientId,
        hasClientId ? 'Configured' : 'Missing (run: inpost auth linkedin)',
      );
      check(
        'LinkedIn Client Secret',
        hasClientSecret,
        hasClientSecret ? 'Configured' : 'Missing (run: inpost auth linkedin)',
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
            : 'Expired (run: inpost auth linkedin)',
        );
        check('LinkedIn Person URN', Boolean(creds.personUrn), creds.personUrn || 'Missing');
      } else {
        check(
          'LinkedIn Token',
          false,
          'Not authenticated (run: inpost auth linkedin)',
        );
      }

      console.log();

      // ── AI Provider (priority: Groq > Gemini > Anthropic) ────────────────
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
