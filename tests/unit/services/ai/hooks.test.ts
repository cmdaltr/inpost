import { describe, it, expect, vi } from 'vitest';
import { generateHooks } from '../../../../src/services/ai/hooks.js';
import type { AIClient } from '../../../../src/services/ai/client.js';

function createMockClient(response: string): AIClient {
  return {
    complete: vi.fn().mockResolvedValue({ text: response, tokensUsed: 100 }),
  };
}

describe('generateHooks', () => {
  it('parses numbered hooks from response', async () => {
    const client = createMockClient(
      '1. Did you know AI can write code?\n2. The future of work is here.\n3. Stop scrolling. Read this.\n4. Most people get this wrong about AI.\n5. I spent 10 years studying this.',
    );

    const hooks = await generateHooks(client, 'AI content', 'professional');

    expect(hooks).toHaveLength(5);
    expect(hooks[0]).toBe('Did you know AI can write code?');
    expect(hooks[4]).toBe('I spent 10 years studying this.');
  });

  it('handles non-numbered responses', async () => {
    const client = createMockClient(
      'Hook one\nHook two\nHook three',
    );

    const hooks = await generateHooks(client, 'content', 'casual');
    expect(hooks).toHaveLength(3);
  });

  it('filters empty lines', async () => {
    const client = createMockClient('Hook one\n\nHook two\n\n');

    const hooks = await generateHooks(client, 'content', 'casual');
    expect(hooks).toHaveLength(2);
  });
});
