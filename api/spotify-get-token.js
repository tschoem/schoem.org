/* eslint-env node */
// Get Spotify access token using refresh token from environment variables
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Spotify credentials not configured' });
    }

    if (!SPOTIFY_REFRESH_TOKEN) {
        return res.status(401).json({ error: 'No refresh token available. User authentication required.' });
    }

    try {
        // Exchange refresh token for new access token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: SPOTIFY_REFRESH_TOKEN
            })
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Token refresh error:', errorData);
            return res.status(tokenResponse.status).json({ 
                error: 'Failed to refresh access token',
                details: errorData 
            });
        }

        const tokenData = await tokenResponse.json();
        const { access_token, expires_in } = tokenData;

        return res.status(200).json({
            access_token,
            expires_in,
            token_type: 'Bearer'
        });

    } catch (error) {
        console.error('Get token error:', error);
        return res.status(500).json({ 
            error: 'Failed to get access token',
            details: error.message 
        });
    }
}
