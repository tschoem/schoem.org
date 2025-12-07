import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Spotify API Configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials!');
    console.error('Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
    console.error('\nExample:');
    console.error('export SPOTIFY_CLIENT_ID="your_client_id"');
    console.error('export SPOTIFY_CLIENT_SECRET="your_client_secret"');
    process.exit(1);
}

// Get Spotify Access Token
async function getSpotifyToken() {
    const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Failed to get Spotify token:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Search for album on Spotify
async function searchSpotifyAlbum(token, artist, album) {
    const query = `artist:${artist} album:${album}`;

    try {
        const response = await axios.get('https://api.spotify.com/v1/search', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: {
                q: query,
                type: 'album',
                limit: 1
            }
        });

        if (response.data.albums.items.length > 0) {
            const albumData = response.data.albums.items[0];
            return {
                spotify_uri: albumData.uri,
                spotify_id: albumData.id,
                spotify_url: albumData.external_urls.spotify,
                spotify_image: albumData.images[0]?.url
            };
        }
        return null;
    } catch (error) {
        console.error(`⚠️  Search failed for "${artist} - ${album}":`, error.message);
        return null;
    }
}

// Main enrichment function
async function enrichDiscogsData() {
    console.log('🎵 Starting Spotify URI enrichment...\n');

    // Read existing discogs data
    const dataPath = path.join(__dirname, '../src/data/discogsData.json');
    const discogsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    console.log(`📀 Found ${discogsData.length} records in collection\n`);

    // Get Spotify token
    console.log('🔑 Authenticating with Spotify...');
    const token = await getSpotifyToken();
    console.log('✅ Authenticated!\n');

    // Track statistics
    let matched = 0;
    let notFound = 0;
    const notFoundList = [];
    const needsPopularity = [];

    // PASS 1: Find Spotify IDs for all records
    console.log('--- Phase 1: Matching Albums to Spotify IDs ---');
    for (let i = 0; i < discogsData.length; i++) {
        const record = discogsData[i];
        const progress = `[${i + 1}/${discogsData.length}]`;

        // Check if we need to search
        if (!record.spotify_id) {
            console.log(`${progress} 🔍 Searching: ${record.artists} - ${record.title}`);
            const spotifyData = await searchSpotifyAlbum(token, record.artists, record.title);

            if (spotifyData) {
                Object.assign(record, spotifyData);
                console.log(`${progress} ✅ Found: ${spotifyData.spotify_url}`);
                matched++;
                // Add to list for popularity fetching
                needsPopularity.push(record);
            } else {
                console.log(`${progress} ❌ Not found`);
                notFound++;
                notFoundList.push(`${record.artists} - ${record.title}`);
            }
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            console.log(`${progress} ⏭️  Already matched: "${record.title}"`);
            matched++;
            if (record.spotify_popularity === undefined) {
                needsPopularity.push(record);
            }
        }
    }

    // PASS 2: Fetch Popularity for matched albums (Batch of 20)
    if (needsPopularity.length > 0) {
        console.log(`\n--- Phase 2: Fetching Popularity Scores for ${needsPopularity.length} albums ---`);

        // Split into chunks of 20
        const chunkSize = 20;
        for (let i = 0; i < needsPopularity.length; i += chunkSize) {
            const chunk = needsPopularity.slice(i, i + chunkSize);
            const ids = chunk.map(r => r.spotify_id).join(',');

            try {
                const response = await axios.get('https://api.spotify.com/v1/albums', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    params: { ids: ids }
                });

                // Update records with popularity
                response.data.albums.forEach(album => {
                    const record = chunk.find(r => r.spotify_id === album.id);
                    if (record) {
                        record.spotify_popularity = album.popularity;
                        // Also update image if we have a better one
                        if (!record.spotify_image && album.images.length > 0) {
                            record.spotify_image = album.images[0].url;
                        }
                    }
                });
                console.log(`✅ Processed batch ${i / chunkSize + 1} (${chunk.length} albums)`);

            } catch (error) {
                console.error(`❌ Failed to fetch batch: ${error.message}`);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Save enriched data
    console.log('\n💾 Saving enriched data...');
    fs.writeFileSync(dataPath, JSON.stringify(discogsData, null, 2));
    console.log('✅ Saved to discogsData.json\n');

    // Print summary
    console.log('📊 Summary:');
    console.log(`   Total records: ${discogsData.length}`);
    console.log(`   ✅ Matched: ${matched}`);
    console.log(`   ❌ Not found: ${notFound}`);

    if (notFoundList.length > 0) {
        console.log('\n📝 Albums not found on Spotify:');
        notFoundList.forEach(album => console.log(`   - ${album}`));
    }

    console.log('\n🎉 Enrichment complete!');
}

// Run the enrichment
enrichDiscogsData().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
