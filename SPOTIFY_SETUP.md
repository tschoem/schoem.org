# Spotify Integration Setup

## Overview
This guide explains how to enrich your vinyl collection with Spotify playback links.

## Prerequisites
- Spotify account (free or premium)
- ~5 minutes for setup

## Step 1: Get Spotify API Credentials

1. Go to https://developer.spotify.com/dashboard
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the form:
   - **App name**: Personal Vinyl Collection
   - **App description**: Portfolio website music player
   - **Redirect URIs**: `http://localhost:5173/`
   - **Which API/SDKs are you planning to use?**: Check "Web API"
5. Click **"Save"**
6. You'll see your **Client ID** and **Client Secret**

## Step 2: Set Environment Variables

In your terminal, export the credentials:

```bash
export SPOTIFY_CLIENT_ID="your_client_id_here"
export SPOTIFY_CLIENT_SECRET="your_client_secret_here"
```

## Step 3: Run the Enrichment Script

```bash
npm run enrich-spotify
```

This script will:
- ✅ Read your `discogsData.json`
- 🔍 Search Spotify for each album
- 💾 Add `spotify_id` and `spotify_uri` to each record
- 📊 Show you a summary of matched vs. not-found albums

## Step 4: Review Results

The script will print:
```
📊 Summary:
   Total records: 150
   ✅ Matched: 145
   ❌ Not found: 5

📝 Albums not found on Spotify:
   - Obscure Artist - Rare Album
   - ...
```

