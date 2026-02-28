import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadEnv } from '../../config/index.js';
import { createTransformer } from '../services/ai/transformer.js';
import { createNotionReader } from '../services/notion/reader.js';
import { createAIClientFromEnv } from '../services/ai/provider.js';
import { PROMPTS } from '../services/ai/prompts.js';
import { setLogLevel } from '../utils/logger.js';
import { resolveNote } from '../services/notes/NoteProviderFactory.js';
import { printCommandHelp } from '../utils/help.js';
import type { NoteProvider } from '../services/notes/NoteProvider.js';
import type { Tone, TransformOptions } from '../types/index.js';

export function registerTransformCommand(program: Command): void {
  program
    .command('transform [text]')
    .description('Transform content for LinkedIn')
    // ── Generic notebook shorthand ───────────────────────────────────────────
    .option('--notebook <provider>', 'Notebook provider (overrides DEFAULT_NOTEBOOK): notion | onenote | obsidian | evernote')
    .option('--notion', 'Shorthand for --notebook notion', false)
    .option('--onenote', 'Shorthand for --notebook onenote', false)
    .option('--obsidian', 'Shorthand for --notebook obsidian', false)
    .option('--evernote', 'Shorthand for --notebook evernote', false)
    .option('--title <title>', 'Note title — used with --notebook/provider flag as shorthand for --<provider>-title')
    .option('--id <id>', 'Note ID — used with --notebook/provider flag as shorthand for --<provider>-id')
    // ── Notion ──────────────────────────────────────────────────────────────
    .option('--notion-id <id>', 'Fetch content from a Notion page by ID')
    .option('--notion-title <title>', 'Fetch content from a Notion page by title')
    // ── OneNote ─────────────────────────────────────────────────────────────
    .option('--onenote-title <title>', 'Fetch content from OneNote by page title')
    .option('--onenote-id <id>', 'Fetch content from OneNote by page ID')
    // ── Obsidian ────────────────────────────────────────────────────────────
    .option('--obsidian-title <title>', 'Fetch content from Obsidian vault by note title')
    .option('--obsidian-id <id>', 'Fetch content from Obsidian vault by relative path')
    // ── Evernote ────────────────────────────────────────────────────────────
    .option('--evernote-title <title>', 'Fetch content from Evernote by note title')
    .option('--evernote-id <id>', 'Fetch content from Evernote by note GUID')
    // ── Transform options ────────────────────────────────────────────────────
    .option('--edit', 'Edit existing AI summary instead of creating new', false)
    .option('--existing', 'Use existing AI summary directly (skip transformation)', false)
    .option('--file <path>', 'Read content from a file')
    .option('-t, --tone <tone>', 'Tone (uses DEFAULT_TONE from .env if not set)')
    .option('--variants <count>', 'Number of variants to generate', '1')
    .option('--hooks', 'Generate attention-grabbing hooks', false)
    .option('--hashtags', 'Auto-generate hashtags', false)
    .option('--thread', 'Split into LinkedIn thread format', false)
    .option('-i, --interactive', 'Refine output with feedback loop', false)
    .option('--save', 'Save result back to the source note', false)
    .option('--json', 'Output as JSON', false)
    .action(async (text, options) => {
      if (text === '?') {
        printCommandHelp({
          command: 'transform [text]',
          summary: 'Transform a note or text into a LinkedIn-ready post using AI.',
          sections: [
            {
              heading: 'Source',
              options: [
                { flag: '--notebook <provider>', description: 'notion | onenote | obsidian | evernote', default: 'notion' },
                { flag: '--notion | --obsidian | --onenote | --evernote', description: 'Provider shorthands (combine with --title)' },
                { flag: '--title <title>', description: 'Note title — use with a provider flag' },
                { flag: '--notion-title <title>', description: 'Fetch from Notion by title' },
                { flag: '--obsidian-title <title>', description: 'Fetch from Obsidian by title' },
                { flag: '--onenote-title <title>', description: 'Fetch from OneNote by title' },
                { flag: '--evernote-title <title>', description: 'Fetch from Evernote by title' },
                { flag: '--file <path>', description: 'Read content from a local file' },
              ],
            },
            {
              heading: 'AI options',
              options: [
                { flag: '-t, --tone <tone>', description: 'professional|casual|authority|storytelling|educational', default: 'professional' },
                { flag: '--hooks', description: 'Generate attention-grabbing hook options' },
                { flag: '--hashtags', description: 'Auto-generate hashtags' },
                { flag: '--thread', description: 'Split into LinkedIn thread format' },
                { flag: '--variants <count>', description: 'Generate N alternative versions', default: '1' },
              ],
            },
            {
              heading: 'Workflow',
              options: [
                { flag: '-i, --interactive', description: 'Refine output with feedback loop (select ? in menu for help)' },
                { flag: '--save', description: 'Save result back to the source notebook' },
                { flag: '--existing', description: 'Use existing AI summary — skip regeneration' },
                { flag: '--edit', description: 'Edit existing AI summary as the starting input' },
              ],
            },
          ],
          examples: [
            'inpost transform --notion-title "My Post" -i --save',
            'inpost transform --obsidian --title "My Post" -i --save',
            'inpost transform --notion-title "My Post" --tone casual --hashtags',
            'inpost transform "Paste your content here" -i',
          ],
        });
        return;
      }

      if (options.interactive) {
        process.env.LOG_LEVEL = 'fatal';
        setLogLevel('fatal');
      }

      const env = loadEnv();

      // ── Resolve --notebook/provider shorthand + --title/--id ──────────────
      if ((options.notebook || options.notion || options.onenote || options.obsidian || options.evernote) && (options.title || options.id)) {
        const nb =
          options.notion ? 'notion' :
          options.onenote ? 'onenote' :
          options.obsidian ? 'obsidian' :
          options.evernote ? 'evernote' :
          options.notebook ?? env.DEFAULT_NOTEBOOK;
        if (nb === 'notion') {
          if (options.title) options.notionTitle = options.title;
          if (options.id) options.notionId = options.id;
        } else if (nb === 'onenote') {
          if (options.title) options.onenoteTitle = options.title;
          if (options.id) options.onenoteId = options.id;
        } else if (nb === 'obsidian') {
          if (options.title) options.obsidianTitle = options.title;
          if (options.id) options.obsidianId = options.id;
        } else if (nb === 'evernote') {
          if (options.title) options.evernoteTitle = options.title;
          if (options.id) options.evernoteId = options.id;
        }
      }

      // Resolve content from input source
      let content: string;
      let tags: string[] = [];
      let notionPageId: string | undefined;
      let existingAiSummary: string | undefined;
      let noteProvider: NoteProvider | undefined;
      let noteProviderPageId: string | undefined;

      if (options.onenoteTitle || options.onenoteId || options.obsidianTitle || options.obsidianId || options.evernoteTitle || options.evernoteId) {
        // ── New providers (OneNote, Obsidian, Evernote) ────────────────────
        const { provider, content: note } = await resolveNote({
          onenoteTitle: options.onenoteTitle,
          onenoteId: options.onenoteId,
          obsidianTitle: options.obsidianTitle,
          obsidianId: options.obsidianId,
          evernoteTitle: options.evernoteTitle,
          evernoteId: options.evernoteId,
        });

        console.log(chalk.dim(`\nFetched "${note.title}" from ${provider.providerName}`));

        content = note.text;
        tags = note.tags ?? [];
        noteProvider = provider;
        noteProviderPageId = note.id;

      } else if (options.notionId || options.notionTitle) {
        // ── Notion (existing path) ─────────────────────────────────────────
        const reader = createNotionReader(
          env.NOTION_API_TOKEN,
          env.NOTION_DATABASE_ID,
        );

        let post;
        if (options.notionId) {
          notionPageId = options.notionId;
          post = await reader.fetchPage(options.notionId);
        } else {
          post = await reader.fetchByTitle(options.notionTitle);
          if (!post) {
            console.error(chalk.red(`No page found with title: "${options.notionTitle}"`));
            process.exit(1);
          }
          notionPageId = post.id;
        }

        content = post.content;
        tags = post.tags;
        existingAiSummary = post.aiSummary;

        if (options.edit && existingAiSummary) {
          content = existingAiSummary;
        }

      } else if (text) {
        content = text;
      } else if (options.file) {
        const fs = await import('node:fs');
        content = fs.readFileSync(options.file, 'utf-8');
      } else {
        console.error(
          chalk.red('Error: Provide text, --notion-id, --onenote-title, --obsidian-title, --evernote-title, or --file'),
        );
        process.exit(1);
      }

      const transformer = createTransformer(env);
      const tone = (options.tone || env.DEFAULT_TONE || 'professional') as Tone;

      const transformOptions: TransformOptions = {
        content,
        tone,
        type: 'summary',
        includeHooks: options.hooks,
        includeHashtags: options.hashtags,
        includeThread: options.thread,
        variantCount: parseInt(options.variants, 10),
        tags,
      };

      let result: import('../types/index.js').TransformResult;

      if (options.existing && existingAiSummary) {
        console.log(chalk.cyan('\n📄 Using existing AI summary...\n'));
        result = {
          summary: existingAiSummary,
          metadata: { model: 'existing', tokensUsed: 0, processingTimeMs: 0 },
        };
      } else if (options.existing && !existingAiSummary) {
        console.error(chalk.red('No existing AI summary found. Run without --existing to generate one.'));
        process.exit(1);
      } else {
        if (options.interactive) {
          console.log(chalk.cyan(`\n✨ Generating LinkedIn post (${tone} tone)...\n`));
        } else {
          console.log(chalk.dim(`\nTransforming (${tone})...\n`));
        }
        result = await transformer.transform(transformOptions);
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Text output
      console.log(chalk.bold('LinkedIn Post:\n'));
      console.log(result.summary);

      if (result.hooks && result.hooks.length > 0) {
        console.log(chalk.bold('\n\nHook Options:\n'));
        result.hooks.forEach((hook, i) => {
          console.log(`  ${i + 1}. ${hook}`);
        });
      }

      if (result.hashtags && result.hashtags.length > 0) {
        console.log(chalk.bold('\n\nHashtags:\n'));
        console.log(`  ${result.hashtags.join(' ')}`);
      }

      if (result.thread && result.thread.length > 0) {
        console.log(chalk.bold('\n\nThread Posts:\n'));
        result.thread.forEach((post, i) => {
          console.log(chalk.dim(`--- Post ${i + 1}/${result.thread!.length} ---`));
          console.log(post);
          console.log();
        });
      }

      if (result.variants && result.variants.length > 0) {
        console.log(chalk.bold('\n\nVariants:\n'));
        result.variants.forEach((variant, i) => {
          console.log(chalk.dim(`--- Variant ${i + 1} ---`));
          console.log(variant);
          console.log();
        });
      }

      // Interactive feedback loop
      if (options.interactive) {
        let currentPost = result.summary;
        const { client } = createAIClientFromEnv(env);

        console.log(chalk.dim('\nUse ↑↓ arrows to select, Enter to confirm\n'));

        while (true) {
          const { action } = await inquirer.prompt([
            {
              type: 'select',
              name: 'action',
              message: 'What would you like to do?',
              choices: [
                { name: '✓ Accept and continue', value: 'accept' },
                { name: '✏️  Refine with feedback', value: 'feedback' },
                { name: '📝 Edit directly', value: 'edit' },
                { name: '🔄 Regenerate from scratch', value: 'regenerate' },
                { name: '✗ Cancel', value: 'cancel' },
                { name: '❓ Help', value: 'help' },
              ],
            },
          ]);

          if (action === 'accept') {
            result.summary = currentPost;
            console.log(chalk.green('\n✓ Post accepted!\n'));
            break;
          }

          if (action === 'cancel') {
            console.log(chalk.yellow('\nCancelled.\n'));
            return;
          }

          if (action === 'help') {
            console.log(chalk.bold('\nInteractive mode options:\n'));
            console.log(`  ${chalk.green('✓ Accept')}         Save this version and continue to --save / exit`);
            console.log(`  ${chalk.cyan('✏️  Refine')}         Describe a change and the AI will rewrite the post`);
            console.log(`                 Examples: "make it shorter", "add a question at the end"`);
            console.log(`  ${chalk.cyan('📝 Edit')}           Open the post in your $EDITOR for manual changes`);
            console.log(`  ${chalk.cyan('🔄 Regenerate')}     Discard current version and generate a fresh one`);
            console.log(`  ${chalk.red('✗ Cancel')}         Exit without saving anything`);
            console.log();
            console.log(chalk.dim('  Tip: run with --save to write the accepted post back to your notebook'));
            console.log(chalk.dim('  Tip: run with --tone casual (or professional/authority/storytelling/educational)'));
            console.log();
            continue;
          }

          if (action === 'regenerate') {
            console.log(chalk.cyan('\n🔄 Regenerating...\n'));
            const newResult = await transformer.transform(transformOptions);
            currentPost = newResult.summary;
            result.summary = currentPost;
            console.log(chalk.bold('LinkedIn Post:\n'));
            console.log(currentPost);
            console.log();
            continue;
          }

          if (action === 'edit') {
            const { edited } = await inquirer.prompt([
              {
                type: 'editor',
                name: 'edited',
                message: 'Edit the post (save and close to continue)',
                default: currentPost,
              },
            ]);

            if (edited && edited.trim()) {
              currentPost = edited.trim();
              result.summary = currentPost;
              console.log(chalk.bold('\nLinkedIn Post:\n'));
              console.log(currentPost);
              console.log();
            }
            continue;
          }

          if (action === 'feedback') {
            const { feedback } = await inquirer.prompt([
              {
                type: 'input',
                name: 'feedback',
                message: 'What changes would you like?',
              },
            ]);

            if (!feedback.trim()) continue;

            console.log(chalk.cyan('\n✏️  Refining...\n'));

            const response = await client.complete(
              PROMPTS.REFINE.system,
              PROMPTS.REFINE.user(currentPost, feedback),
            );

            currentPost = response.text;
            result.summary = currentPost;

            console.log(chalk.bold('LinkedIn Post:\n'));
            console.log(currentPost);
            console.log();
          }
        }
      } else {
        console.log(
          chalk.dim(
            `\n(${result.metadata.tokensUsed} tokens, ${result.metadata.processingTimeMs}ms)`,
          ),
        );
      }

      // Save result back to source
      if (options.save) {
        if (noteProvider && noteProviderPageId) {
          // New providers: save via provider interface
          await noteProvider.saveAISummary(noteProviderPageId, result.summary);
          console.log(chalk.green(`\nSaved to ${noteProvider.providerName}.`));
        } else if (notionPageId) {
          // Notion: save via Notion writer
          const { createNotionWriter } = await import('../services/notion/writer.js');
          const writer = createNotionWriter(env.NOTION_API_TOKEN);
          await writer.updateAISummary(notionPageId, result.summary);
          if (result.variants) {
            await writer.updateVariants(notionPageId, result.variants.join('\n\n---\n\n'));
          }
          console.log(chalk.green('\nSaved to Notion.'));
        } else {
          console.log(chalk.yellow('\n--save requires a note source (--notion-title, --onenote-title, --obsidian-title, or --evernote-title).'));
        }
      }

      console.log();
    });
}
