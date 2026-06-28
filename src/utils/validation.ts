import { defaultConfig } from '../../config/default.js';

export function validatePostLength(text: string): {
  valid: boolean;
  length: number;
  maxLength: number;
} {
  const maxLength = defaultConfig.linkedin.maxPostLength;
  return {
    valid: text.length <= maxLength,
    length: text.length,
    maxLength,
  };
}

export function validateThreadLength(posts: string[]): {
  valid: boolean;
  count: number;
  maxCount: number;
  invalidPosts: number[];
} {
  const maxCount = defaultConfig.linkedin.maxThreadPosts;
  const maxLength = defaultConfig.linkedin.maxPostLength;
  const invalidPosts = posts
    .map((p, i) => (p.length > maxLength ? i : -1))
    .filter((i) => i >= 0);

  return {
    valid: posts.length <= maxCount && invalidPosts.length === 0,
    count: posts.length,
    maxCount,
    invalidPosts,
  };
}
