import { describe, it, expect } from 'vitest';
import { PROMPTS } from '../../../../src/services/ai/prompts.js';

describe('PROMPTS', () => {
  describe('SUMMARIZE', () => {
    it('includes character limit in system prompt', () => {
      expect(PROMPTS.SUMMARIZE.system).toContain('3000');
    });

    it('generates user prompt with content and tone', () => {
      const result = PROMPTS.SUMMARIZE.user('My blog content', 'casual', false, []);
      expect(result).toContain('Tone: casual');
      expect(result).toContain('My blog content');
    });

    it('includes hashtag instructions when requested', () => {
      const result = PROMPTS.SUMMARIZE.user('My blog content', 'casual', true, ['AI']);
      expect(result).toContain('hashtags');
      expect(result).toContain('AI');
    });
  });

  describe('GENERATE_HOOKS', () => {
    it('requests exactly 5 hooks', () => {
      expect(PROMPTS.GENERATE_HOOKS.system).toContain('5');
    });

    it('truncates long content to 1000 chars', () => {
      const longContent = 'a'.repeat(2000);
      const result = PROMPTS.GENERATE_HOOKS.user(longContent, 'professional');
      expect(result.length).toBeLessThan(2000);
    });
  });

  describe('GENERATE_HASHTAGS', () => {
    it('includes tags in user prompt', () => {
      const result = PROMPTS.GENERATE_HASHTAGS.user('Content', [
        'AI',
        'Tech',
      ]);
      expect(result).toContain('AI, Tech');
    });

    it('handles empty tags', () => {
      const result = PROMPTS.GENERATE_HASHTAGS.user('Content', []);
      expect(result).toContain('none');
    });
  });

  describe('CREATE_THREAD', () => {
    it('includes max posts limit', () => {
      expect(PROMPTS.CREATE_THREAD.system).toContain('10');
    });
  });

  describe('REWRITE_TONE', () => {
    it('includes target tone in user prompt', () => {
      const result = PROMPTS.REWRITE_TONE.user('Original post', 'authority');
      expect(result).toContain('authority');
      expect(result).toContain('Original post');
    });
  });

  describe('GENERATE_VARIANTS', () => {
    it('includes variant count in user prompt', () => {
      const result = PROMPTS.GENERATE_VARIANTS.user('Content', 'casual', 3);
      expect(result).toContain('3');
    });
  });
});
