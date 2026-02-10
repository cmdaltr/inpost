# PostForge

Notion to LinkedIn publishing pipeline with AI-powered content transformation.

PostForge fetches blog posts from Notion, transforms them into LinkedIn-optimized content using Claude AI, and publishes them via the LinkedIn API — all from the command line.

## Features

**Automated Pipeline**
- Fetch Notion pages marked "Ready"
- Convert Notion blocks to LinkedIn-compatible text
- Publish to LinkedIn via API
- Update Notion with LinkedIn URL + published status
- Log analytics and errors

**AI Content Transformation** (powered by Claude)
- Blog → LinkedIn summary
- Attention-grabbing hooks
- Tone rewriting (professional, casual, authority, storytelling, educational)
- Auto-generated hashtags
- Best posting time suggestions
- Thread splitting for long content
- Multiple post variants

## Prerequisites

- Node.js 20+
- A [Notion integration](docs/notion-setup.md) with database access
- A [LinkedIn Developer App](docs/linkedin-setup.md) for publishing
- An [Anthropic API key](https://console.anthropic.com/) for AI features

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env

# Build
npm run build

# Check your configuration
npx postforge status

# Authenticate with LinkedIn
npx postforge auth

# Fetch ready posts from Notion
npx postforge fetch

# Transform content with AI
npx postforge transform --text "Your blog content here" --tone casual --hooks --hashtags

# Full pipeline: fetch → transform → publish
npx postforge pipeline --dry-run
```

## Commands

| Command | Description |
|---------|-------------|
| `postforge auth` | Authenticate with LinkedIn via OAuth |
| `postforge fetch` | Fetch posts from Notion by status |
| `postforge transform` | Transform content using Claude AI |
| `postforge publish` | Publish content to LinkedIn |
| `postforge pipeline` | Full pipeline: fetch → transform → publish |
| `postforge schedule` | Run pipeline on a cron schedule |
| `postforge status` | Check configuration and connection status |

### Transform Options

```bash
postforge transform [options]

--notion-id <id>    Fetch content from a Notion page
--text <string>     Provide text directly
--file <path>       Read content from a file
--tone <tone>       professional | casual | authority | storytelling | educational
--type <type>       summary | thread | hook | full
--variants <count>  Number of variants to generate
--hooks             Generate attention-grabbing hooks
--hashtags          Auto-generate hashtags
--thread            Split into LinkedIn thread
--timing            Suggest best posting time
--save              Save result back to Notion (requires --notion-id)
--output <format>   json | text
```

### Pipeline Options

```bash
postforge pipeline [options]

--status <value>    Notion status to fetch (default: "Ready")
--limit <number>    Maximum posts to process (default: 5)
--tone <tone>       Default tone for AI transformation
--hooks             Include hooks in generated content
--hashtags          Include hashtags
--dry-run           Run everything except actual LinkedIn publish
--confirm           Require confirmation before each publish (default)
--no-confirm        Skip confirmation prompts
```

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

## MCP Integration

PostForge can also be used alongside Claude Desktop with the Notion MCP server for interactive content creation. See [docs/mcp-setup.md](docs/mcp-setup.md).

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
