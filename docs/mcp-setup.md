# MCP Setup Guide

InPost includes an MCP (Model Context Protocol) configuration for using Claude Desktop with Notion interactively. This is complementary to the CLI pipeline — the MCP workflow enables conversational content creation, while the CLI automates the publishing pipeline.

## Option 1: Notion's Hosted MCP (Recommended)

Notion provides a hosted remote MCP server that requires no local setup.

### Claude Desktop

1. Open Claude Desktop → **Settings** → **Connectors**
2. Click **Add** and search for **Notion**
3. Authorize access to your Notion workspace
4. You can now ask Claude to read and interact with your Notion pages

### Claude Code CLI

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
```

## Option 2: Local MCP Server

Run the Notion MCP server locally via npx.

### Claude Desktop Configuration

Add the following to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_NOTION_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
      }
    }
  }
}
```

Replace `YOUR_NOTION_TOKEN` with your Notion integration token (the same `NOTION_API_TOKEN` from your `.env`).

### Claude Code CLI

```bash
claude mcp add notion -- npx -y @notionhq/notion-mcp-server \
  --env OPENAPI_MCP_HEADERS='{"Authorization": "Bearer YOUR_NOTION_TOKEN", "Notion-Version": "2022-06-28"}'
```

## MCP Workflow

Once configured, you can use Claude Desktop to:

1. **Read blog posts**: "Show me all blog posts marked Ready in my Notion database"
2. **Generate LinkedIn content**: "Turn this blog post into a LinkedIn post in a casual tone"
3. **Create hooks**: "Generate 5 hook options for this blog post"
4. **Generate hashtags**: "Suggest hashtags for this content"
5. **Create threads**: "Split this blog post into a LinkedIn thread"
6. **Rewrite tone**: "Rewrite this in a more authoritative tone"

You can then copy the generated content into InPost for publishing:

```bash
inpost publish "Your generated LinkedIn post"
```

Or paste it directly into LinkedIn.

## Alternative: Interactive Mode

InPost now includes a built-in interactive mode that provides similar refinement capabilities without needing MCP:

```bash
inpost transform "Your content" -i
```

This lets you:
- View the generated post
- Provide feedback (e.g., "make it shorter", "more casual")
- Regenerate or accept the result

## Combining MCP + CLI

The recommended workflow combines both:

1. Use Claude Desktop + MCP **or** `inpost transform -i` for **interactive content refinement**
2. Use the InPost CLI for **automated batch processing** (pipeline mode for multiple posts)
3. Use `inpost transform --save` to persist AI-generated content back to Notion

This gives you the best of both worlds: conversational creativity and pipeline automation.
