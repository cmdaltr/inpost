# LinkedIn API Setup Guide

## 1. Create a LinkedIn Developer App

1. Go to [https://developer.linkedin.com/](https://developer.linkedin.com/)
2. Sign in with your LinkedIn account
3. Navigate to **My Apps** → **Create App**
4. Fill in:
   - **App name**: InPost (or your preferred name)
   - **LinkedIn Page**: Associate with your LinkedIn Page (you can create a test page if needed)
   - **Privacy policy URL**: Can use your website or a placeholder for testing
   - **App logo**: Optional
5. Click **Create app**

## 2. Request API Products

In your app dashboard, go to the **Products** tab and request:

- **Share on LinkedIn** — grants `w_member_social` scope (required for posting)
- **Sign In with LinkedIn using OpenID Connect** — grants `openid` and `email` scopes

Approval for "Share on LinkedIn" may require review. For personal/testing use, it is usually approved quickly.

## 3. Configure OAuth Redirect

1. Go to the **Auth** tab in your app settings
2. Under **OAuth 2.0 settings**, add this redirect URL:
   ```
   http://localhost:3456/callback
   ```
3. Copy your **Client ID** and **Client Secret**
4. Add them to your `.env` file:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```

## 4. Authenticate with InPost

Run the auth command:

```bash
inpost auth
```

This will:
1. Start a local server on port 3456
2. Open your browser to LinkedIn's authorization page
3. After you grant access, exchange the code for an access token
4. Store credentials securely in `~/.inpost/credentials.json`

## 5. Token Expiry

- LinkedIn access tokens expire after **60 days**
- InPost stores the expiry date and warns you via `inpost status`
- When the token expires, re-run `inpost auth`
- Standard LinkedIn apps do not support automatic token refresh

## 6. Verify Your Setup

```bash
# Check authentication status
inpost status

# Test with a dry run (does not actually post)
inpost publish "Hello from InPost!" --dry-run
```

## 7. Scopes Reference

| Scope | Purpose | Granted By |
|-------|---------|------------|
| `w_member_social` | Create posts on behalf of the member | Share on LinkedIn product |
| `openid` | OpenID Connect authentication | Sign In with LinkedIn product |
| `email` | Read member email address | Sign In with LinkedIn product |

## Troubleshooting

**"Application not authorized" error**
- Ensure "Share on LinkedIn" product is approved in your app's Products tab
- Check that `w_member_social` scope appears in your app's Auth tab

**"Invalid redirect URI" error**
- Verify `http://localhost:3456/callback` is listed in your app's redirect URLs
- The URL must match exactly (including port and path)

**Token expired**
- Run `inpost auth` again to get a new token
- Tokens last 60 days from issuance
