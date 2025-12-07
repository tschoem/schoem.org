# Thomas Schoemaecker - Personal Branding Website

A premium, interactive personal portfolio website built with React, Vite, and Node.js. This application showcases my professional journey, leadership philosophy, life map, and music collection with rich data integrations.

## 🚀 Features

*   **Home Dashboard**: A modern, responsive 2x2 grid layout providing quick access to all sections.
*   **CV / Resume**: Digital resume with downloadable PDF.
*   **Leadership**: Principles, influences, and "Guide to Thomas" philosophy.
*   **My Journey (Map)**: Interactive "Map of Life" using Leaflet to visualize my global journey.
*   **Music Collection**:
    *   **Data-Driven**: Automatically fetches vinyl collection from **Discogs**.
    *   **Spotify Integration**: Enriches albums with Spotify metadata for audio previews.
    *   **Interactive UI**: Sortable grid, filtering charts, and embedded player.
*   **Contact**:
    *   **Enquiry Form**: Functional contact form powered by a localized Node.js backend.
    *   **SMTP Support**: Securely sends emails using Nodemailer.
    *   **Social Links**: Integrated icons for LinkedIn, Facebook, WhatsApp, Discogs, and Spotify.

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, Framer Motion (Animations), Leaflet (Maps), Recharts (Data Viz).
*   **Backend**: Node.js, Express (Server), Nodemailer (Email).
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

    # SMTP Configuration (For Contact Form)
    SMTP_HOST=smtp.gmail.com   # user your provider
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_app_password
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
# Fetch latest collection from Discogs
npm run fetch-discogs

# Match albums to Spotify for previews
npm run enrich-spotify
```

### Production Build & Deployment
The build command automatically chains the data fetching scripts to ensure the site is always fresh when deployed.

1.  **Build the application**:
    ```bash
    npm run build
    ```
    *This executes: `fetch-discogs` -> `enrich-spotify` -> `vite build`*

2.  **Start the Production Server**:
    To serve the static site AND handle email API requests:
    ```bash
    node server.js
    ```

## 📁 Project Structure

*   `src/components`: React components for each page.
*   `src/styles`: CSS files for styling.
*   `src/data`: JSON data files (CV, Leadership, and fetched Music data).
*   `scripts`: Node.js scripts for fetching and enriching data.
*   `public`: Static assets (images).
*   `server.js`: Express backend for serving the app and handling emails.
