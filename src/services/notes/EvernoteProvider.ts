/**
 * EvernoteProvider
 *
 * Reads notes from Evernote via the Evernote Cloud API (Thrift SDK).
 * Saves the AI summary back as appended content.
 *
 * Environment variables:
 *   EVERNOTE_TOKEN        Evernote developer token (personal access)
 *                         Get one at: https://www.evernote.com/api/DeveloperToken.action
 *   EVERNOTE_SANDBOX      Set to "true" to use sandbox.evernote.com (default: false)
 *   EVERNOTE_NOTEBOOK     Optional notebook name to scope searches to
 *
 * Install the SDK:
 *   npm install evernote
 */

import { createRequire } from 'module';
import { NoteContent, NoteProvider } from './NoteProvider.js';

// Use createRequire to load the CJS Evernote SDK from an ESM module
const require = createRequire(import.meta.url);

type EvernoteClient = {
  getNoteStore(): NoteStore;
};
type NoteStore = {
  findNotes(filter: object, offset: number, maxNotes: number): Promise<NoteList>;
  getNote(guid: string, withContent: boolean, ...rest: boolean[]): Promise<EvernoteNote>;
  updateNote(note: EvernoteNote): Promise<EvernoteNote>;
};
type NoteList = {
  notes: EvernoteNote[];
};
type EvernoteNote = {
  guid: string;
  title: string;
  content: string;        // ENML (Evernote Markup Language)
  updated?: number;       // Unix ms timestamp
  tagNames?: string[];
};

const EVERNOTE_CONTENT_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">';

export class EvernoteProvider implements NoteProvider {
  readonly providerName = 'Evernote';

  private client: EvernoteClient | null = null;

  // ─── Client init ─────────────────────────────────────────────────────────

  private getClient(): EvernoteClient {
    if (this.client) return this.client;

    const token = process.env.EVERNOTE_TOKEN;
    if (!token) {
      throw new Error(
        'EVERNOTE_TOKEN is not set. Add your Evernote developer token to .env.\n' +
        'Get one at: https://www.evernote.com/api/DeveloperToken.action'
      );
    }

    const Evernote = require('evernote') as { Client: new (opts: object) => EvernoteClient };
    const sandbox = process.env.EVERNOTE_SANDBOX === 'true';

    this.client = new Evernote.Client({ token, sandbox });
    return this.client!;
  }

  private getNoteStore(): NoteStore {
    return this.getClient().getNoteStore();
  }

  // ─── ENML helpers ────────────────────────────────────────────────────────

  private enmlToPlainText(enml: string): string {
    return enml
      .replace(/<en-media[^>]*\/>/gi, '[media]')
      .replace(/<en-crypt[^>]*>[\s\S]*?<\/en-crypt>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private buildUpdatedEnml(originalEnml: string, summary: string): string {
    const bodyMatch = originalEnml.match(/<en-note[^>]*>([\s\S]*)<\/en-note>/i);
    const body = bodyMatch ? bodyMatch[1] : originalEnml;

    const escapedSummary = summary
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

    return (
      EVERNOTE_CONTENT_HEADER +
      '<en-note>' +
      body +
      '<hr/>' +
      '<div><b>AI Summary (InPost)</b></div>' +
      `<div>${escapedSummary}</div>` +
      '</en-note>'
    );
  }

  private noteToNoteContent(note: EvernoteNote): NoteContent {
    return {
      id: note.guid,
      title: note.title,
      text: this.enmlToPlainText(note.content),
      updatedAt: note.updated ? new Date(note.updated).toISOString() : undefined,
      tags: note.tagNames,
    };
  }

  // ─── Notebook scoping ────────────────────────────────────────────────────

  private buildSearchFilter(query: string): object {
    const notebook = process.env.EVERNOTE_NOTEBOOK;
    const words = notebook ? `notebook:"${notebook}" ${query}` : query;
    return { words };
  }

  // ─── NoteProvider interface ──────────────────────────────────────────────

  async fetchByTitle(title: string): Promise<NoteContent> {
    const store = this.getNoteStore();
    const filter = this.buildSearchFilter(`intitle:${title}`);
    const noteList = await store.findNotes(filter, 0, 1);

    if (!noteList.notes?.length) {
      throw new Error(`Evernote: no note found with title "${title}"`);
    }

    const stub = noteList.notes[0];
    const note = await store.getNote(stub.guid, true, false, false, false);
    return this.noteToNoteContent(note);
  }

  async fetchById(id: string): Promise<NoteContent> {
    const store = this.getNoteStore();
    const note = await store.getNote(id, true, false, false, false);
    return this.noteToNoteContent(note);
  }

  async saveAISummary(id: string, summary: string): Promise<void> {
    const store = this.getNoteStore();
    const note = await store.getNote(id, true, false, false, false);
    const updatedContent = this.buildUpdatedEnml(note.content, summary);

    await store.updateNote({
      guid: id,
      title: note.title,
      content: updatedContent,
    });
  }
}
