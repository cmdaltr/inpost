import { describe, it, expect, vi } from 'vitest';
import { generateHashtags } from '../../../../src/services/ai/hashtags.js';
import type { AIClient } from '../../../../src/services/ai/client.js';

function createMockClient(response: string): AIClient {
  return {
    complete: vi.fn().mockResolvedValue({ text: response, tokensUsed: 50 }),
  };
}

describe('generateHashtags', () => {
  it('parses space-separated hashtags', async () => {
    const client = createMockClient(
      '#AI #MachineLearning #ContentStrategy #LinkedIn #Tech',
    );

    const hashtags = await generateHashtags(client, 'AI content', ['tech']);

    expect(hashtags).toHaveLength(5);
    expect(hashtags).toContain('#AI');
    expect(hashtags).toContain('#MachineLearning');
  });

  it('filters non-hashtag tokens', async () => {
    const client = createMockClient(
      '#AI #Tech here are some hashtags #Content',
    );

    const hashtags = await generateHashtags(client, 'content', []);
    expect(hashtags).toEqual(['#AI', '#Tech', '#Content']);
  });

  it('handles comma-separated responses', async () => {
    const client = createMockClient('#AI, #Tech, #Data');

    const hashtags = await generateHashtags(client, 'content', []);
    expect(hashtags).toEqual(['#AI', '#Tech', '#Data']);
  });
});
