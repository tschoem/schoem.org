/* eslint-env node */
import { getMixData, deleteMixData } from './mix-storage.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing confirmation token' });
  }

  // Clean the token - remove any unexpected suffixes (like :1 from React Router)
  token = token.split(':')[0].replace(/[^a-f0-9]/gi, '');
  console.log('Confirm mix - received token:', token);
  console.log('Token length:', token.length);

  // Get playlist data from storage (handles expiration check)
  const playlistData = await getMixData(token);

  if (!playlistData) {
    return res.status(404).json({ error: 'Invalid or expired confirmation token' });
  }

  // Get access token from server using refresh token
  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!SPOTIFY_REFRESH_TOKEN) {
    return res.status(500).json({ 
      error: 'Server authentication not configured' 
    });
  }

  try {
    // Get access token
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
    const access_token = tokenData.access_token;

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
        name: playlistData.playlistName,
        description: playlistData.description || `DJ mix from my vinyl collection (${playlistData.trackUris.length} tracks) - Mixed by Camelot key, BPM, danceability, and acousticness`,
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

    const createdPlaylist = await createResponse.json();
    const playlistId = createdPlaylist.id;

    // Add tracks to playlist (Spotify allows max 100 tracks per request)
    const chunkSize = 100;
    for (let i = 0; i < playlistData.trackUris.length; i += chunkSize) {
      const chunk = playlistData.trackUris.slice(i, i + chunkSize);
      
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

    // Remove token from storage (one-time use) - delete after successful creation
    await deleteMixData(token);

    return res.status(200).json({
      success: true,
      playlist: {
        id: playlistId,
        name: createdPlaylist.name,
        url: createdPlaylist.external_urls.spotify,
        uri: createdPlaylist.uri,
        trackCount: playlistData.trackUris.length,
        tracks: playlistData.tracks
      }
    });

  } catch (error) {
    console.error('Confirm mix error:', error);
    return res.status(500).json({ 
      error: 'Failed to create playlist',
      details: error.message 
    });
  }
}
