import { createLinkedInClient } from './client.js';
import { validatePostLength } from '../../utils/validation.js';
import { ValidationError } from '../../utils/errors.js';
import { createChildLogger } from '../../utils/logger.js';
import type { PublishOptions, PublishResult } from '../../types/index.js';

const log = createChildLogger('linkedin:publisher');

export interface LinkedInPublisher {
  publish(options: PublishOptions): Promise<PublishResult>;
}

export function createLinkedInPublisher(): LinkedInPublisher {
  const client = createLinkedInClient();

  return {
    async publish(options: PublishOptions): Promise<PublishResult> {
      // Validate length
      const validation = validatePostLength(options.text);
      if (!validation.valid) {
        throw new ValidationError(
          `Post exceeds LinkedIn character limit (${validation.length}/${validation.maxLength})`,
        );
      }

      if (options.isDryRun) {
        log.info('Dry run mode - skipping actual publish');
        return {
          postId: 'dry-run-id',
          postUrl: 'https://linkedin.com/dry-run',
          publishedAt: new Date(),
        };
      }

      const result = await client.createPost(options.text, options.visibility);

      return {
        postId: result.postId,
        postUrl: result.postUrl,
        publishedAt: new Date(),
      };
    },
  };
}
