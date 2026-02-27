import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadEnv } from '../../config/index.js';
import { createNotionReader } from '../services/notion/reader.js';

export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Fetch posts from Notion by status')
    .option('--status [value]', 'Status to filter by (omit value to list available statuses)')
    .option('--all', 'List all posts regardless of status', false)
    .option('--draft', 'Shorthand for --status Draft', false)
    .option('--ready', 'Shorthand for --status Ready', false)
    .option('--published', 'Shorthand for --status Published', false)
    .option('--archived', 'Shorthand for --status Archived', false)
    .option('--error', 'Shorthand for --status Error', false)
    .option('--limit <number>', 'Maximum posts to fetch', '10')
    .option('--output <format>', 'Output format: table | json | quiet', 'table')
    .action(async (options) => {
      const env = loadEnv();
      const reader = createNotionReader(
        env.NOTION_API_TOKEN,
        env.NOTION_DATABASE_ID,
      );

      const limit = parseInt(options.limit, 10);

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
