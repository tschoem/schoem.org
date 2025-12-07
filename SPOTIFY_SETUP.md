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
