import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { loadEnv } from '../../config/index.js';
import { createNotionReader } from '../services/notion/reader.js';
import { printCommandHelp } from '../utils/help.js';

export function registerQueueCommand(program: Command): void {
  program
    .command('queue')
    .description('Show the next N posts queued for publishing (Ready, oldest first)')
    .argument('[query]', 'Pass ? for help')
    .option('--limit <number>', 'Maximum posts to show', '10')
    .option('--output <format>', 'Output format: table | json | quiet', 'table')
    .action(async (query, options) => {
      if (query === '?') {
        printCommandHelp({
          command: 'queue',
          summary: 'Show the next posts in the publishing queue (Ready status, oldest first).',
          sections: [
            {
              heading: 'Output',
              options: [
                { flag: '--limit <number>', description: 'Max posts to return', default: '10' },
                { flag: '--output <format>', description: 'table | json | quiet', default: 'table' },
              ],
            },
          ],
          examples: [
            'inpost queue',
            'inpost queue --limit 5',
            'inpost queue --output json',
          ],
        });
        return;
      }

      const env = loadEnv();
      const limit = parseInt(options.limit, 10);

      const reader = createNotionReader(env.NOTION_API_TOKEN, env.NOTION_DATABASE_ID);
      const posts = await reader.fetchByStatus('Ready', limit, 'oldest');

      if (posts.length === 0) {
        console.log(chalk.yellow('\nNo posts in the queue.\n'));
        return;
      }

      if (options.output === 'json') {
        console.log(JSON.stringify(posts, null, 2));
        return;
      }

      if (options.output === 'quiet') {
        posts.forEach((p) => console.log(p.title));
        return;
      }

      const table = new Table({
        head: ['#', 'Title', 'Tone', 'Tags'],
        style: { head: ['cyan'] },
      });

      posts.forEach((post, i) => {
        table.push([i + 1, post.title, post.tone || '-', post.tags.join(', ')]);
      });

      console.log(`\n${chalk.bold(`Next ${posts.length} post(s) in queue:`)}\n`);
      console.log(table.toString());
      console.log();
    });
}
