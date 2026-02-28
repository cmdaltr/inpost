# Note Providers

InPost can pull content from four sources: **Notion**, **Obsidian**, **OneNote**, and **Evernote**. All four work identically with `transform` and `publish` — only the flag names differ.

---

## Notion (default)

See `docs/notion-setup.md` for full setup. No additional configuration needed beyond the existing `.env` variables.

```bash
inpost transform --notion-title "My Post" -i --save
inpost publish --notion-title "My Post"
```

---

## Obsidian

Obsidian stores notes as plain Markdown files on disk. No API key or account is required — InPost reads them directly from your vault directory.

### Setup

Add to `.env`:

```bash
OBSIDIAN_VAULT_PATH=/Users/you/Documents/MyVault
OBSIDIAN_NOTES_DIR=Blog Posts    # optional — searches only this subdirectory
```

No authentication step needed.

### Usage

```bash
# By note title (matches filename or frontmatter title field, case-insensitive)
inpost transform --obsidian-title "How to Use Volatility3" -i --save

# By vault-relative path (no .md extension)
inpost transform --obsidian-id "Blog Posts/How to Use Volatility3" -i --save

# Publish directly
inpost publish --obsidian-title "How to Use Volatility3"
```

### How --save works

The AI summary is written into the note's YAML frontmatter under the key `ai_summary`:

```yaml
---
title: How to Use Volatility3
tags: [dfir, memory-forensics]
ai_summary: Memory forensics just got easier...
---
```

### Title matching

`--obsidian-title` tries three strategies in order:
1. Exact filename match (case-insensitive)
2. Filename contains the query string
3. Frontmatter `title` field contains the query string

The first match wins.

---

## OneNote

OneNote requires a one-time Azure AD app registration and OAuth authentication.

### Azure setup (one-time)

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory → App registrations → New registration**
2. Name: **InPost**, Supported account types: **Personal Microsoft accounts only**
3. Redirect URI: `http://localhost:3456/callback`
4. Under **API permissions**, add `Notes.ReadWrite.All` (delegated)
5. Under **Certificates & secrets**, create a new client secret
6. Copy the **Application (client) ID**, **Directory (tenant) ID**, and the **client secret value**

### Setup

Add to `.env`:

```bash
ONENOTE_CLIENT_ID=your-azure-app-client-id
ONENOTE_CLIENT_SECRET=your-azure-app-client-secret
ONENOTE_TENANT_ID=consumers          # use "consumers" for personal Microsoft accounts
ONENOTE_REDIRECT_URI=http://localhost:3456/callback
```

Authenticate (one-time — credentials are saved to `~/.inpost/onenote-credentials.json`):

```bash
inpost auth --onenote
```

### Usage

```bash
# By page title
inpost transform --onenote-title "How to Use Volatility3" -i --save

# By page ID (from the Graph API or OneNote web URL)
inpost transform --onenote-id "1-abc123..." -i --save

inpost publish --onenote-title "How to Use Volatility3"
```

### How --save works

Appends the AI summary as a new section at the bottom of the OneNote page using the Microsoft Graph API PATCH endpoint.

### Token refresh

OneNote access tokens refresh automatically via the stored refresh token. If authentication fails, re-run `inpost auth --onenote`.

---

## Evernote

Evernote uses a developer token for personal access — no OAuth flow is required.

### Get a developer token

1. Log in to [evernote.com](https://www.evernote.com)
2. Visit: `https://www.evernote.com/api/DeveloperToken.action`
3. Click **Create a developer token** and copy the token

### Install the SDK

```bash
npm install evernote
```

This is already installed if you cloned the repo and ran `npm install`.

### Setup

Add to `.env`:

```bash
EVERNOTE_TOKEN=S=s1:U=abc123:E=...your-token...
EVERNOTE_NOTEBOOK=Blog Posts    # optional — scope searches to a specific notebook
EVERNOTE_SANDBOX=false          # set to true to use sandbox.evernote.com for testing
```

No authentication step needed — the token is used directly.

### Usage

```bash
# By note title
inpost transform --evernote-title "How to Use Volatility3" -i --save

# By note GUID (visible in Evernote desktop under Note Info)
inpost transform --evernote-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -i --save

inpost publish --evernote-title "How to Use Volatility3"
```

### How --save works

Fetches the existing note content (ENML), appends an AI Summary section with a horizontal rule, and updates the note via `NoteStore.updateNote`.

---

## Flag reference

All flags work identically across `transform` and `publish`.

| Flag | Provider | Description |
|---|---|---|
| `--notion-title <title>` | Notion | Fetch page by title |
| `--notion-id <id>` | Notion | Fetch page by ID |
| `--onenote-title <title>` | OneNote | Fetch page by title |
| `--onenote-id <id>` | OneNote | Fetch page by Graph API ID |
| `--obsidian-title <title>` | Obsidian | Fetch note by filename or frontmatter title |
| `--obsidian-id <id>` | Obsidian | Fetch note by vault-relative path |
| `--evernote-title <title>` | Evernote | Fetch note by title |
| `--evernote-id <id>` | Evernote | Fetch note by GUID |

---

## Common workflow across all providers

```bash
# 1. Transform and review
inpost transform --<provider>-title "My Note" -i --save

# 2. Publish
inpost publish --<provider>-title "My Note"
```

For Notion, `publish` will use the saved AI Summary automatically. For other providers, `publish` uses the raw note text — run `transform --save` first to generate a refined version.
