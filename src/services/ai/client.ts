import Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { createChildLogger } from '../../utils/logger.js';
import { AIError } from '../../utils/errors.js';

const log = createChildLogger('ai:client');

export interface AIClient {
  complete(systemPrompt: string, userPrompt: string): Promise<{
    text: string;
    tokensUsed: number;
  }>;
}

export function createAIClient(apiKey: string): AIClient {
  const anthropic = new Anthropic({ apiKey });

  return {
    async complete(systemPrompt: string, userPrompt: string) {
      log.debug('Sending request to Claude');
      const start = Date.now();

      try {
        const response = await withRetry(
          () =>
            anthropic.messages.create({
              model: defaultConfig.ai.model,
              max_tokens: defaultConfig.ai.maxTokens,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          { retryableStatusCodes: [429, 500, 529] },
        );

        const text =
          response.content[0].type === 'text' ? response.content[0].text : '';
        const tokensUsed =
          response.usage.input_tokens + response.usage.output_tokens;

        log.info(
          { tokensUsed, durationMs: Date.now() - start },
          'Claude response received',
        );

        return { text, tokensUsed };
      } catch (error) {
        throw new AIError(
          `Claude API call failed: ${error instanceof Error ? error.message : String(error)}`,
          'AI_REQUEST_FAILED',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
}
