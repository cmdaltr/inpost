# Evernote Setup Guide

Evernote uses a developer token for personal access — no OAuth flow is required.

## 1. Get a Developer Token

1. Log in to [evernote.com](https://www.evernote.com)
2. Visit: `https://www.evernote.com/api/DeveloperToken.action`
3. Click **Create a developer token**
4. Copy the token — it looks like `S=s1:U=abc123:E=...`

> **Note:** Developer tokens give full access to your Evernote account. Treat the token like a password.

## 2. Configure `.env`

```bash
EVERNOTE_TOKEN=S=s1:U=abc123:E=...your-token...
EVERNOTE_NOTEBOOK=Blog Posts    # optional — scope searches to a specific notebook
EVERNOTE_SANDBOX=false          # set to true to use sandbox.evernote.com for testing
```

`EVERNOTE_NOTEBOOK` is optional. If set, InPost only searches notes in that notebook.

## 3. Verify

```bash
inpost status --evernote
```

## 4. Usage

```bash
# By note title
inpost transform --evernote-title "How to Use Volatility3" -i --save

# By note GUID (visible in Evernote desktop under Note Info → i)
inpost transform --evernote-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -i --save

# Or use the provider shorthand
inpost transform --evernote --title "How to Use Volatility3" -i --save

# Publish
inpost publish --evernote-title "How to Use Volatility3"
```

## 5. How `--save` Works

`--save` fetches the existing note content (ENML), appends an AI Summary section with a horizontal rule, and updates the note via `NoteStore.updateNote`.

## 6. Finding a Note GUID

In the Evernote desktop app:
1. Right-click a note → **Note Info** (or press `Ctrl+Shift+I` / `Cmd+Shift+I`)
2. The GUID is shown under the note title

## 7. Set as Default Notebook

```bash
DEFAULT_NOTEBOOK=evernote
```

Then `inpost status`, `inpost transform --title "..."`, etc. all default to Evernote.
