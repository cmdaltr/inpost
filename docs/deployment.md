# Running the Scheduler

`inpost schedule` is a long-running process. It must be running at the scheduled time every Monday for posts to publish. This document covers three ways to keep it alive.

---

## Using InPost on your own account

InPost is designed to be self-hosted. The workflow file and code are generic — they contain no credentials and no user-specific configuration. Anyone can run InPost against their own Notion workspace and LinkedIn account.

### If someone else wants to use InPost

1. **Fork or clone the repository** to their own GitHub account
2. **Set up Notion** — follow `docs/notion-setup.md` to create their own InPost database and integration
3. **Set up LinkedIn** — follow `docs/linkedin-setup.md` and run `inpost auth` locally to generate credentials
4. **Add their own secrets** — under Settings → Secrets on their fork, using their own API keys and credentials
5. **Enable Actions** — GitHub sometimes disables Actions on forks by default; enable under **Settings → Actions → Allow all actions**

The schedule workflow is already in the repo. Once secrets are in place, it will run automatically against their accounts.

### What each person needs

Every user supplies their own:

| Secret | What it is |
|---|---|
| `NOTION_API_TOKEN` | Their Notion integration token |
| `NOTION_DATABASE_ID` | Their InPost database ID |
| `LINKEDIN_CREDENTIALS` | Their LinkedIn OAuth credentials (from `inpost auth`) |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` | Their AI provider key |

Nothing is shared between users. Each fork is fully independent.

### Costs

InPost itself is free and open source. Running it does involve third-party services, each with their own pricing.

| Service | Free tier | Cost beyond free |
|---|---|---|
| **GitHub Actions** | 2,000 minutes/month (private repo), unlimited (public) | $0.008/min (Ubuntu) |
| **Notion API** | Free for personal use | Paid plans for larger teams |
| **LinkedIn API** | Free | Free |
| **Anthropic (Claude)** | None — pay per use | ~$0.003 per post (Sonnet) |
| **Google (Gemini)** | 15 requests/min, 1,500/day | Paid tiers available |
| **Groq** | Free tier available | Paid tiers available |

**In practice, the weekly schedule costs almost nothing:**

- GitHub Actions: ~104 minutes/year — well within the free tier for private repos, free for public repos
- AI per post: one `schedule --once` run transforms and publishes up to 5 posts. At Claude Sonnet rates, that is fractions of a cent per post
- Notion and LinkedIn: free

The only meaningful ongoing cost is your AI provider key if you use Anthropic. Gemini and Groq both have free tiers that comfortably cover one post per week.

---

## Option 1 — macOS launchd (recommended for Mac users)

launchd is macOS's built-in service manager. It starts the process on login, keeps it running in the background without a terminal, and restarts it automatically if it crashes.

A pre-built plist is included at `deploy/com.inpost.schedule.plist`.

### Setup

**1. Build the project**

```bash
npm run build
```

**2. Edit the plist**

Open `deploy/com.inpost.schedule.plist` and replace every `YOURUSERNAME` and path placeholder with your actual values.

Find your node path:
```bash
which node
```

Find your project path:
```bash
pwd
# Run this from the inpost directory
```

The three values to update:
- `ProgramArguments[0]` → absolute path to `node` (e.g. `/opt/homebrew/bin/node`)
- `ProgramArguments[1]` → absolute path to `dist/src/index.js` inside the repo
- `WorkingDirectory` → absolute path to the repo root (so `.env` is found)
- `StandardOutPath` / `StandardErrorPath` → update `YOURUSERNAME` to your macOS username

**3. Copy to LaunchAgents and load**

```bash
cp deploy/com.inpost.schedule.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.inpost.schedule.plist
```

The scheduler is now running. It will start automatically on every login.

### Managing the service

```bash
# Check if it's running
launchctl list | grep inpost

# View logs
tail -f ~/Library/Logs/inpost.log
tail -f ~/Library/Logs/inpost.error.log

# Stop the scheduler
launchctl unload ~/Library/LaunchAgents/com.inpost.schedule.plist

