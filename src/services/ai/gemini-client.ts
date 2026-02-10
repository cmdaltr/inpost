import { GoogleGenerativeAI } from '@google/generative-ai';
import { defaultConfig } from '../../../config/default.js';
import { withRetry } from '../../utils/retry.js';
import { createChildLogger } from '../../utils/logger.js';
import { AIError } from '../../utils/errors.js';
import type { AIClient } from './client.js';

const log = createChildLogger('ai:gemini');

export function createGeminiClient(apiKey: string): AIClient {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: defaultConfig.ai.geminiModel,
  });

  return {
    async complete(systemPrompt: string, userPrompt: string) {
      log.debug('Sending request to Gemini');
      const start = Date.now();

      try {
        const response = await withRetry(
          async () => {
            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              systemInstruction: systemPrompt,
              generationConfig: {
                maxOutputTokens: defaultConfig.ai.maxTokens,
              },
            });
            return result;
          },
          { retryableStatusCodes: [429, 500, 503] },
        );

        const text = response.response.text();
        const usage = response.response.usageMetadata;
        const tokensUsed = usage
          ? (usage.promptTokenCount ?? 0) + (usage.candidatesTokenCount ?? 0)
          : 0;

        log.info(
          { tokensUsed, durationMs: Date.now() - start },
          'Gemini response received',
        );

        return { text, tokensUsed };
      } catch (error) {
        throw new AIError(
          `Gemini API call failed: ${error instanceof Error ? error.message : String(error)}`,
          'AI_REQUEST_FAILED',
          error instanceof Error ? error : undefined,
        );
      }
    },
  };
}
