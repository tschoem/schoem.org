/* eslint-env node */
// Create Spotify playlist and add tracks
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { accessToken, playlistName, description, trackUris } = req.body;

    if (!playlistName || !trackUris || !Array.isArray(trackUris)) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get access token - either from request or from server-side refresh token
    let access_token = accessToken;
    
    if (!access_token) {
        // Try to get token from server using refresh token
        const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
        const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

        if (!SPOTIFY_REFRESH_TOKEN) {
            return res.status(401).json({ 
                error: 'No access token provided and no refresh token configured. Please authenticate.' 
            });
        }

        try {
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
            access_token = tokenData.access_token;
        } catch (error) {
            console.error('Token refresh error:', error);
            return res.status(500).json({ 
                error: 'Failed to get access token from refresh token',
                details: error.message 
            });
        }
    }

    try {
        // Get user profile to get user ID
        const userResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        if (!userResponse.ok) {
            const errorData = await userResponse.json();
            return res.status(userResponse.status).json({ 
                error: 'Failed to get user profile',
                details: errorData 
            });
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Create playlist
        const createResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: playlistName,
                description: description || `A mix from my vinyl collection`,
                public: false
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            return res.status(createResponse.status).json({ 
                error: 'Failed to create playlist',
                details: errorData 
            });
        }

        const playlistData = await createResponse.json();
        const playlistId = playlistData.id;

        // Add tracks to playlist (Spotify allows max 100 tracks per request)
        const chunkSize = 100;
        for (let i = 0; i < trackUris.length; i += chunkSize) {
            const chunk = trackUris.slice(i, i + chunkSize);
            
            const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: chunk
                })
            });

            if (!addResponse.ok) {
                const errorData = await addResponse.json();
                console.error('Failed to add tracks chunk:', errorData);
                // Continue with other chunks even if one fails
            }
        }

        return res.status(200).json({
            success: true,
            playlist: {
                id: playlistId,
                name: playlistData.name,
                url: playlistData.external_urls.spotify,
                uri: playlistData.uri
            }
        });

    } catch (error) {
        console.error('Create playlist error:', error);
        return res.status(500).json({ 
            error: 'Failed to create playlist',
            details: error.message 
        });
    }
}

