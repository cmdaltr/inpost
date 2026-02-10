import { describe, it, expect, vi } from 'vitest';
import { createThread } from '../../../../src/services/ai/threading.js';
import type { AIClient } from '../../../../src/services/ai/client.js';

function createMockClient(response: string): AIClient {
  return {
    complete: vi.fn().mockResolvedValue({ text: response, tokensUsed: 200 }),
  };
}

describe('createThread', () => {
  it('splits response by --- separator', async () => {
    const client = createMockClient(
      'First post of the thread\n---\nSecond post continues\n---\nFinal post with CTA',
    );

    const thread = await createThread(client, 'Long content', 'professional');

    expect(thread).toHaveLength(3);
    expect(thread[0]).toBe('First post of the thread');
    expect(thread[2]).toBe('Final post with CTA');
  });

  it('handles single post responses', async () => {
    const client = createMockClient('Just one post here');

    const thread = await createThread(client, 'Short content', 'casual');
    expect(thread).toHaveLength(1);
  });

  it('filters empty segments', async () => {
    const client = createMockClient('Post one\n---\n\n---\nPost two');

    const thread = await createThread(client, 'content', 'casual');
    expect(thread).toHaveLength(2);
  });
});
