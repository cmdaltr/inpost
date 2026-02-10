import { describe, it, expect } from 'vitest';
import {
  validatePostLength,
  validateThreadLength,
} from '../../../src/utils/validation.js';

describe('validatePostLength', () => {
  it('accepts posts under the limit', () => {
    const result = validatePostLength('Hello LinkedIn!');
    expect(result.valid).toBe(true);
    expect(result.length).toBe(15);
    expect(result.maxLength).toBe(3000);
  });

  it('rejects posts over the limit', () => {
    const longText = 'a'.repeat(3001);
    const result = validatePostLength(longText);
    expect(result.valid).toBe(false);
    expect(result.length).toBe(3001);
  });

  it('accepts posts exactly at the limit', () => {
    const text = 'a'.repeat(3000);
    const result = validatePostLength(text);
    expect(result.valid).toBe(true);
  });
});

describe('validateThreadLength', () => {
  it('accepts valid threads', () => {
    const posts = ['Post 1', 'Post 2', 'Post 3'];
    const result = validateThreadLength(posts);
    expect(result.valid).toBe(true);
    expect(result.count).toBe(3);
    expect(result.invalidPosts).toEqual([]);
  });

  it('rejects threads with posts exceeding character limit', () => {
    const posts = ['Short post', 'a'.repeat(3001)];
    const result = validateThreadLength(posts);
    expect(result.valid).toBe(false);
    expect(result.invalidPosts).toEqual([1]);
  });

  it('rejects threads exceeding post count limit', () => {
    const posts = Array.from({ length: 11 }, (_, i) => `Post ${i + 1}`);
    const result = validateThreadLength(posts);
    expect(result.valid).toBe(false);
    expect(result.count).toBe(11);
    expect(result.maxCount).toBe(10);
  });
});
