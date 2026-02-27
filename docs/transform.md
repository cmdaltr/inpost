# Transform Command Reference

`inpost transform` converts content into a LinkedIn post using AI.
Content can come from plain text, a file, or a Notion page.

## Fetching from Notion

### `--notion-title <title>`

Fetches a page from your Notion database by its title (the **Name** property).

```bash
inpost transform --notion-title "Why async teams win"
```

- The title match is exact but trims whitespace
- If no page is found, the command exits with an error and lists no candidates
- Use `inpost fetch` to see available page titles

### `--notion-id <id>`

Fetches a page by its Notion page ID. Useful in scripts where you already have the ID.

```bash
inpost transform --notion-id abc123def456
```

Both options read the page body as source content and pull the **Tags** and **AI Summary** properties automatically.

---

## Editing and Saving Back to Notion

### Basic transform and save

Generate a post and write it to the **AI Summary** field in one step:

```bash
inpost transform --notion-title "Why async teams win" --save
```

### Interactive refinement before saving

Add `-i` to enter the interactive feedback loop. You can accept, refine, edit, or regenerate before the result is saved:

```bash
inpost transform --notion-title "Why async teams win" -i --save
```

In interactive mode, you have four options:

| Option | What it does |
|--------|-------------|
| Accept and continue | Confirms the current post and proceeds to save |
| Refine with feedback | Describe changes in plain text; AI rewrites accordingly |
| Edit directly | Opens your `$EDITOR` so you can make manual edits |
| Regenerate from scratch | Generates a completely new post from the original content |

### Start from the existing AI Summary

If a post already has an **AI Summary** saved in Notion, you can use it as the starting point for further refinement instead of reprocessing the full body:

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

### Revision — refine an existing AI Summary interactively, then save

```bash
inpost transform --notion-title "My Post Title" --edit -i --save
```

### Generate multiple variants and save all

```bash
inpost transform --notion-title "My Post Title" --variants 3 --save
```

Variants are saved to the **Variants** field in Notion, separated by `---`.

### Generate with hashtags and hooks, then review

```bash
inpost transform --notion-title "My Post Title" --hashtags --hooks -i --save
```

---

## What Gets Saved to Notion

When `--save` is used, the command updates two fields on the source page:

| Field | Updated when |
|-------|-------------|
| **AI Summary** | Always (the final accepted post) |
| **Variants** | Only when `--variants` > 1 |

The page **Status** is not changed by `transform --save`. Use `inpost pipeline` or `inpost publish` to advance a post to **Published**.

---

## Option Reference

| Option | Description |
|--------|-------------|
| `--notion-title <title>` | Fetch page by title |
| `--notion-id <id>` | Fetch page by ID |
| `--save` | Write result back to Notion |
| `-i, --interactive` | Enter interactive refinement loop |
| `--edit` | Start from existing AI Summary instead of page body |
| `--existing` | Use existing AI Summary without re-transforming |
| `-t, --tone <tone>` | Override tone (default: `DEFAULT_TONE` in `.env`) |
| `--variants <n>` | Generate n alternative versions |
| `--hashtags` | Auto-generate hashtags |
| `--hooks` | Generate attention-grabbing opening lines |
| `--thread` | Format output as a LinkedIn thread |
| `--file <path>` | Read content from a local file |
| `--json` | Output result as JSON |
