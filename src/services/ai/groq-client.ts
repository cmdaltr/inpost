import Groq from 'groq-sdk';
import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { createChildLogger } from '../../utils/logger.js';
import { AIError } from '../../utils/errors.js';
import type { AIClient } from './client.js';

const log = createChildLogger('ai:groq');

export function createGroqClient(apiKey: string): AIClient {
  const groq = new Groq({ apiKey });

  return {
    async complete(systemPrompt: string, userPrompt: string) {
      log.debug('Sending request to Groq');
      const start = Date.now();

      try {
        const response = await withRetry(
          async () => {
            const result = await groq.chat.completions.create({
              model: defaultConfig.ai.groqModel,
              max_tokens: defaultConfig.ai.maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            });
            return result;
          },
          { retryableStatusCodes: [429, 500, 503] },
        );

        const text = response.choices[0]?.message?.content || '';
        const tokensUsed = response.usage
          ? response.usage.prompt_tokens + response.usage.completion_tokens
          : 0;

        log.info(
          { tokensUsed, durationMs: Date.now() - start },
          'Groq response received',
        );

        return { text, tokensUsed };
      } catch (error) {
        throw new AIError(
          `Groq API call failed: ${error instanceof Error ? error.message : String(error)}`,
          'AI_REQUEST_FAILED',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
}
