/**
 * NoteProvider interface
 *
 * Shared contract for all note source integrations.
 * Notion already satisfies this interface — OneNote, Obsidian,
 * and Evernote implement it the same way.
 */

export interface NoteContent {
  /** Plain text body of the note, stripped of markup */
  text: string;
  /** Original title of the note */
  title: string;
  /** Source-specific unique identifier */
  id: string;
  /** ISO timestamp of last modification, if available */
  updatedAt?: string;
  /** Any tags or labels attached to the note */
  tags?: string[];
}

export interface NoteProvider {
  /**
   * Fetch a note by its title (fuzzy match, first result wins).
   * Mirrors --notion-title behaviour.
   */
  fetchByTitle(title: string): Promise<NoteContent>;

  /**
   * Fetch a note by its provider-specific ID.
   * Mirrors --notion-id behaviour.
   */
  fetchById(id: string): Promise<NoteContent>;

  /**
   * Write the AI-generated summary back to the note.
   * Called when --save is passed on transform.
   */
  saveAISummary(id: string, summary: string): Promise<void>;

  /**
   * Return the display name of this provider, used in logs.
   * e.g. "OneNote", "Obsidian", "Evernote"
   */
  readonly providerName: string;
}
