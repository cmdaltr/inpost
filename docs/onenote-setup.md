# OneNote Setup Guide

OneNote requires a one-time Azure AD app registration and an OAuth authentication step.

## 1. Register an Azure AD App

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory → App registrations → New registration**
2. Name: **InPost**
3. Supported account types: **Personal Microsoft accounts only**
4. Redirect URI: `http://localhost:3456/callback`
5. Click **Register**

## 2. Configure API Permissions

1. In your new app, go to **API permissions → Add a permission**
2. Select **Microsoft Graph → Delegated permissions**
3. Search for and add `Notes.ReadWrite.All`
4. Click **Grant admin consent** if prompted

## 3. Create a Client Secret

1. Go to **Certificates & secrets → New client secret**
2. Set a description (e.g., "InPost") and an expiry
3. Copy the **Value** immediately — it is only shown once

## 4. Copy Your App Credentials

From the app **Overview** page, copy:
- **Application (client) ID**
- **Directory (tenant) ID** — use `consumers` for personal Microsoft accounts

## 5. Configure `.env`

```bash
ONENOTE_CLIENT_ID=your-application-client-id
ONENOTE_CLIENT_SECRET=your-client-secret-value
ONENOTE_TENANT_ID=consumers          # use "consumers" for personal Microsoft accounts
ONENOTE_REDIRECT_URI=http://localhost:3456/callback
```

## 6. Authenticate

Run the OAuth flow once. A browser will open — sign in and approve access. Credentials are saved to `~/.inpost/onenote-credentials.json`.

```bash
inpost auth --onenote
```

## 7. Verify

```bash
inpost status --onenote
```

## 8. Usage

```bash
# By page title
inpost transform --onenote-title "How to Use Volatility3" -i --save

# By page ID (from the Graph API or OneNote web URL)
inpost transform --onenote-id "1-abc123..." -i --save

# Or use the provider shorthand
inpost transform --onenote --title "How to Use Volatility3" -i --save

# Publish
inpost publish --onenote-title "How to Use Volatility3"
```

## 9. How `--save` Works

`--save` appends the AI summary as a new section at the bottom of the OneNote page using the Microsoft Graph API PATCH endpoint.

## 10. Token Refresh

Access tokens refresh automatically via the stored refresh token. If authentication fails (e.g., after a long period of inactivity), re-run:

```bash
inpost auth --onenote
```

## 11. Set as Default Notebook

```bash
DEFAULT_NOTEBOOK=onenote
```

Then `inpost status`, `inpost transform --title "..."`, etc. all default to OneNote.
