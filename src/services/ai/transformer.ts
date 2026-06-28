import type { AIClient } from './client.js';
import { createAIClientFromEnv, type AIProviderConfig } from './provider.js';
import { PROMPTS } from './prompts.js';
import { generateHooks } from './hooks.js';
import { generateHashtags } from './hashtags.js';
import { createThread } from './threading.js';
import { createChildLogger } from '../../utils/logger.js';
import type { TransformOptions, TransformResult } from '../../types/index.js';

const log = createChildLogger('ai:transformer');

export interface Transformer {
  transform(options: TransformOptions): Promise<TransformResult>;
}

export function createTransformer(env: AIProviderConfig): Transformer {
  const { client, model } = createAIClientFromEnv(env);

  return {
    async transform(options: TransformOptions): Promise<TransformResult> {
      const start = Date.now();
      let totalTokens = 0;

      log.info(
        {
          tone: options.tone,
          type: options.type,
          hooks: options.includeHooks,
          hashtags: options.includeHashtags,
          thread: options.includeThread,
          variants: options.variantCount,
        },
        'Starting content transformation',
      );

      // Generate the main summary (never ask for hashtags inline — they are generated separately)
      const summaryResponse = await client.complete(
        PROMPTS.SUMMARIZE.system,
        PROMPTS.SUMMARIZE.user(
          options.content,
          options.tone,
          false,
          options.tags || [],
        ),
      );
      totalTokens += summaryResponse.tokensUsed;

      const summaryText = summaryResponse.text;
      let hashtags: string[] | undefined;

      const result: TransformResult = {
        summary: summaryText,
        hashtags,
        metadata: {
          model: '',
          tokensUsed: 0,
          processingTimeMs: 0,
        },
      };

      // Run independent AI tasks in parallel
      const parallelTasks: Promise<void>[] = [];

      if (options.includeHashtags) {
        parallelTasks.push(
          generateHashtags(client, options.content, options.tags || []).then((tags) => {
            result.hashtags = tags;
          }),
        );
      }

      if (options.includeHooks) {
        parallelTasks.push(
          generateHooks(client, options.content, options.tone).then((hooks) => {
            result.hooks = hooks;
          }),
        );
      }

      if (options.includeThread) {
        parallelTasks.push(
          createThread(client, options.content, options.tone).then((thread) => {
            result.thread = thread;
          }),
        );
      }

      if (options.variantCount > 1) {
        parallelTasks.push(
          (async () => {
            const response = await client.complete(
              PROMPTS.GENERATE_VARIANTS.system,
              PROMPTS.GENERATE_VARIANTS.user(
                options.content,
                options.tone,
                options.variantCount,
              ),
            );
            totalTokens += response.tokensUsed;
            result.variants = response.text
              .split(/^---$/m)
              .map((v) => v.trim())
              .filter((v) => v.length > 0);
          })(),
        );
      }

      await Promise.all(parallelTasks);

      result.metadata = {
        model,
        tokensUsed: totalTokens,
        processingTimeMs: Date.now() - start,
      };

      log.info(
        { tokensUsed: totalTokens, durationMs: result.metadata.processingTimeMs },
        'Transformation complete',
      );

      return result;
    },
  };
}
