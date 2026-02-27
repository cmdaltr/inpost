# Notion Setup Guide

## 1. Create a Notion Integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Name it "InPost"
4. Select your workspace
5. Under **Capabilities**, enable:
   - Read content
   - Update content
6. Click **Submit**
7. Copy the **Internal Integration Secret** (starts with `ntn_`)
8. Add it to your `.env` file as `NOTION_API_TOKEN`

## 2. Create the InPost Database

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
3. Search for and select your "InPost" integration
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

1. Write a post as a page in the InPost database
2. Set **Status** to `Ready`
3. Run `inpost pipeline` — transforms content and publishes to LinkedIn
4. Or use `inpost transform -i` for interactive refinement before publishing
5. InPost updates the page: Status → Published, adds LinkedIn URL and Published Date
6. **To make the post public in Notion:** Move the page from the database to under your public blog page. The `/sub-pages` block will show it automatically.

### Queuing posts for the scheduler

The scheduler picks up every page with **Status = Ready** when it fires. To queue a post:

1. Write your content in the InPost database
2. Set **Status** to `Ready` — that's it

To preview and refine the AI output before it goes live, use `transform` first:

```bash
# Generate, review interactively, save AI Summary — but don't publish yet
inpost transform --notion-title "My Post Title" -i --save
# Then set Status = Ready in Notion when satisfied
```

The scheduler will re-transform from the page body when it runs. If you want to lock in the version you approved, this re-transformation is the one limitation to be aware of.

## 7. Scheduler

Run the pipeline automatically on a recurring schedule:

```bash
# Start the scheduler (default: every Monday at 11:00 Europe/London)
inpost schedule

# Custom schedule
inpost schedule --cron "0 11 * * 1" --timezone "America/New_York"

# Test by running once immediately
inpost schedule --once
```

When the scheduler fires, it:

1. Fetches up to 5 pages with **Status = Ready**
2. Transforms each one with AI and saves the result to **AI Summary**
3. Publishes to LinkedIn
4. Updates the page: **Status → Published**, writes the LinkedIn URL and post ID

Failed posts are marked **Error** with a message in the **Error Log** field.

To keep the scheduler running persistently, use a process manager like `pm2`:

```bash
pm2 start "inpost schedule" --name inpost
pm2 save
```

```
InPost Database (private)        Public Blog Page
┌─────────────────────────┐         ┌─────────────────────┐
│ Draft Post 1            │         │ Blog                │
│ Draft Post 2            │         │ ├── Published Post  │
│ Ready Post   ──────────────────►  │ ├── Another Post    │
│ Published Post (move) ──────────► │ └── ...             │
└─────────────────────────┘         └─────────────────────┘
```

## 8. Test Your Setup

```bash
# Verify connection
inpost status

# Fetch ready posts
inpost fetch --status Ready

# Transform content interactively
inpost transform "Your blog content" -i
```
