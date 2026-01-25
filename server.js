
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug: Check if env vars are loaded
console.log('--- Environment Check ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST ? 'Set' : 'MISSING');
console.log('SMTP_PORT:', process.env.SMTP_PORT ? 'Set' : 'MISSING');
console.log('SMTP_USER:', process.env.SMTP_USER ? 'Set' : 'MISSING');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? 'Set' : 'MISSING');
console.log('-------------------------');

// CORS configuration - restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Request body size limit
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many email requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes
// Spotify OAuth routes (for local development - Vercel uses serverless functions)
app.get('/api/spotify-auth', async (req, res) => {
  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;

  // Determine redirect URI - must match exactly what's in Spotify app settings
  // Spotify requires: http://127.0.0.1 (for local dev) or https:// (for production)
  // Note: Spotify has deprecated http://localhost - use 127.0.0.1 instead
  let REDIRECT_URI;
  if (process.env.SPOTIFY_REDIRECT_URI) {
    REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
  } else {
    // For local dev with Express server on port 3001
    // Spotify now requires 127.0.0.1 instead of localhost
    REDIRECT_URI = `http://127.0.0.1:3001/api/spotify-callback`;
  }

  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify Client ID not configured' });
  }

  // Log the redirect URI for debugging
  console.log('Spotify Auth - Redirect URI:', REDIRECT_URI);

  const scopes = [
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-email',
    'user-read-private'
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?` +
    `client_id=${SPOTIFY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${req.query.state || 'default'}`;

  return res.redirect(authUrl);
});

app.get('/api/spotify-callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`/?error=${encodeURIComponent('No authorization code received')}`);
  }

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

  // Determine redirect URI - must match exactly what's in Spotify app settings
  // Spotify requires: http://127.0.0.1 (for local dev) or https:// (for production)
  // Note: Spotify has deprecated http://localhost - use 127.0.0.1 instead
  let REDIRECT_URI;
  if (process.env.SPOTIFY_REDIRECT_URI) {
    REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
  } else {
    // For local dev with Express server on port 3001
    // Spotify now requires 127.0.0.1 instead of localhost
    REDIRECT_URI = `http://127.0.0.1:3001/api/spotify-callback`;
  }

  // Log the redirect URI for debugging
  console.log('Spotify Callback - Redirect URI:', REDIRECT_URI);

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return res.redirect(`/?error=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Redirect to frontend on the same port (3001 for Express server)
    const host = req.get('host') || '127.0.0.1:3001';
    const protocol = req.protocol || 'http';
    const frontendUrl = `${protocol}://${host}/music?spotify_auth=success&access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`;

    console.log('Redirecting to frontend:', frontendUrl);
    return res.redirect(frontendUrl);
  } catch (error) {
    console.error('Callback error:', error);
    return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
  }
});

// Spotify API routes (for local development)
app.get('/api/spotify-get-token', apiLimiter, async (req, res) => {
  const handler = (await import('./api/spotify-get-token.js')).default;
  return handler(req, res);
});

app.post('/api/spotify-create-playlist', apiLimiter, async (req, res) => {
  const handler = (await import('./api/spotify-create-playlist.js')).default;
  return handler(req, res);
});

app.post('/api/spotify-get-tracks', apiLimiter, async (req, res) => {
  const handler = (await import('./api/spotify-get-tracks.js')).default;
  return handler(req, res);
});

app.post('/api/spotify-get-audio-features', apiLimiter, async (req, res) => {
  const handler = (await import('./api/spotify-get-audio-features.js')).default;
  return handler(req, res);
});

app.post('/api/share-mix', emailLimiter, async (req, res) => {
  const handler = (await import('./api/share-mix.js')).default;
  return handler(req, res);
});

app.get('/api/confirm-mix', apiLimiter, async (req, res) => {
  const handler = (await import('./api/confirm-mix.js')).default;
  return handler(req, res);
});

app.post('/api/send-email', emailLimiter, async (req, res) => {
  // Use the serverless function handler for consistency
  const handler = (await import('./api/send-email.js')).default;
  return handler(req, res);
});

// Catch all handler for React routing
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
