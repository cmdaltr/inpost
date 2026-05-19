# InPost — Project Context

## What this is

InPost is a TypeScript CLI tool that transforms blog posts from notebooks (Notion, Obsidian, OneNote, Evernote) into LinkedIn-ready content using AI, then publishes directly to LinkedIn. It's Ben's content pipeline — everything goes through it before hitting LinkedIn.

## Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **CLI framework:** Commander.js
- **Interactive prompts:** Inquirer.js
- **Notebook SDKs:** @notionhq/client, Microsoft Graph API (OneNote), Evernote SDK
- **AI providers:** Groq, Google Gemini, Anthropic Claude (configurable)
- **Scheduling:** GitHub Actions (cron) + pm2 (local daemon)
- **Logging:** Pino

## Project structure

```
inpost/
├── src/
│   ├── commands/        # transform, publish, fetch, auth, schedule
│   ├── providers/       # notion, obsidian, onenote, evernote
│   ├── ai/              # provider adapters (groq, gemini, anthropic)
│   ├── linkedin/        # LinkedIn API client
│   └── utils/
├── dist/                # compiled output — never edit directly
├── .env                 # credentials — never commit
└── package.json
```

## CLI commands

```bash
inpost transform --notion-title "Post Title" -i --save
inpost publish --notion-title "Post Title" --dry-run
inpost publish --notion-title "Post Title"
inpost fetch --status Ready
inpost auth
inpost schedule
```

Provider shorthand flags: `-notion`, `-obsidian`, `-onenote`, `-evernote` (use with `-title` or `-id`)

## Transform tones

professional | casual | authority | storytelling | educational

Default is `professional` unless specified. The `-i` (interactive) flag enables the refinement loop.

## Notebook provider behaviour

- **Notion:** OAuth + API. Status field = "Ready" triggers publishing pipeline. After publish, writes LinkedIn URL back to the Notion page.
- **Obsidian:** Direct vault file read — no auth. Path configured in `.env`.
- **OneNote:** Microsoft Graph API. Token refresh handled automatically.
- **Evernote:** Developer token in `.env`. No OAuth flow.

## Scheduling

- **GitHub Actions:** `.github/workflows/publish.yml` — runs `0 11 * * 1` (Monday 11:00 UTC / winter London time). Reads `LINKEDIN_CREDENTIALS` from GitHub Secrets.
- **pm2 (local):** `pm2 start "node dist/src/index.js schedule" --name inpost`
- LinkedIn tokens expire ~60 days — set a calendar reminder to re-auth before expiry

## Code conventions

- TypeScript strict mode
- Commander.js for all CLI commands — do not add a second CLI framework
- Pino for logging — do not use console.log in production code paths
- All provider implementations follow the same interface — match the existing pattern in `src/providers/`
- AI provider adapters are swappable — the transform command does not care which provider is active
- Never hardcode API keys — all credentials via `.env`

## What not to do

- Do not edit files in `dist/` directly — always edit `src/` and build
- Do not add a new notebook provider without implementing the full provider interface
- Do not change the LinkedIn auth flow — tokens are fragile and re-auth is manual
- Do not commit `.env`, `credentials.json`, or `~/.inpost/credentials.json`
- Do not add a second scheduling mechanism — GitHub Actions and pm2 cover all cases
