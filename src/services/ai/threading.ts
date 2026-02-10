import type { AIClient } from './client.js';
import { PROMPTS } from './prompts.js';

export async function createThread(
  client: AIClient,
  content: string,
  tone: string,
): Promise<string[]> {
  const { text } = await client.complete(
    PROMPTS.CREATE_THREAD.system,
    PROMPTS.CREATE_THREAD.user(content, tone),
  );

  return text
    .split(/^---$/m)
    .map((post) => post.trim())
    .filter((post) => post.length > 0);
}
