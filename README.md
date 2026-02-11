# PostForge

Notion to LinkedIn publishing pipeline with AI-powered content transformation.

PostForge fetches blog posts from Notion, transforms them into LinkedIn-optimized content using AI, and publishes them via the LinkedIn API — all from the command line.

## Features

**Automated Pipeline**
- Fetch Notion pages marked "Ready"
- Convert Notion blocks to LinkedIn-compatible text
- Publish to LinkedIn via API
- Update Notion with LinkedIn URL + published status
- Log analytics and errors

**AI Content Transformation**
- Blog → LinkedIn summary
- Attention-grabbing hooks
- Tone rewriting (professional, casual, authority, storytelling, educational)
- Auto-generated hashtags
- Thread splitting for long content
- Multiple post variants

**Multi-Provider AI Support**
- **Groq** (recommended) — 14,400 free requests/day
- **Google Gemini** — Free tier available
- **Anthropic Claude** — Paid

## Prerequisites

- Node.js 20+
- A [Notion integration](docs/notion-setup.md) with database access
- A [LinkedIn Developer App](docs/linkedin-setup.md) for publishing
- An AI API key (Groq, Gemini, or Anthropic)

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env

# Build and link globally
npm run build
npm link

# Check your configuration
postforge status

# Authenticate with LinkedIn
postforge auth

# Transform content
postforge transform "Your blog content here"

# Transform with options
postforge transform "Your content" --tone casual --hashtags

# Publish to LinkedIn
postforge publish "Your LinkedIn post text"

# Full pipeline: fetch → transform → publish
postforge pipeline --dry-run
```

## Commands

| Command | Description |
|---------|-------------|
| `postforge transform [text]` | Transform content for LinkedIn |
| `postforge publish [text]` | Publish content to LinkedIn |
| `postforge pipeline` | Full pipeline: fetch → transform → publish |
| `postforge fetch` | Fetch posts from Notion by status |
| `postforge auth` | Authenticate with LinkedIn via OAuth |
| `postforge schedule` | Run pipeline on a cron schedule |
| `postforge status` | Check configuration and connection status |

### Transform

```bash
postforge transform "Your content here"
postforge transform --notion-id <id>
postforge transform --file ./post.txt

Options:
  -t, --tone <tone>     Tone (defaults to DEFAULT_TONE in .env)
  --variants <count>    Number of variants to generate
  --hooks               Generate attention-grabbing hooks
  --hashtags            Auto-generate hashtags
  --thread              Split into LinkedIn thread
  --save                Save result back to Notion (requires --notion-id)
  --json                Output as JSON
```

### Publish

```bash
postforge publish "Your LinkedIn post"
postforge publish --notion-id <id>

Options:
  --dry-run             Preview without posting
  --connections         Limit visibility to connections only
  --no-update-notion    Skip updating Notion after publishing
```

### Pipeline

```bash
postforge pipeline
postforge pipeline --dry-run

Options:
  --status <value>      Notion status to fetch (default: "Ready")
  --limit <number>      Maximum posts to process (default: 5)
  --tone <tone>         Default tone for AI transformation
  --hooks               Include hooks in generated content
  --hashtags            Include hashtags
  --dry-run             Run everything except actual LinkedIn publish
  --no-confirm          Skip confirmation prompts
```

## Configuration

### Environment Variables

```bash
# Required: Notion
NOTION_API_TOKEN=ntn_xxx
NOTION_DATABASE_ID=xxx-xxx-xxx

# Required: AI Provider (set at least one)
GROQ_API_KEY=gsk_xxx          # Recommended - best free tier
GEMINI_API_KEY=AIza_xxx       # Free tier available
ANTHROPIC_API_KEY=sk-ant-xxx  # Paid

# Required for publishing: LinkedIn
LINKEDIN_CLIENT_ID=xxx
LINKEDIN_CLIENT_SECRET=xxx

# Optional
DEFAULT_TONE=professional
LOG_LEVEL=info
SCHEDULE_CRON=0 9 * * 1-5
```

### AI Provider Priority

PostForge auto-selects the AI provider based on available keys:
1. **Groq** (if `GROQ_API_KEY` set) — Fastest, best free tier
2. **Gemini** (if `GEMINI_API_KEY` set) — Good free tier
3. **Anthropic** (if `ANTHROPIC_API_KEY` set) — Highest quality, paid

## Notion Database Setup

Your Notion database needs these properties:

| Property | Type | Purpose |
|----------|------|---------|
| Name | Title | Post title |
| Status | Select | Draft / Ready / Transforming / Publishing / Published / Error |
| LinkedIn URL | URL | Filled after publishing |
| Published Date | Date | Filled after publishing |
| Tone | Select | AI tone override per post |
| Tags | Multi-select | For hashtag generation |
| AI Summary | Rich text | AI-generated LinkedIn post |
| Variants | Rich text | Multiple post variants |
| Error Log | Rich text | Error details |

See [docs/notion-setup.md](docs/notion-setup.md) for full setup instructions.

## Development

```bash
npm run dev -- status          # Run in dev mode
npm test                       # Run unit tests
npm run test:watch             # Watch mode
npm run typecheck              # Type checking
npm run lint                   # Lint
```

## License

MIT