Albums not found on Spotify will still work (they just won't have a play button).

## Step 5: Rebuild and Test

```bash
npm run build
npm run preview
```

Visit the Music page and hover over album covers to see the green Spotify play button!

## How It Works

### Play Button
- Appears on hover for albums with Spotify data
- Green circle with play icon
- Click to open Spotify player modal

### Player Modal
- Embedded Spotify iframe
- Shows full album tracklist
- **30-second previews** available to all users
- **Full playback** requires Spotify Premium

### Privacy
The Spotify iframe loads third-party content from `open.spotify.com`. Users who click play buttons accept Spotify's terms.

## Troubleshooting

### "Missing Spotify credentials" Error
Make sure you've exported both `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` environment variables.

### "Album not found" for Many Records
- The script searches: `artist:ARTIST album:TITLE`
- If artist/title don't match Spotify's database exactly, it won't find them
- Common issues: Different artist names, special characters, reissues

### Play Button Not Showing
- Make sure the album has `spotify_id` in `discogsData.json`
- Check browser console for errors
- Ensure you rebuilt after running the enrichment script

## Re-running the Script

The script is smart:
- ✅ Skips albums that already have `spotify_id`
- 🔄 Only searches for albums that need enrichment
- Safe to run multiple times

If you want to force re-enrichment, manually delete `spotify_id` fields from `discogsData.json` first.

## Rate Limiting

The script waits 100ms between each Spotify API request to be respectful of their rate limits. A 200-album collection will take about 20-30 seconds to process.

## Questions?

Check the [Spotify Web API docs](https://developer.spotify.com/documentation/web-api)

---

# Creating Playlists and Mixes

## Overview
You can now create Spotify playlists (mixes) from your vinyl collection! The system supports:
- **Theme-based mixes**: Party, Upbeat, Classical, French, Chill, Jazz, Reggae, Rock, Latin
- **Custom mixes**: Create from your current filtered selection
- **Automatic track selection**: All tracks from matching albums are included
- **Playlist saving**: Mixes are saved directly to your Spotify account

## Prerequisites
- Spotify account (free or premium)
- Completed the basic Spotify setup above
- Your app must have the correct redirect URI configured

## Step 1: Update Spotify App Settings

**⚠️ CRITICAL: Spotify Security Requirements for Redirect URIs**

**UPDATE 2024/2025**: Spotify has **deprecated** `http://localhost` and now **requires** `http://127.0.0.1` for local development.

Spotify has strict requirements:
- **Local development**: Must use `http://127.0.0.1` (NOT `http://localhost` - this is deprecated)
- **Production**: Must use `https://` (SSL/TLS required)
- **Exact match**: The URI must match EXACTLY (case-sensitive, no trailing slashes)

1. Go to https://developer.spotify.com/dashboard
2. Click on your app
3. Click **"Edit Settings"**
4. In the **"Redirect URIs"** section, add these URIs (one per line):
   
   **For local development (http://127.0.0.1 required):**
   - If using Vite dev server only: `http://127.0.0.1:5173/api/spotify-callback`
   - If using Express server (port 3001): `http://127.0.0.1:3001/api/spotify-callback`
   
   **For production (https:// required):**
   - `https://yourdomain.com/api/spotify-callback` (replace with your actual domain)
   - Must be a valid HTTPS URL with SSL certificate
   
5. Click **"Add"** after each URI
6. Click **"Save"** at the bottom

**Common mistakes that Spotify will reject:**
- ❌ `http://localhost:5173/api/spotify-callback` (deprecated - use 127.0.0.1 instead)
- ❌ `http://192.168.1.100:5173/api/spotify-callback` (other IPs not allowed)
- ❌ `http://yourdomain.com/api/spotify-callback` (production without https)
- ❌ `http://127.0.0.1:5173/api/spotify-callback/` (trailing slash)
- ❌ `http://127.0.0.1:5173/Api/spotify-callback` (wrong case)
- ✅ `http://127.0.0.1:5173/api/spotify-callback` (correct for local)
- ✅ `https://yourdomain.com/api/spotify-callback` (correct for production)

## Step 2: Set Environment Variables

**For local development:**

If you're using the Express server (recommended for local testing):
```bash
export SPOTIFY_REDIRECT_URI="http://127.0.0.1:3001/api/spotify-callback"
```

If you're using Vite dev server only:
```bash
export SPOTIFY_REDIRECT_URI="http://127.0.0.1:5173/api/spotify-callback"
```

**Note**: Spotify has deprecated `http://localhost` - you must use `http://127.0.0.1` instead.

**For production (Vercel):**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add `SPOTIFY_REDIRECT_URI` with your production URL:
   - Value: `https://yourdomain.com/api/spotify-callback`
   - Environment: Production (and Preview if you want)

**Troubleshooting Redirect URI Errors:**

If you see `INVALID_CLIENT: Invalid redirect URI`:
1. Check the console logs - it will show what redirect URI is being used
2. Verify the URI in your code matches EXACTLY what's in Spotify dashboard
3. Make sure there are no trailing slashes or extra characters
4. Wait a few minutes after saving in Spotify dashboard (caching)

## Step 3: Use the Mix Creator

1. Visit the Music page on your site
2. Click the **"Create Mix"** button in the header
3. Connect to Spotify (first time only)
4. Choose a theme or create a custom mix
5. Click **"Create Mix"**
6. Your playlist will be created and saved to your Spotify account!

## How It Works

### Theme-Based Mixes
Each theme filters your collection by:
- **Genres**: Rock, Jazz, Electronic, etc.
- **Styles**: Disco, Trip Hop, Chanson, etc.
- **Popularity**: Some themes filter by Spotify popularity scores
- **Artists**: Some themes target specific artists (e.g., French theme)

### Custom Mixes
- Uses your currently filtered/viewed records
- Perfect for creating mixes from specific years, genres, or styles you've filtered
- All tracks from selected albums are included

### Track Selection
- All tracks from matching albums are included
- Tracks are shuffled for variety
- Only albums with Spotify IDs are included

### Playlist Details
- Playlists are created as **private** by default
- Name includes the theme and date
- Description includes mix details
- Direct link to open in Spotify

## API Endpoints

The system uses these serverless functions (in `/api`):
- `spotify-auth.js` - Initiates OAuth flow
- `spotify-callback.js` - Handles OAuth callback
- `spotify-create-playlist.js` - Creates playlist and adds tracks
- `spotify-get-tracks.js` - Fetches tracks from albums

## Troubleshooting

### "Please connect to Spotify first"
- Click "Connect to Spotify" button
- Authorize the app when redirected
- Make sure redirect URI matches your app settings

### "Failed to create playlist"
- Check that your Spotify account is active
- Verify you have playlist creation permissions
- Check browser console for detailed errors

### "No records match this theme"
- Try a different theme
- Some themes may have strict filters
- Use "Custom Mix" to create from your current selection

### Redirect URI Mismatch
- Ensure redirect URI in Spotify dashboard matches exactly
- Check environment variable `SPOTIFY_REDIRECT_URI`
- For local dev: `http://localhost:5173/api/spotify-callback`
- For production: `https://yourdomain.com/api/spotify-callback`

## Security Notes

- Access tokens are stored in browser localStorage
- Tokens expire after 1 hour (Spotify default)
- Users must re-authenticate when tokens expire
- Playlists are created as private by default

## Future Enhancements

Potential improvements:
- Refresh token support for longer sessions
- Mix length/duration options
- Track limit options
- Mix preview before creation
- Save mix templates
