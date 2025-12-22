/* eslint-env node */
// Spotify OAuth callback endpoint
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { code, error, state } = req.query;

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
        // For Vercel serverless functions, construct from request
        const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:5173';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
        // Only use http for local development, everything else must be https
        const protocol = isLocal ? 'http' : (req.headers['x-forwarded-proto'] || 'https');
        // Replace localhost with 127.0.0.1 for Spotify compatibility
        const finalHost = host.replace('localhost', '127.0.0.1');
        REDIRECT_URI = `${protocol}://${finalHost}/api/spotify-callback`;
    }

    // Log the redirect URI for debugging
    console.log('Spotify Callback - Redirect URI:', REDIRECT_URI);

    try {
        // Exchange code for access token
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

        // Redirect to frontend with tokens (in production, store these securely server-side)
        // For now, we'll pass them as URL params and the frontend will store them
        // Use the request host to determine the correct port
        const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:3001';
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]');
        const protocol = isLocal ? 'http' : (req.headers['x-forwarded-proto'] || 'https');
        const frontendUrl = `${protocol}://${host}/music?spotify_auth=success&access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`;
        
        console.log('Redirecting to frontend:', frontendUrl);
        return res.redirect(frontendUrl);
    } catch (error) {
        console.error('Callback error:', error);
        return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
}

