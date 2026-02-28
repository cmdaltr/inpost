# Transform Command Reference

`inpost transform` converts content into a LinkedIn post using AI.
Content can come from plain text, a file, or any supported notebook: Notion, Obsidian, OneNote, or Evernote.

## Fetching from a Notebook

### Using the `--notebook` shorthand (recommended)

Set your default notebook in `.env`:

```bash
DEFAULT_NOTEBOOK=notion    # notion | onenote | obsidian | evernote
```

Then use `--title` with a provider flag:

```bash
# Using the provider shorthand flag
inpost transform --notion --title "Why async teams win" -i --save
inpost transform --obsidian --title "Why async teams win" -i --save
inpost transform --onenote --title "Why async teams win" -i --save
inpost transform --evernote --title "Why async teams win" -i --save

# Or with --notebook explicitly
inpost transform --notebook obsidian --title "Why async teams win" -i --save
```

### Using provider-specific flags

```bash
# Notion
inpost transform --notion-title "Why async teams win" -i --save
inpost transform --notion-id abc123def456 -i --save

# Obsidian
inpost transform --obsidian-title "Why async teams win" -i --save
inpost transform --obsidian-id "Blog Posts/Why async teams win" -i --save

# OneNote
inpost transform --onenote-title "Why async teams win" -i --save
inpost transform --onenote-id "1-abc123..." -i --save

# Evernote
inpost transform --evernote-title "Why async teams win" -i --save
inpost transform --evernote-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -i --save
```

### Getting help mid-command

```bash
inpost transform ?
```

---

## Interactive Refinement

Add `-i` to enter the interactive feedback loop before saving:

```bash
inpost transform --notion-title "Why async teams win" -i --save
```

| Option | What it does |
|--------|-------------|
| Accept and continue | Confirms the current post and proceeds to save |
| Refine with feedback | Describe changes in plain text; AI rewrites accordingly |
| Edit directly | Opens your `$EDITOR` so you can make manual edits |
| Regenerate from scratch | Generates a completely new post from the original content |
| ❓ Help | Shows a description of each option, then returns to the menu |

---

## Editing and Saving Back to the Notebook

### Basic transform and save

Generate a post and write it back to the source in one step:

```bash
inpost transform --notion-title "Why async teams win" --save
```

### Interactive refinement before saving

```bash
inpost transform --notion-title "Why async teams win" -i --save
```

### Start from the existing AI Summary (Notion only)

If a Notion page already has an **AI Summary** saved, use it as the starting point:

```bash
# Re-transform starting from the existing AI Summary
inpost transform --notion-title "Why async teams win" --edit -i --save

# Use the existing AI Summary as-is (no transformation, just review and save)
inpost transform --notion-title "Why async teams win" --existing -i --save
```

---

## Common Workflows

### First draft — generate and save immediately

```bash
inpost transform --notion-title "My Post Title" --save
```

### First draft — review interactively, then save

```bash
inpost transform --notion-title "My Post Title" -i --save
```

### Using Obsidian as source

```bash
inpost transform --obsidian --title "My Post Title" -i --save
```

### Revision — refine an existing AI Summary interactively, then save

```bash
inpost transform --notion-title "My Post Title" --edit -i --save
```

### Generate multiple variants and save all

```bash
inpost transform --notion-title "My Post Title" --variants 3 --save
```

Variants are saved to the **Variants** field in Notion (Notion only), separated by `---`.

### Generate with hashtags and hooks, then review

```bash
inpost transform --notion-title "My Post Title" --hashtags --hooks -i --save
```

---

## What Gets Saved

When `--save` is used, behaviour depends on the provider:

| Provider | What happens |
|----------|-------------|
| **Notion** | Updates the **AI Summary** field (and **Variants** if `--variants` > 1) |
| **Obsidian** | Writes `ai_summary` into the note's YAML frontmatter |
| **OneNote** | Appends an AI Summary section at the bottom of the page |
| **Evernote** | Appends an AI Summary section to the note content |

The page **Status** is not changed by `transform --save`. Use `inpost pipeline` or `inpost publish` to advance a Notion post to **Published**.

---

## Option Reference

| Option | Description |
|--------|-------------|
| `--notebook <provider>` | notion \| onenote \| obsidian \| evernote (overrides `DEFAULT_NOTEBOOK`) |
| `--notion \| --obsidian \| --onenote \| --evernote` | Provider shorthands — use with `--title` or `--id` |
| `--title <title>` | Note title — use with a provider shorthand flag |
| `--id <id>` | Note ID — use with a provider shorthand flag |
| `--notion-title <title>` | Fetch Notion page by title |
| `--notion-id <id>` | Fetch Notion page by ID |
| `--obsidian-title <title>` | Fetch Obsidian note by filename or frontmatter title |
| `--obsidian-id <id>` | Fetch Obsidian note by vault-relative path |
| `--onenote-title <title>` | Fetch OneNote page by title |
| `--onenote-id <id>` | Fetch OneNote page by Graph API ID |
| `--evernote-title <title>` | Fetch Evernote note by title |
| `--evernote-id <id>` | Fetch Evernote note by GUID |
| `--save` | Write result back to the source notebook |
| `-i, --interactive` | Enter interactive refinement loop |
| `--edit` | Start from existing AI Summary instead of page body (Notion only) |
| `--existing` | Use existing AI Summary without re-transforming (Notion only) |
| `-t, --tone <tone>` | Override tone (default: `DEFAULT_TONE` in `.env`) |
| `--variants <n>` | Generate n alternative versions |
| `--hashtags` | Auto-generate hashtags |
| `--hooks` | Generate attention-grabbing opening lines |
| `--thread` | Format output as a LinkedIn thread |
| `--file <path>` | Read content from a local file |
| `--json` | Output result as JSON |