# Restart after a config or code change
launchctl unload ~/Library/LaunchAgents/com.inpost.schedule.plist
npm run build
launchctl load ~/Library/LaunchAgents/com.inpost.schedule.plist
```

### Notes

- The Mac must be awake at the scheduled time on Monday. launchd cannot wake a sleeping Mac.
- If the Mac is asleep at the scheduled time, that run is skipped entirely — node-cron does not catch up on missed runs.
- To prevent the Mac sleeping at the critical time, set an Energy Saver schedule in **System Settings → Battery → Schedule**.

---

## Option 2 — pm2 on a server (untested)

> **These instructions are untested.** They describe the expected steps for a Linux VPS running Node.js ≥ 20.

pm2 is a Node.js process manager that keeps processes alive and restarts them on reboot.

```bash
# Install pm2 globally
npm install -g pm2

# Copy the project to the server, install dependencies, and build
npm install
npm run build

# Start the scheduler
pm2 start "node dist/src/index.js schedule" --name inpost

# Save the process list so it survives reboots
pm2 save

# Generate and enable the startup hook for your OS
pm2 startup
# Follow the printed instruction (it will give you a sudo command to run)
```

Managing the service:

```bash
pm2 status
pm2 logs inpost
pm2 restart inpost
pm2 stop inpost
pm2 delete inpost
```

The `.env` file must exist in the directory you run the commands from, or set the environment variables directly on the server.

---

## Option 3 — GitHub Actions cron (untested)

> **These instructions are untested.** They describe the expected steps based on how InPost works and how GitHub Actions works. Treat this as a starting point, not a guaranteed working recipe.

### How it works

Instead of a persistent process, GitHub Actions spins up a fresh Ubuntu runner on a cron schedule, runs `inpost schedule --once`, and shuts down. No server, no process manager, nothing to keep alive.

There are two separate pieces:

**The workflow file** (`.github/workflows/schedule.yml`) is committed to your repository. It contains no credentials — only instructions and references to named secrets using `${{ secrets.SECRET_NAME }}` placeholders. It is safe to commit publicly.

**GitHub Secrets** are stored separately on GitHub's servers under your repository's Settings. They are never written to your git history and never visible in logs. GitHub injects them into the runner as environment variables at the moment the job runs.

To activate the workflow, you need to do both: commit the workflow file, and add the secrets through the GitHub UI. Neither works without the other.

### Cost

**For most users: free.**

GitHub Actions usage for this workflow:

| | Free tier (private repo) | Public repo |
|---|---|---|
| Minutes included | 2,000 / month | Unlimited |
| Estimated per run | ~2 minutes (install + build + run) | ~2 minutes |
| Runs per year | 52 (once a week) | 52 |
| **Total / year** | **~104 minutes** | **Free** |

104 minutes per year is well under the 2,000 minute monthly free allowance. In practice you are unlikely to incur any cost.

If you exceed the free tier, additional minutes are billed at $0.008 per minute (Ubuntu runner). At 52 runs/year that would only happen if your workflow consistently ran for longer than ~38 minutes per run, which is not realistic.

---

### Prerequisites

- The InPost repository must be on GitHub (public or private)
- You must have already run `inpost auth` locally at least once — this creates `~/.inpost/credentials.json`

---

### Understanding the LinkedIn credential problem

InPost stores LinkedIn credentials in a local file at `~/.inpost/credentials.json`, not in environment variables. A GitHub Actions runner has no access to your local filesystem, so you need to store the contents of that file as a GitHub secret and reconstruct the file in the workflow before InPost runs.

The `credentials.json` file looks like this:

```json
{
  "accessToken": "AQV...",
  "expiresAt": "2026-04-28T11:00:00.000Z",
  "personUrn": "urn:li:person:abc123",
  "createdAt": "2026-02-27T11:00:00.000Z"
}
```

**LinkedIn access tokens expire after approximately 60 days.** There is no refresh token. When a token expires, you must re-run `inpost auth` locally and update the GitHub secret with the new credentials. If you forget, the workflow will fail with an authentication error and no posts will be published.

---

### Setup

#### Step 1 — Copy your LinkedIn credentials

On your local machine, after running `inpost auth`:

```bash
cat ~/.inpost/credentials.json
```

Copy the entire JSON output. You will paste this as a secret in the next step.

#### Step 2 — Add secrets to GitHub

In your GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**.

Add the following secrets:

| Secret name | Required | Where to find the value |
|---|---|---|
| `NOTION_API_TOKEN` | Yes | Your `.env` file |
| `NOTION_DATABASE_ID` | Yes | Your `.env` file |
| `LINKEDIN_CREDENTIALS` | Yes | Full JSON from `~/.inpost/credentials.json` (Step 1) |
| `ANTHROPIC_API_KEY` | One of these three | Your `.env` file |
| `GEMINI_API_KEY` | One of these three | Your `.env` file |
| `GROQ_API_KEY` | One of these three | Your `.env` file |
| `DEFAULT_TONE` | No — defaults to `professional` | Your `.env` file |
| `LOG_LEVEL` | No — defaults to `info` | Your `.env` file |
| `SCHEDULE_CRON` | No — defaults to `30 9 * * 1` | Your `.env` file |
| `SCHEDULE_TIMEZONE` | No — defaults to `Europe/London` | Your `.env` file |
| `SCHEDULE_LIMIT` | No — defaults to `1` | Your `.env` file |

Only add the AI key for the provider you actually use. You do not need all three.

**What you do NOT need to add** — these are only used by `inpost auth` to generate credentials and are not needed once `~/.inpost/credentials.json` exists:
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`

