import type { AIClient } from './client.js';
import { PROMPTS } from './prompts.js';

export async function generateHashtags(
  client: AIClient,
  content: string,
  tags: string[],
): Promise<string[]> {
  const { text } = await client.complete(
    PROMPTS.GENERATE_HASHTAGS.system,
    PROMPTS.GENERATE_HASHTAGS.user(content, tags),
  );

  return text
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith('#') && tag.length > 1);
}
