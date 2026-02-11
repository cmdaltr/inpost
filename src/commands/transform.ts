import { Command } from 'commander';
import chalk from 'chalk';
import { loadEnv } from '../../config/index.js';
import { createTransformer } from '../services/ai/transformer.js';
import { createNotionReader } from '../services/notion/reader.js';
import type { Tone, TransformOptions } from '../types/index.js';

export function registerTransformCommand(program: Command): void {
  program
    .command('transform [text]')
    .description('Transform content for LinkedIn')
    .option('--notion-id <id>', 'Fetch content from a Notion page')
    .option('--file <path>', 'Read content from a file')
    .option('-t, --tone <tone>', 'Tone (uses DEFAULT_TONE from .env if not set)')
    .option('--variants <count>', 'Number of variants to generate', '1')
    .option('--hooks', 'Generate attention-grabbing hooks', false)
    .option('--hashtags', 'Auto-generate hashtags', false)
    .option('--thread', 'Split into LinkedIn thread format', false)
    .option('--save', 'Save result back to Notion (requires --notion-id)', false)
    .option('--json', 'Output as JSON', false)
    .action(async (text, options) => {
      const env = loadEnv();

      // Resolve content from input source
      let content: string;
      let tags: string[] = [];

      if (options.notionId) {
        const reader = createNotionReader(
          env.NOTION_API_TOKEN,
          env.NOTION_DATABASE_ID,
        );
        const post = await reader.fetchPage(options.notionId);
        content = post.content;
        tags = post.tags;
      } else if (text) {
        content = text;
      } else if (options.file) {
        const fs = await import('node:fs');
        content = fs.readFileSync(options.file, 'utf-8');
      } else {
        console.error(
          chalk.red('Error: Provide text, --notion-id, or --file'),
        );
        process.exit(1);
      }

      const transformer = createTransformer(env);

      const tone = (options.tone || env.DEFAULT_TONE || 'professional') as Tone;

      const transformOptions: TransformOptions = {
        content,
        tone,
        type: 'summary',
        includeHooks: options.hooks,
        includeHashtags: options.hashtags,
        includeThread: options.thread,
        variantCount: parseInt(options.variants, 10),
        tags,
      };

      console.log(chalk.dim(`\nTransforming (${tone})...\n`));

      const result = await transformer.transform(transformOptions);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Text output
      console.log(chalk.bold('LinkedIn Post:\n'));
      console.log(result.summary);

      if (result.hooks && result.hooks.length > 0) {
        console.log(chalk.bold('\n\nHook Options:\n'));
        result.hooks.forEach((hook, i) => {
          console.log(`  ${i + 1}. ${hook}`);
        });
      }

      if (result.hashtags && result.hashtags.length > 0) {
        console.log(chalk.bold('\n\nHashtags:\n'));
        console.log(`  ${result.hashtags.join(' ')}`);
      }

      if (result.thread && result.thread.length > 0) {
        console.log(chalk.bold('\n\nThread Posts:\n'));
        result.thread.forEach((post, i) => {
          console.log(chalk.dim(`--- Post ${i + 1}/${result.thread!.length} ---`));
          console.log(post);
          console.log();
        });
      }

      if (result.variants && result.variants.length > 0) {
        console.log(chalk.bold('\n\nVariants:\n'));
        result.variants.forEach((variant, i) => {
          console.log(chalk.dim(`--- Variant ${i + 1} ---`));
          console.log(variant);
          console.log();
        });
      }

      console.log(
        chalk.dim(
          `\n(${result.metadata.tokensUsed} tokens, ${result.metadata.processingTimeMs}ms)`,
        ),
      );

      // Save to Notion if requested
      if (options.save && options.notionId) {
        const { createNotionWriter } = await import(
          '../services/notion/writer.js'
        );
        const writer = createNotionWriter(env.NOTION_API_TOKEN);
        await writer.updateAISummary(options.notionId, result.summary);
        if (result.variants) {
          await writer.updateVariants(
            options.notionId,
            result.variants.join('\n\n---\n\n'),
          );
        }
        console.log(chalk.green('\nSaved to Notion.'));
      }

      console.log();
    });
}