#### Step 3 — Create the workflow file

Create the directory and file:

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/schedule.yml` with the following content:

```yaml
name: Publish scheduled posts

on:
  # Runs every Monday.
  # GitHub Actions cron is always UTC.
  #
  # Europe/London (GMT) in winter:  09:30 UTC = 09:30 London  ✓
  # Europe/London (BST) in summer:  09:30 UTC = 10:30 London  (1 hour late)
  #
  # To hit 09:30 London all year you would need two schedules,
  # or accept the summer offset. See the timezone note below.
  schedule:
    - cron: '30 9 * * 1'

  # Allows you to trigger the workflow manually from the Actions tab.
  # Useful for testing or catching up on a missed run.
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Restore LinkedIn credentials
        # Writes the credentials JSON to the path InPost expects.
        # The runner's home directory (~) is /home/runner.
        run: |
          mkdir -p ~/.inpost
          echo '${{ secrets.LINKEDIN_CREDENTIALS }}' > ~/.inpost/credentials.json
          chmod 600 ~/.inpost/credentials.json

      - name: Run pipeline
        run: node dist/src/index.js schedule --once
        env:
          NOTION_API_TOKEN: ${{ secrets.NOTION_API_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          DEFAULT_TONE: ${{ secrets.DEFAULT_TONE }}
          LOG_LEVEL: ${{ secrets.LOG_LEVEL }}
```

#### Step 4 — Commit and push

```bash
git add .github/workflows/schedule.yml
git commit -m "Add GitHub Actions publish schedule"
git push
```

#### Step 5 — Verify the workflow appears

In GitHub, go to **Actions**. You should see "Publish scheduled posts" listed. It will not run until the next Monday at 09:30 UTC.

To test it immediately without waiting: go to **Actions → Publish scheduled posts → Run workflow → Run workflow**.

---

### Monitoring

**Viewing run results:**
Go to **Actions → Publish scheduled posts** — each run shows as a pass or fail with full logs.

**If a run fails:**
The most likely causes are:
1. LinkedIn token expired — re-run `inpost auth` locally, copy the new `credentials.json`, and update the `LINKEDIN_CREDENTIALS` secret
2. No posts with Status = Ready — not an error, just nothing to do
3. API rate limit or network error — usually self-resolving; re-trigger manually if needed

**Email notifications:**
GitHub sends an email when a scheduled workflow fails. You can configure this in **Settings → Notifications**.

---

### Timezone note

GitHub Actions cron runs in UTC. There is no timezone option.

| Season | London time | UTC equivalent |
|---|---|---|
| Winter (GMT, late Oct – late Mar) | 09:30 | `30 9 * * 1` |
| Summer (BST, late Mar – late Oct) | 09:30 | `30 8 * * 1` |

The workflow above uses `30 9 * * 1` (09:30 UTC). This means:
- In winter your post goes out at 09:30 London time — correct
- In summer your post goes out at 10:30 London time — one hour late

If the exact time matters, you can add both schedules and use an environment variable or a conditional step to prevent double-publishing. In practice, a one-hour seasonal drift is unlikely to matter for LinkedIn posting.

---

### Keeping LinkedIn credentials fresh

LinkedIn access tokens last approximately 60 days. There is no automatic refresh.

When a token expires the workflow will fail with an authentication error. To renew:

```bash
# Re-authenticate locally
inpost auth

# Copy the new credentials
cat ~/.inpost/credentials.json
```

Then update the `LINKEDIN_CREDENTIALS` secret in GitHub with the new JSON.

Set a reminder in your calendar for every 50 days to stay ahead of expiry.
