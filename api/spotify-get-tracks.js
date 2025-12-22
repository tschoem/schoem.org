/* eslint-env node */
// Get tracks from Spotify albums
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { albumIds } = req.body;

    if (!albumIds || !Array.isArray(albumIds)) {
        return res.status(400).json({ error: 'albumIds array is required' });
    }

    // Use client credentials for public album data
    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Spotify credentials not configured' });
    }

    try {
        // Get client credentials token
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            return res.status(500).json({ error: 'Failed to get access token', details: errorData });
        }

        const { access_token } = await tokenResponse.json();

        // Fetch tracks for all albums (Spotify allows max 20 albums per request)
        const allTracks = [];
        const chunkSize = 20;

        for (let i = 0; i < albumIds.length; i += chunkSize) {
            const chunk = albumIds.slice(i, i + chunkSize);
            const ids = chunk.join(',');

            // Get album details
            const albumsResponse = await fetch(`https://api.spotify.com/v1/albums?ids=${ids}`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`
                }
            });

            if (!albumsResponse.ok) {
                console.error(`Failed to fetch albums chunk: ${ids}`);
                continue;
            }

            const albumsData = await albumsResponse.json();

            // For each album, get its tracks
            for (const album of albumsData.albums) {
                if (!album) continue;

                let offset = 0;
                let hasMore = true;

                while (hasMore) {
                    const tracksResponse = await fetch(
                        `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50&offset=${offset}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${access_token}`
                            }
                        }
                    );

                    if (!tracksResponse.ok) {
                        hasMore = false;
                        continue;
                    }

                    const tracksData = await tracksResponse.json();

                    for (const track of tracksData.items) {
                        allTracks.push({
                            id: track.id,
                            uri: track.uri,
                            name: track.name,
                            artists: track.artists.map(a => a.name).join(', '),
                            albumId: album.id,
                            albumName: album.name,
                            duration_ms: track.duration_ms,
                            track_number: track.track_number
                        });
                    }

                    hasMore = tracksData.next !== null;
                    offset += 50;
                }
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return res.status(200).json({
            tracks: allTracks,
            count: allTracks.length
        });

    } catch (error) {
        console.error('Get tracks error:', error);
        return res.status(500).json({ 
            error: 'Failed to get tracks',
            details: error.message 
        });
    }
}

