import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadEnv } from '../../config/index.js';
import { createNotionReader } from '../services/notion/reader.js';

export function registerFetchCommand(program: Command): void {
  program
    .command('fetch')
    .description('Fetch posts from Notion by status')
    .option('--status <value>', 'Status to filter by', 'Ready')
    .option('--limit <number>', 'Maximum posts to fetch', '10')
    .option('--output <format>', 'Output format: table | json | quiet', 'table')
    .action(async (options) => {
      const env = loadEnv();
      const reader = createNotionReader(
        env.NOTION_API_TOKEN,
        env.NOTION_DATABASE_ID,
      );

      const limit = parseInt(options.limit, 10);
      const posts = await reader.fetchByStatus(options.status, limit);

      if (posts.length === 0) {
        console.log(
          chalk.yellow(`\nNo posts found with status "${options.status}"\n`),
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
