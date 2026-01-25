# Thomas Schoemaecker - Personal Branding Website

A premium, interactive personal portfolio website built with React, Vite, and Node.js. This application showcases my professional journey, leadership philosophy, life map, and music collection with rich data integrations.

## Table of Contents
- [Features](#-features)
- [Tech Stack](#️-tech-stack)
- [Installation](#-installation)
- [Usage](#️-usage)
- [Mix Creator](#-mix-creator)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)

## 🚀 Features

*   **Home Dashboard**: A modern, responsive 2x2 grid layout providing quick access to all sections.
*   **CV / Resume**: Digital resume with downloadable PDF.
*   **Leadership**: Principles, influences, and "Guide to Thomas" philosophy.
*   **My Journey (Map)**: Interactive "Map of Life" using Leaflet to visualize my global journey.
*   **Music Collection**:
    *   **Data-Driven**: Automatically fetches vinyl collection from **Discogs** with full tracklists.
    *   **Spotify Integration**: Enriches albums with Spotify metadata for audio previews.
    *   **GetSongBPM Integration**: Enriches tracks with BPM, key, danceability, and energy data.
    *   **Interactive UI**: Sortable grid, filtering charts, and embedded player.
    *   **Mix Creator**: Create intelligent DJ mixes using Camelot key matching, BPM analysis, and energy levels. Share mixes via email with confirmation links.
*   **Contact**:
    *   **Enquiry Form**: Functional contact form powered by a localized Node.js backend.
    *   **SMTP Support**: Securely sends emails using Nodemailer.
    *   **Social Links**: Integrated icons for LinkedIn, Facebook, WhatsApp, Discogs, and Spotify.

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, Framer Motion (Animations), Leaflet (Maps), Recharts (Data Viz).
*   **Backend**: Node.js, Vercel Serverless Functions, Nodemailer (Email).
*   **Styling**: Custom CSS with responsive design and glassmorphism effects.
*   **Data**: JSON-based storage with automated fetch scripts.

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd personal_branding
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory with the following keys:

    ```env
    # Discogs API
    DISCOGS_TOKEN=your_discogs_token_here

    # Spotify API
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

    # GetSongBPM API (Optional - for track BPM, key, danceability)
    GETSONGBPM_API_KEY=your_getsongbpm_api_key

    # SMTP Configuration (For Contact Form and Mix Sharing)
    SMTP_HOST=smtp.gmail.com   # use your provider
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_app_password

    # Spotify Refresh Token (For Mix Creator - see GET_REFRESH_TOKEN.md)
    SPOTIFY_REFRESH_TOKEN=your_refresh_token_here

    # Redis (For Mix Confirmation on Vercel - see VERCEL_REDIS_SETUP.md)
    # Upstash Redis (recommended):
    UPSTASH_REDIS_REST_URL=your_upstash_url
    UPSTASH_REDIS_REST_TOKEN=your_upstash_token
    # OR Standard Redis:
    # REDIS_URL=redis://user:password@host:port

    # Security (Optional - defaults provided)
    ALLOWED_ORIGINS=https://schoem.org,https://www.schoem.org  # Comma-separated list for CORS
    ```

## 🏃‍♂️ Usage

### Development Mode
Run the frontend in development mode (Note: Email sending requires the backend server).
```bash
npm run dev
```

### Data Pipeline
Manually update the music collection data:
```bash
# 1. Fetch latest collection from Discogs (includes tracklists)
npm run fetch-discogs

# 2. Enrich tracks with GetSongBPM data (BPM, key, danceability)
npm run enrich-getsongbpm

# 3. Match albums to Spotify for previews
npm run enrich-spotify
```

### Production Deployment (Vercel)
This project is optimized for deployment on [Vercel](https://vercel.com).

1.  **Push to GitHub**: Connect your repository to Vercel.
2.  **Environment Variables**:
    In your Vercel Project Settings, add the following Environment Variables (same as your `.env`):
    *   `DISCOGS_TOKEN`
    *   `SPOTIFY_CLIENT_ID`
    *   `SPOTIFY_CLIENT_SECRET`
    *   `SPOTIFY_REFRESH_TOKEN` (for Mix Creator - see `GET_REFRESH_TOKEN.md`)
    *   `GETSONGBPM_API_KEY` (optional)
    *   `SMTP_HOST`
    *   `SMTP_PORT`
    *   `SMTP_USER`
    *   `SMTP_PASS`
    *   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (for Mix Confirmation - see `VERCEL_REDIS_SETUP.md`)
    *   `ALLOWED_ORIGINS` (optional - for CORS, defaults to localhost and schoem.org)
3.  **Deploy**: Vercel will automatically detect the Vite settings and the `/api` directory for serverless functions. Use the standard override build command:
    `npm run build`

### Legacy / Alternative Production
If you are NOT using Vercel, you can serve the static build and providing the API via the included Express server:
```bash
npm run build
node server.js
```

## 📁 Project Structure

*   `src/components`: React components for each page.
*   `src/styles`: CSS files for styling.
*   `src/data`: JSON data files (CV, Leadership, and fetched Music data).
*   `scripts`: Node.js scripts for fetching and enriching data.
*   `public`: Static assets (images, PDFs).
*   `api/`: Vercel Serverless Functions:
    *   `send-email.js`: Contact form email handler
    *   `share-mix.js`: Mix sharing email sender
    *   `confirm-mix.js`: Mix confirmation handler
    *   `mix-storage.js`: Redis storage abstraction
    *   `spotify-*.js`: Spotify API integration endpoints
*   `server.js`: Express backend (legacy/local alternative).

## 🎧 Mix Creator

The Mix Creator is an intelligent DJ mixing system that builds seamless playlists from your vinyl collection using professional DJ mixing principles.

### How It Works

1. **Select a Starting Track**: Choose any track from your collection as the seed for your mix
2. **Set Duration**: Choose how long you want your mix to be (30 minutes to 3+ hours)
3. **Build the Mix**: The system intelligently finds tracks that flow together
4. **Share**: Send the mix via email with a confirmation link to create the Spotify playlist

### The Mixing Algorithm

The Mix Creator uses a sophisticated scoring system based on professional DJ mixing principles:

#### Mixability Scoring (100 points total)

1. **Camelot Key Compatibility (40 points)**
   - **Perfect match**: Same Camelot key (e.g., both 6A) = 40 points
   - **Compatible keys**: Adjacent keys (±1 number, same letter) or relative major/minor (same number, opposite letter) = 30-35 points
   - **Loose mode**: Any key = 20 points
   - **Strict mode**: Only exact matches allowed

2. **BPM Compatibility (30 points)**
   - **Perfect match**: Within 50% of tolerance (e.g., ±4 BPM with 8 BPM tolerance) = 30 points
   - **Good match**: Within tolerance (e.g., ±8 BPM) = 20 points
   - **Acceptable**: Within 150% of tolerance = 10 points

3. **Danceability Similarity (15 points)**
   - Measures how suitable a track is for dancing (0-100 scale)
   - Similar danceability = 15 points
   - Acceptable difference = 10 points

4. **Acousticness Similarity (15 points)**
   - Measures how acoustic vs. electronic a track is (0-100 scale)
   - Similar acousticness = 15 points
   - Acceptable difference = 10 points

5. **Genre/Style Matching (30 points)**
   - Tracks from similar genres or styles = 30 points
   - Can be disabled for more diverse mixes

#### Progressive Relaxation

When building a mix, the algorithm uses **progressive relaxation** to ensure it can always find enough tracks:

1. **Level 0 (Strictest)**: Normal key matching, genre matching ON, ±5 BPM, 50% danceability/acousticness tolerance
2. **Level 1**: Relax danceability/acousticness to 100%
3. **Level 2**: Relax BPM to ±8
4. **Level 3**: Relax BPM to ±12
5. **Level 4**: Turn off genre matching
6. **Level 5 (Loosest)**: Loose key matching, no genre matching, ±12 BPM, 100% tolerances

The algorithm tries each level until it finds enough tracks to reach the target duration.

#### Key Features

- **One track per album**: Ensures variety by only including one track from each album
- **BPM drift prevention**: All tracks stay within the seed track's BPM tolerance to prevent tempo drift
- **Camelot wheel compatibility**: Uses the industry-standard Camelot wheel for harmonic mixing
- **Customizable settings**: Adjust key strictness, BPM tolerance, and other parameters
- **Email sharing**: Share mixes via email with full track details (BPM, key, duration)
- **Spotify integration**: Automatic playlist creation on confirmation

### Example Mix Flow

1. User selects "Blue Monday" by New Order (BPM: 123, Key: 6A)
2. System finds compatible tracks:
   - Same key (6A) or compatible keys (5A, 7A, 6B)
   - BPM within ±8 (115-131 BPM)
   - Similar danceability and acousticness
   - Optionally matching genre/style
3. Builds a chain of tracks, each scored for mixability
4. Continues until target duration is reached or no more compatible tracks found
5. If needed, progressively relaxes criteria to find more tracks

### Technical Details

- **Minimum mixability score**: 50/100 (configurable)
- **Maximum tracks**: 30 (configurable)
- **Key compatibility**: Uses Camelot wheel (1A-12A for minor, 1B-12B for major)
- **Data source**: GetSongBPM API for BPM, key, danceability, and acousticness data
- **Storage**: Redis (Vercel) or in-memory (local) for confirmation tokens

## 📚 Documentation

- `SPOTIFY_SETUP.md` - Complete guide for Spotify integration and Mix Creator
- `GET_REFRESH_TOKEN.md` - How to obtain and configure Spotify refresh token
- `VERCEL_REDIS_SETUP.md` - Setting up Redis for mix confirmation on Vercel
