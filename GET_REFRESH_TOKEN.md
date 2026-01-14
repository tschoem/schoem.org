# How to Get Your Spotify Refresh Token

## Overview
The refresh token allows your app to create playlists automatically without requiring user authentication each time. You only need to get it once.

## Method 1: Get Refresh Token from OAuth Flow (Recommended)

### Step 1: Authenticate via Your App

1. Make sure your Spotify app is set up with the correct redirect URI
2. Start your development server:
   ```bash
   npm run dev
   ```
3. Navigate to your Music page
4. Click **"Create Mix"** button
5. Click **"Connect to Spotify"**
6. Authorize the app when redirected to Spotify

### Step 2: Extract Refresh Token from URL

After authorization, you'll be redirected back to your app with tokens in the URL. The URL will look like:

```
http://127.0.0.1:5173/music?spotify_auth=success&access_token=...&refresh_token=YOUR_REFRESH_TOKEN_HERE&expires_in=3600
```

**Copy the `refresh_token` value from the URL** (it's the long string after `refresh_token=`)

### Step 3: Add to Environment Variables

**For local development:**
```bash
export SPOTIFY_REFRESH_TOKEN="your_refresh_token_here"
```

**For production (Vercel):**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add:
   - **Name**: `SPOTIFY_REFRESH_TOKEN`
   - **Value**: Your refresh token (paste it here)
   - **Environment**: Production (and Preview if needed)
4. Click **Save**

## Method 2: Get Refresh Token via Direct OAuth (Alternative)

If you prefer to get the token directly without using the app:

### Step 1: Build the Authorization URL

Replace `YOUR_CLIENT_ID` and `YOUR_REDIRECT_URI`:

```
https://accounts.spotify.com/authorize?
  client_id=YOUR_CLIENT_ID&
  response_type=code&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=playlist-modify-public playlist-modify-private&
  state=random_string
```

### Step 2: Authorize and Get Code

1. Open the URL in your browser
2. Log in and authorize
3. You'll be redirected to your redirect URI with a `code` parameter
4. Copy the `code` value from the URL

### Step 3: Exchange Code for Tokens

Use curl or Postman to exchange the code for tokens:

```bash
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE_FROM_STEP_2" \
  -d "redirect_uri=YOUR_REDIRECT_URI"
```

The response will include both `access_token` and `refresh_token`. Copy the `refresh_token`.

## Method 3: Extract from Browser Console (Quick Method)

If you've already authenticated:

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for logs from the OAuth callback - it may log the refresh token
4. Or check the **Network** tab for the redirect response

## Verify Your Refresh Token Works

Test that your refresh token is working:

```bash
# Test the token endpoint
curl http://localhost:3000/api/spotify-get-token
```

Or visit: `http://localhost:3000/api/spotify-get-token` in your browser

If configured correctly, you should get a JSON response with an `access_token`.

## Important Notes

- **Refresh tokens don't expire** (unless revoked)
- **Keep it secret** - treat it like a password
- **One-time setup** - you only need to do this once
- **If you lose it** - just re-authenticate and get a new one

## Troubleshooting

### "No refresh token in URL"
- Make sure you're requesting the correct scopes
- Check that your redirect URI matches exactly
- Try clearing browser cache and re-authenticating

### "Invalid refresh token"
- The token may have been revoked
- Re-authenticate to get a new refresh token
- Make sure you copied the entire token (they're quite long)

### "Token works locally but not in production"
- Make sure you added `SPOTIFY_REFRESH_TOKEN` to Vercel environment variables
- Redeploy your app after adding the environment variable
- Check that the variable name matches exactly (case-sensitive)
