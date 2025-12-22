/* eslint-env node */
// Get audio features for Spotify tracks
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { trackIds, accessToken } = req.body;

    if (!trackIds || !Array.isArray(trackIds)) {
        return res.status(400).json({ error: 'trackIds array is required' });
    }

    let access_token = accessToken;

    // If no user token provided, fall back to client credentials
    if (!access_token) {
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

            const tokenData = await tokenResponse.json();
            access_token = tokenData.access_token;
        } catch (error) {
            return res.status(500).json({ error: 'Failed to get access token', details: error.message });
        }
    }

    try {

        // Fetch audio features (Spotify allows max 100 tracks per request)
        const allFeatures = [];
        const chunkSize = 100;

        for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);
            // Filter out any null/undefined/invalid track IDs
            const validChunk = chunk.filter(id => id && typeof id === 'string' && id.length > 0);
            
            if (validChunk.length === 0) {
                console.warn(`Skipping chunk ${i / chunkSize + 1}: no valid track IDs`);
                continue;
            }
            
            const ids = validChunk.join(',');

            try {
                const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
                    headers: {
                        'Authorization': `Bearer ${access_token}`
                    }
                });

                if (!featuresResponse.ok) {
                    const errorData = await featuresResponse.json().catch(() => ({ error: 'Unknown error' }));
                    console.error(`Failed to fetch audio features chunk ${i / chunkSize + 1}:`, {
                        status: featuresResponse.status,
                        statusText: featuresResponse.statusText,
                        error: errorData
                    });
                    
                    // If rate limited, wait longer before continuing
                    if (featuresResponse.status === 429) {
                        const retryAfter = featuresResponse.headers.get('Retry-After') || 5;
                        console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        // Retry this chunk
                        i -= chunkSize;
                        continue;
                    }
                    
                    continue;
                }

                const featuresData = await featuresResponse.json();

                // Map features to track IDs (handle null responses from Spotify)
                if (featuresData.audio_features && Array.isArray(featuresData.audio_features)) {
                    featuresData.audio_features.forEach((features, index) => {
                        if (features && features.id) {
                            allFeatures.push({
                                trackId: validChunk[index],
                                ...features
                            });
                        } else {
                            console.warn(`No audio features for track: ${validChunk[index]}`);
                        }
                    });
                } else {
                    console.warn(`Unexpected response format for chunk ${i / chunkSize + 1}:`, featuresData);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error fetching audio features chunk ${i / chunkSize + 1}:`, error.message);
                // Continue with next chunk
                continue;
            }
        }

        // Return results even if some chunks failed
        if (allFeatures.length === 0) {
            return res.status(500).json({
                error: 'No audio features could be retrieved',
                details: 'All chunks failed or no valid features were found'
            });
        }

        return res.status(200).json({
            features: allFeatures,
            count: allFeatures.length,
            requested: trackIds.length,
            successRate: `${allFeatures.length}/${trackIds.length}`
        });

    } catch (error) {
        console.error('Get audio features error:', error);
        return res.status(500).json({ 
            error: 'Failed to get audio features',
            details: error.message 
        });
    }
}

