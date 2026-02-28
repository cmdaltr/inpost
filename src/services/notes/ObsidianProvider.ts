/**
 * ObsidianProvider
 *
 * Reads notes from a local Obsidian vault directory.
 * No API key required — Obsidian stores notes as plain Markdown files,
 * so this provider reads them directly from disk.
 *
 * Saves the AI summary back as a frontmatter field: `ai_summary`.
 *
 * Environment variables:
 *   OBSIDIAN_VAULT_PATH   Absolute path to your Obsidian vault directory
 *                         e.g. /Users/ben/Documents/MyVault
 *
 * Optional:
 *   OBSIDIAN_NOTES_DIR    Subdirectory within the vault to search (default: vault root)
 *                         e.g. Blog Posts
 */

import fs from 'fs';
import path from 'path';
import { NoteContent, NoteProvider } from './NoteProvider.js';

interface FrontMatter {
  [key: string]: string | string[] | undefined;
  tags?: string[];
  ai_summary?: string;
}

export class ObsidianProvider implements NoteProvider {
  readonly providerName = 'Obsidian';

  private get vaultPath(): string {
    const p = process.env.OBSIDIAN_VAULT_PATH;
    if (!p) {
      throw new Error(
        'OBSIDIAN_VAULT_PATH is not set. Add it to your .env file.\n' +
        'Example: OBSIDIAN_VAULT_PATH=/Users/ben/Documents/MyVault'
      );
    }
    return p;
  }

  private get notesDir(): string {
    const sub = process.env.OBSIDIAN_NOTES_DIR;
    return sub ? path.join(this.vaultPath, sub) : this.vaultPath;
  }

  // ─── Markdown / frontmatter helpers ─────────────────────────────────────

  /**
   * Parse YAML frontmatter from a markdown file.
   * Returns { frontmatter, body } where body is the content after the fence.
   */
  private parseFrontmatter(raw: string): { frontmatter: FrontMatter; body: string } {
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) {
      return { frontmatter: {}, body: raw };
    }

    const frontmatter: FrontMatter = {};
    for (const line of fmMatch[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      // Simple YAML list: "tags: [a, b]" or "tags:\n  - a"
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }

    return { frontmatter, body: fmMatch[2] };
  }

  /**
   * Serialise frontmatter + body back to a markdown string.
   */
  private serialiseFrontmatter(frontmatter: FrontMatter, body: string): string {
    const lines = Object.entries(frontmatter).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
      return `${k}: ${v ?? ''}`;
    });
    return `---\n${lines.join('\n')}\n---\n${body}`;
  }

  /**
   * Strip Obsidian-flavoured Markdown to plain text for AI ingestion.
   */
  private markdownToPlainText(md: string): string {
    return md
      // Remove wikilinks [[Page|Alias]] → Alias or Page
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Remove standard markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Remove headings hashes
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // Remove inline code
      .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove blockquotes
      .replace(/^>\s?/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove task checkboxes
      .replace(/^-\s+\[[ x]\]\s+/gm, '')
      // Remove bullet/numbered list markers
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Collapse whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ─── File discovery ──────────────────────────────────────────────────────

  /**
   * Recursively collect all .md file paths under a directory.
   */
  private getAllMarkdownFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      // Skip Obsidian hidden folders
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getAllMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private filePathToId(filePath: string): string {
    // ID is the vault-relative path without extension
    return path.relative(this.vaultPath, filePath).replace(/\.md$/, '');
  }

  private idToFilePath(id: string): string {
    return path.join(this.vaultPath, `${id}.md`);
  }

  private readNoteFile(filePath: string): NoteContent {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = this.parseFrontmatter(raw);
    const fileName = path.basename(filePath, '.md');
    const title = (frontmatter.title as string) ?? fileName;
    const text = this.markdownToPlainText(body);
    const id = this.filePathToId(filePath);

    return {
      id,
      title,
      text,
      tags: frontmatter.tags as string[] | undefined,
    };
  }

  // ─── NoteProvider interface ──────────────────────────────────────────────

  async fetchByTitle(title: string): Promise<NoteContent> {
    const files = this.getAllMarkdownFiles(this.notesDir);
    const lower = title.toLowerCase();

    // First try: exact filename match (case-insensitive)
    const exact = files.find(
      (f) => path.basename(f, '.md').toLowerCase() === lower
    );
    if (exact) return this.readNoteFile(exact);

    // Second try: filename contains the query
    const partial = files.find((f) =>
      path.basename(f, '.md').toLowerCase().includes(lower)
    );
    if (partial) return this.readNoteFile(partial);

    // Third try: frontmatter title field match
    const byFrontmatter = files.find((f) => {
      try {
        const raw = fs.readFileSync(f, 'utf-8');
        const { frontmatter } = this.parseFrontmatter(raw);
        return (frontmatter.title as string | undefined)
          ?.toLowerCase()
          .includes(lower);
      } catch {
        return false;
      }
    });

    if (byFrontmatter) return this.readNoteFile(byFrontmatter);

    throw new Error(
      `Obsidian: no note found with title containing "${title}" in ${this.notesDir}`
    );
  }

  async fetchById(id: string): Promise<NoteContent> {
    const filePath = this.idToFilePath(id);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Obsidian: note not found at path "${filePath}"`);
    }
    return this.readNoteFile(filePath);
  }

  async saveAISummary(id: string, summary: string): Promise<void> {
    const filePath = this.idToFilePath(id);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Obsidian: cannot save — note not found at "${filePath}"`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = this.parseFrontmatter(raw);

    // Write summary into frontmatter field
    frontmatter.ai_summary = summary.replace(/\n/g, ' ');

    const updated = this.serialiseFrontmatter(frontmatter, body);
    fs.writeFileSync(filePath, updated, 'utf-8');
  }
}
