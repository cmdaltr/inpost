# Obsidian Setup Guide

Obsidian stores notes as plain Markdown files on disk. No API key, account, or authentication is required — InPost reads directly from your vault.

## 1. Configure the Vault Path

Add to your `.env`:

```bash
OBSIDIAN_VAULT_PATH=/Users/you/Documents/MyVault
OBSIDIAN_NOTES_DIR=Blog Posts    # optional — scope searches to a subdirectory
```

`OBSIDIAN_NOTES_DIR` is relative to `OBSIDIAN_VAULT_PATH`. If omitted, InPost searches the entire vault.

## 2. Verify

```bash
inpost status --obsidian
inpost fetch --obsidian --all
```

`fetch --all` lists all `.md` files found under the configured path.

## 3. Usage

```bash
# Transform by note title (matches filename or frontmatter title, case-insensitive)
inpost transform --obsidian-title "How to Use Volatility3" -i --save

# Transform by vault-relative path (no .md extension)
inpost transform --obsidian-id "Blog Posts/How to Use Volatility3" -i --save

# Or use the provider shorthand
inpost transform --obsidian --title "How to Use Volatility3" -i --save

# Publish
inpost publish --obsidian-title "How to Use Volatility3"
```

## 4. How `--save` Works

The AI summary is written into the note's YAML frontmatter under the key `ai_summary`:

```yaml
---
title: How to Use Volatility3
tags: [dfir, memory-forensics]
ai_summary: Memory forensics just got easier...
---
```

If the note has no frontmatter, InPost adds it. The rest of the file is unchanged.

## 5. Title Matching

`--obsidian-title` tries three strategies in order:

1. Exact filename match (case-insensitive, without `.md`)
2. Filename contains the query string
3. Frontmatter `title` field contains the query string

The first match wins. Use `--obsidian-id` with the vault-relative path for an exact match.

## 6. Set as Default Notebook

To avoid specifying `--obsidian` on every command, add to `.env`:

```bash
DEFAULT_NOTEBOOK=obsidian
```

Then `inpost fetch --all`, `inpost status`, and `inpost transform --title "..."` all default to Obsidian.
