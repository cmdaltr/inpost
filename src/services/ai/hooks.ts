import type { AIClient } from './client.js';
import { PROMPTS } from './prompts.js';

export async function generateHooks(
  client: AIClient,
  content: string,
  tone: string,
): Promise<string[]> {
  const { text } = await client.complete(
    PROMPTS.GENERATE_HOOKS.system,
    PROMPTS.GENERATE_HOOKS.user(content, tone),
  );

  return text
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 0);
}
