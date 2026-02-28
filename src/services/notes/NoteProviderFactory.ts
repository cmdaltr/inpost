/**
 * NoteProviderFactory
 *
 * Resolves the correct NoteProvider from the CLI options passed to
 * `transform` and `publish`. Drop this into src/services/notes/
 * and call it from the command handler.
 *
 * Resolution order:
 *   --notion-title / --notion-id   → NotionProvider  (existing)
 *   --onenote-title / --onenote-id → OneNoteProvider
 *   --obsidian-title / --obsidian-id → ObsidianProvider
 *   --evernote-title / --evernote-id → EvernoteProvider
 *
 * The function also returns a NoteRef — the resolved title/id pair —
 * so the calling command doesn't need to know which provider it's using.
 */

import { NoteProvider, NoteContent } from './NoteProvider.js';
import { OneNoteProvider } from './OneNoteProvider.js';
import { ObsidianProvider } from './ObsidianProvider.js';
import { EvernoteProvider } from './EvernoteProvider.js';

export interface NoteOptions {
  // Existing Notion flags (kept for backwards compatibility)
  notionTitle?: string;
  notionId?: string;

  // New provider flags
  onenoteTitle?: string;
  onenoteId?: string;

  obsidianTitle?: string;
  obsidianId?: string;

  evernoteTitle?: string;
  evernoteId?: string;
}

export interface ResolvedNote {
  provider: NoteProvider;
  content: NoteContent;
}

/**
 * Resolve a provider and fetch the note based on whichever flag was passed.
 * Throws a clear error if no flag is provided or the note cannot be found.
 */
export async function resolveNote(opts: NoteOptions): Promise<ResolvedNote> {
  // ── OneNote ─────────────────────────────────────────────────────────────
  if (opts.onenoteTitle || opts.onenoteId) {
    const provider = new OneNoteProvider();
    const content = opts.onenoteId
      ? await provider.fetchById(opts.onenoteId)
      : await provider.fetchByTitle(opts.onenoteTitle!);
    return { provider, content };
  }

  // ── Obsidian ─────────────────────────────────────────────────────────────
  if (opts.obsidianTitle || opts.obsidianId) {
    const provider = new ObsidianProvider();
    const content = opts.obsidianId
      ? await provider.fetchById(opts.obsidianId)
      : await provider.fetchByTitle(opts.obsidianTitle!);
    return { provider, content };
  }

  // ── Evernote ─────────────────────────────────────────────────────────────
  if (opts.evernoteTitle || opts.evernoteId) {
    const provider = new EvernoteProvider();
    const content = opts.evernoteId
      ? await provider.fetchById(opts.evernoteId)
      : await provider.fetchByTitle(opts.evernoteTitle!);
    return { provider, content };
  }

  // If none matched, fall through to caller to handle Notion (existing path)
  throw new Error(
    'No note source specified. Use one of:\n' +
    '  --notion-title / --notion-id\n' +
    '  --onenote-title / --onenote-id\n' +
    '  --obsidian-title / --obsidian-id\n' +
    '  --evernote-title / --evernote-id'
  );
}
