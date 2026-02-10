import { describe, it, expect, vi } from 'vitest';
import { createTransformer } from '../../../../src/services/ai/transformer.js';

// Mock the provider module
vi.mock('../../../../src/services/ai/provider.js', () => ({
  createAIClientFromEnv: () => ({
    client: {
      complete: vi.fn().mockResolvedValue({
        text: 'Generated LinkedIn post content',
        tokensUsed: 150,
      }),
    },
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  }),
}));

const mockEnv = { ANTHROPIC_API_KEY: 'test-key' };

describe('createTransformer', () => {
  it('returns a transformer with transform method', () => {
    const transformer = createTransformer(mockEnv);
    expect(transformer).toHaveProperty('transform');
    expect(typeof transformer.transform).toBe('function');
  });

  it('generates a summary', async () => {
    const transformer = createTransformer(mockEnv);

    const result = await transformer.transform({
      content: 'My blog post about AI and the future of work.',
      tone: 'professional',
      type: 'summary',
      includeHooks: false,
      includeHashtags: false,
      includeThread: false,
      includeTiming: false,
      variantCount: 1,
    });

    expect(result.summary).toBe('Generated LinkedIn post content');
    expect(result.metadata).toHaveProperty('tokensUsed');
    expect(result.metadata).toHaveProperty('processingTimeMs');
    expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('does not include optional fields when not requested', async () => {
    const transformer = createTransformer(mockEnv);

    const result = await transformer.transform({
      content: 'Blog content',
      tone: 'casual',
      type: 'summary',
      includeHooks: false,
      includeHashtags: false,
      includeThread: false,
      includeTiming: false,
      variantCount: 1,
    });

    expect(result.hooks).toBeUndefined();
    expect(result.hashtags).toBeUndefined();
    expect(result.thread).toBeUndefined();
    expect(result.timing).toBeUndefined();
    expect(result.variants).toBeUndefined();
  });
});
