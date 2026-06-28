import { createAIClient as createAnthropicClient, type AIClient } from './client.js';
import { createGeminiClient } from './gemini-client.js';
import { createGroqClient } from './groq-client.js';
import { createChildLogger } from '../../utils/logger.js';
import { ConfigError } from '../../utils/errors.js';

const log = createChildLogger('ai:provider');

export type AIProvider = 'groq' | 'gemini' | 'anthropic';

export interface AIProviderConfig {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface AIClientWithProvider {
  client: AIClient;
  provider: AIProvider;
  model: string;
}

export function createAIClientFromEnv(env: AIProviderConfig): AIClientWithProvider {
  // Prefer Groq if available (best free tier: 14,400 req/day)
  if (env.GROQ_API_KEY) {
    log.info('Using Groq AI provider');
    return {
      client: createGroqClient(env.GROQ_API_KEY),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
    };
  }

  // Gemini as second choice (free tier available)
  if (env.GEMINI_API_KEY) {
    log.info('Using Gemini AI provider');
    return {
      client: createGeminiClient(env.GEMINI_API_KEY),
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    };
  }

  // Anthropic as fallback (paid)
  if (env.ANTHROPIC_API_KEY) {
    log.info('Using Anthropic AI provider');
    return {
      client: createAnthropicClient(env.ANTHROPIC_API_KEY),
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };
  }

  throw new ConfigError(
    'No AI provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in .env',
  );
}
