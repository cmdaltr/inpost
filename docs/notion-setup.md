# Notion Setup Guide

## 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Name it "PostForge"
4. Select your workspace
5. Under **Capabilities**, enable:
   - Read content
   - Update content
6. Click **Submit**
7. Copy the **Internal Integration Secret** (starts with `ntn_`)
8. Add it to your `.env` file as `NOTION_API_TOKEN`

## 2. Create the PostForge Database

Create a new database in Notion. This database stays **private** — do not share it publicly.

Add these properties (names are case-sensitive):

| Property | Type | Options |
|----------|------|---------|
| **Name** | Title | *(default)* |
| **Status** | Select | Draft, Ready, Transforming, Publishing, Published, Error, Archived |
| **Tone** | Select | professional, casual, authority, storytelling, educational |
| **Tags** | Multi-select | Your topic tags (e.g., AI, Leadership, Startups) |
| **LinkedIn URL** | URL | |
| **Published Date** | Date | |
| **AI Summary** | Text | |
| **Variants** | Text | |
| **Error Log** | Text | |
| **LinkedIn Post ID** | Text | |

## 3. Connect the Database to Your Integration

1. Open the database page in Notion
2. Click **⋯** (top right) → **Connections**
3. Search for and select your "PostForge" integration
4. Confirm access

## 4. Get the Database ID

1. Open the database in Notion (full page view)
2. Click **Share** → **Copy link**
3. The URL looks like: `https://www.notion.so/workspace/abc123def456?v=...`
4. The database ID is the string before the `?` (e.g., `abc123def456`)
5. Add it to your `.env` as `NOTION_DATABASE_ID`

## 5. Create a Public Blog Page (Optional)

If you want a public-facing blog in Notion alongside your LinkedIn posts:

1. Create a new page (e.g., "Blog") — separate from the database
2. Type `/sub-pages` and add a **Sub-pages** block
3. Click **Share** → **Share to web**

This page will automatically list any subpages you add to it.

## 6. Workflow

1. Write a post as a page in the PostForge database
2. Set **Status** to `Ready`
3. Run `postforge pipeline` — this transforms the content and publishes to LinkedIn
4. PostForge updates the page: Status → Published, adds LinkedIn URL and Published Date
5. **To make the post public in Notion:** Move the page from the database to under your public blog page. The `/sub-pages` block will show it automatically.

```
PostForge Database (private)        Public Blog Page
┌─────────────────────────┐         ┌─────────────────────┐
│ Draft Post 1            │         │ Blog                │
│ Draft Post 2            │         │ ├── Published Post  │
│ Ready Post   ──────────────────►  │ ├── Another Post    │
│ Published Post (move) ──────────► │ └── ...             │
└─────────────────────────┘         └─────────────────────┘
```

## 7. Test Your Setup

```bash
# Verify connection
npx postforge status

# Fetch ready posts
npx postforge fetch --status Ready
```
