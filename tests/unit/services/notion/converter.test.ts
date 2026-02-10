import { describe, it, expect } from 'vitest';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import {
  blocksToMarkdown,
  blocksToPlainText,
} from '../../../../src/services/notion/converter.js';
import fixtureBlocks from '../../../fixtures/notion-blocks.json';

const blocks = fixtureBlocks as unknown as BlockObjectResponse[];

describe('blocksToMarkdown', () => {
  it('converts blocks to markdown format', () => {
    const result = blocksToMarkdown(blocks);

    expect(result).toContain('# Introduction to AI');
    expect(result).toContain(
      "Artificial intelligence is transforming how we work. **Here's why it matters.**",
    );
    expect(result).toContain('- Automates repetitive tasks');
    expect(result).toContain('- Enhances decision making');
    expect(result).toContain('> *AI is the new electricity.*');
    expect(result).toContain("```javascript\nconsole.log('hello AI');\n```");
    expect(result).toContain('---');
    expect(result).toContain('## Conclusion');
    expect(result).toContain('[our website](https://example.com)');
  });

  it('filters out empty blocks', () => {
    const result = blocksToMarkdown(blocks);
    // Should not have consecutive blank lines from empty conversions
    expect(result).not.toContain('\n\n\n');
  });
});

describe('blocksToPlainText', () => {
  it('converts blocks to plain text format', () => {
    const result = blocksToPlainText(blocks);

    // Heading 1 should be uppercased
    expect(result).toContain('INTRODUCTION TO AI');
    // Bullet items should use unicode bullet
    expect(result).toContain('• Automates repetitive tasks');
    // No markdown formatting
    expect(result).not.toContain('#');
    expect(result).not.toContain('**');
    expect(result).not.toContain('```');
    // Plain text for quote
    expect(result).toContain('AI is the new electricity.');
  });

  it('strips links from plain text', () => {
    const result = blocksToPlainText(blocks);
    expect(result).not.toContain('](');
    expect(result).toContain('our website');
  });
});
