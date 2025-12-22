/* eslint-env node */
// Create Spotify playlist and add tracks
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { accessToken, playlistName, description, trackUris } = req.body;

    if (!accessToken || !playlistName || !trackUris || !Array.isArray(trackUris)) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Get user profile to get user ID
        const userResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
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
                'Authorization': `Bearer ${accessToken}`,
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
                    'Authorization': `Bearer ${accessToken}`,
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

