/* eslint-env node */
// Spotify OAuth authorization endpoint
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;

  // Determine redirect URI - must match exactly what's in Spotify app settings
  // Spotify requires: http://127.0.0.1 (for local dev) or https:// (for production)
  // Note: Spotify has deprecated http://localhost - use 127.0.0.1 instead
  let REDIRECT_URI;
  if (process.env.SPOTIFY_REDIRECT_URI) {
    REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
  } else {
    // For Vercel serverless functions, construct from request
    const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:5173';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
    // Only use http for local development, everything else must be https
    const protocol = isLocal ? 'http' : (req.headers['x-forwarded-proto'] || 'https');
    // Replace localhost with 127.0.0.1 for Spotify compatibility
    const finalHost = host.replace('localhost', '127.0.0.1');
    REDIRECT_URI = `${protocol}://${finalHost}/api/spotify-callback`;
  }

  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify Client ID not configured' });
  }

  // Log the redirect URI for debugging (remove in production)
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
}

