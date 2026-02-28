import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadEnv } from '../../config/index.js';
import { createNotionReader } from '../services/notion/reader.js';
import { ObsidianProvider } from '../services/notes/ObsidianProvider.js';
import { printCommandHelp } from '../utils/help.js';

export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('List posts from your notebook source')
    .argument('[query]', 'Pass ? for help')
    .option('--notebook <provider>', 'Notebook provider: notion | obsidian | onenote | evernote (overrides DEFAULT_NOTEBOOK)')
    .option('--notion', 'Shorthand for --notebook notion', false)
    .option('--onenote', 'Shorthand for --notebook onenote', false)
    .option('--obsidian', 'Shorthand for --notebook obsidian', false)
    .option('--evernote', 'Shorthand for --notebook evernote', false)
    .option('--status [value]', 'Status to filter by (omit value to list available statuses — Notion only)')
    .option('--all', 'List all posts regardless of status', false)
    .option('--draft', 'Shorthand for --status Draft', false)
    .option('--ready', 'Shorthand for --status Ready', false)
    .option('--published', 'Shorthand for --status Published', false)
    .option('--archived', 'Shorthand for --status Archived', false)
    .option('--error', 'Shorthand for --status Error', false)
    .option('--limit <number>', 'Maximum posts to fetch', '10')
    .option('--output <format>', 'Output format: table | json | quiet', 'table')
    .action(async (query, options) => {
      if (query === '?') {
        printCommandHelp({
          command: 'fetch',
          summary: 'List posts from your configured notebook source.',
          sections: [
            {
              heading: 'Notebook',
              options: [
                { flag: '--notebook <provider>', description: 'notion | obsidian | onenote | evernote', default: 'notion' },
                { flag: '--notion | --obsidian | --onenote | --evernote', description: 'Provider shorthands' },
              ],
            },
            {
              heading: 'Filters (Notion only)',
              options: [
                { flag: '--status [value]', description: 'Filter by status; omit value to list available statuses' },
                { flag: '--ready', description: 'Shorthand for --status Ready' },
                { flag: '--draft', description: 'Shorthand for --status Draft' },
                { flag: '--published', description: 'Shorthand for --status Published' },
                { flag: '--archived', description: 'Shorthand for --status Archived' },
                { flag: '--error', description: 'Shorthand for --status Error' },
                { flag: '--all', description: 'List all posts regardless of status' },
              ],
            },
            {
              heading: 'Output',
              options: [
                { flag: '--limit <number>', description: 'Max posts to return', default: '10' },
                { flag: '--output <format>', description: 'table | json | quiet', default: 'table' },
              ],
            },
          ],
          examples: [
            'inpost fetch --ready',
            'inpost fetch --all --limit 20',
            'inpost fetch --status',
            'inpost fetch --obsidian --all',
            'inpost fetch --notebook onenote --all',
          ],
        });
        return;
      }

      const env = loadEnv();
      const notebook =
        options.notion ? 'notion' :
        options.onenote ? 'onenote' :
        options.obsidian ? 'obsidian' :
        options.evernote ? 'evernote' :
        options.notebook ?? env.DEFAULT_NOTEBOOK;
      const limit = parseInt(options.limit, 10);

      // ── Obsidian ──────────────────────────────────────────────────────────
      if (notebook === 'obsidian') {
        const provider = new ObsidianProvider();
        const notes = await provider.listNotes!();

        if (notes.length === 0) {
          console.log(chalk.yellow('\nNo notes found in vault\n'));
          return;
        }

        if (options.output === 'json') {
          console.log(JSON.stringify(notes.slice(0, limit), null, 2));
          return;
        }

        if (options.output === 'quiet') {
          notes.slice(0, limit).forEach((n) => console.log(n.title));
          return;
        }

        const table = new Table({ head: ['Title', 'ID'], style: { head: ['cyan'] } });
        for (const n of notes.slice(0, limit)) table.push([n.title, n.id]);
        console.log(`\n${chalk.bold(`Found ${notes.length} note(s) in Obsidian vault:`)}\n`);
        console.log(table.toString());
        console.log();
        return;
      }

      // ── OneNote / Evernote ────────────────────────────────────────────────
      if (notebook === 'onenote' || notebook === 'evernote') {
        console.log(chalk.yellow(`\nNote listing for ${notebook} is not yet supported via fetch.\n`));
        console.log(chalk.dim('Use --notebook notion or --notebook obsidian instead.\n'));
        return;
      }

      // ── Notion (default) ──────────────────────────────────────────────────
      const reader = createNotionReader(
        env.NOTION_API_TOKEN,
        env.NOTION_DATABASE_ID,
      );

      // --status with no value: list available statuses
      if (options.status === true) {
        const statuses = await reader.listStatuses();
        if (statuses.length === 0) {
          console.log(chalk.yellow('\nNo statuses found in database schema\n'));
          return;
        }
        console.log(chalk.bold('\nAvailable statuses:\n'));
        statuses.forEach((s) => console.log(`  ${s}`));
        console.log();
        return;
      }

      // Resolve status from convenience flags or --status value
      const resolvedStatus: string | undefined =
        options.draft ? 'Draft' :
        options.ready ? 'Ready' :
        options.published ? 'Published' :
        options.archived ? 'Archived' :
        options.error ? 'Error' :
        typeof options.status === 'string' ? options.status :
        undefined;

      if (options.all) {
        const summaries = await reader.listTitles(limit);

        if (summaries.length === 0) {
          console.log(chalk.yellow('\nNo posts found in database\n'));
          return;
        }

        if (options.output === 'json') {
          console.log(JSON.stringify(summaries, null, 2));
          return;
        }

        if (options.output === 'quiet') {
          summaries.forEach((s) => console.log(s.title));
          return;
        }

        const table = new Table({
          head: ['Title', 'Status'],
          style: { head: ['cyan'] },
        });

        for (const s of summaries) {
          table.push([s.title, s.status]);
        }

        console.log(`\n${chalk.bold(`Found ${summaries.length} post(s):`)}\n`);
        console.log(table.toString());
        console.log();
        return;
      }

      const statusToFetch = resolvedStatus ?? 'Ready';
      const posts = await reader.fetchByStatus(statusToFetch, limit);

      if (posts.length === 0) {
        console.log(
          chalk.yellow(`\nNo posts found with status "${statusToFetch}"\n`),
        );
        return;
      }

      if (options.output === 'json') {
        console.log(JSON.stringify(posts, null, 2));
        return;
      }

      if (options.output === 'quiet') {
        posts.forEach((p) => console.log(p.id));
        return;
      }

      // Table output
      const table = new Table({
        head: ['Title', 'Status', 'Tags', 'Tone'],
        style: { head: ['cyan'] },
      });

      for (const post of posts) {
        table.push([
          post.title,
          post.status,
          post.tags.join(', '),
          post.tone || '-',
        ]);
      }

      console.log(`\n${chalk.bold(`Found ${posts.length} post(s):`)}\n`);
      console.log(table.toString());
      console.log();
    });
}
