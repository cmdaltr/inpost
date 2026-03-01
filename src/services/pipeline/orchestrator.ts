import chalk from 'chalk';
import inquirer from 'inquirer';
import { createNotionReader } from '../notion/reader.js';
import { createNotionWriter } from '../notion/writer.js';
import { createTransformer } from '../ai/transformer.js';
import { createLinkedInPublisher } from '../linkedin/publisher.js';
import { createChildLogger } from '../../utils/logger.js';
import type { PipelineResult, TransformOptions } from '../../types/index.js';
import type { OrchestratorConfig } from './types.js';

const log = createChildLogger('pipeline:orchestrator');

export interface Orchestrator {
  run(status: string, limit: number): Promise<PipelineResult[]>;
}

export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
  const reader = createNotionReader(config.notionToken, config.notionDatabaseId);
  const writer = createNotionWriter(config.notionToken);
  const transformer = createTransformer(config.aiConfig);
  const publisher = createLinkedInPublisher();

  return {
    async run(status: string, limit: number): Promise<PipelineResult[]> {
      log.info({ status, limit }, 'Starting pipeline run');

      // 1. Fetch posts from Notion
      console.log(chalk.dim('Fetching posts from Notion...'));
      const posts = await reader.fetchByStatus(status, limit, config.order);

      if (posts.length === 0) {
        console.log(chalk.yellow('No posts found. Nothing to do.'));
        return [];
      }

      console.log(`Found ${posts.length} post(s) to process.\n`);

      const results: PipelineResult[] = [];

      for (const post of posts) {
        console.log(chalk.bold(`Processing: ${post.title}`));

        try {
          // 2. Update status -> Transforming
          await writer.updateStatus(post.id, 'Transforming');

          // 3. AI Transform
          console.log(chalk.dim('  Transforming with AI...'));
          const transformOptions: TransformOptions = {
            content: post.content,
            tone: post.tone || config.defaultTone,
            type: 'summary',
            includeHooks: config.includeHooks,
            includeHashtags: config.includeHashtags,
            includeThread: false,
            variantCount: 1,
            tags: post.tags,
          };

          const transformed = await transformer.transform(transformOptions);

          // Save AI summary to Notion
          await writer.updateAISummary(post.id, transformed.summary);

          let postText = transformed.summary;

          // Append hashtags if generated
          if (transformed.hashtags && transformed.hashtags.length > 0) {
            postText += '\n\n' + transformed.hashtags.join(' ');
          }

          // 4. Show preview and optionally confirm
          console.log(chalk.dim('\n  --- Preview ---'));
          console.log(`  ${postText.split('\n').join('\n  ')}`);
          console.log(chalk.dim('  --- End Preview ---\n'));

          if (config.requireConfirmation && !config.isDryRun) {
            const { proceed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'proceed',
                message: `Publish "${post.title}" to LinkedIn?`,
                default: true,
              },
            ]);

            if (!proceed) {
              console.log(chalk.yellow('  Skipped.\n'));
              await writer.updateStatus(post.id, status); // Revert to original status
              results.push({
                postId: '',
                notionPageId: post.id,
                title: post.title,
                status: 'error',
                error: 'Skipped by user',
              });
              continue;
            }
          }

          // 5. Update status -> Publishing
          await writer.updateStatus(post.id, 'Publishing');

          // 6. Publish to LinkedIn
          console.log(chalk.dim('  Publishing to LinkedIn...'));
          const publishResult = await publisher.publish({
            text: postText,
            visibility: 'PUBLIC',
            isDryRun: config.isDryRun,
          });

          // 7. Update Notion with result
          await writer.markPublished(
            post.id,
            publishResult.postUrl,
            publishResult.postId,
          );

          console.log(
            chalk.green(`  Published: ${publishResult.postUrl}\n`),
          );

          results.push({
            postId: publishResult.postId,
            notionPageId: post.id,
            title: post.title,
            status: 'published',
            linkedinUrl: publishResult.postUrl,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          log.error({ error, postId: post.id }, 'Pipeline error for post');
          console.log(chalk.red(`  Error: ${errorMessage}\n`));

          // Mark as error in Notion
          try {
            await writer.markError(post.id, errorMessage);
          } catch (notionError) {
            log.error(
              { error: notionError },
              'Failed to update error status in Notion',
            );
          }

          results.push({
            postId: '',
            notionPageId: post.id,
            title: post.title,
            status: 'error',
            error: errorMessage,
          });
        }
      }

      return results;
    },
  };
}
