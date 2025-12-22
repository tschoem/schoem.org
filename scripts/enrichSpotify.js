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

// Clean string for search (remove special chars, normalize)
function cleanSearchString(str) {
    if (!str) return '';
    return str
        .replace(/[^\w\s-]/g, ' ') // Remove special chars except spaces and hyphens
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Extract first artist from comma-separated list
function getFirstArtist(artists) {
    if (!artists) return '';
    return artists.split(',')[0].trim();
}

// Generate search query variations
function generateSearchQueries(artist, album, year) {
    const queries = [];
    const cleanArtist = cleanSearchString(artist);
    const cleanAlbum = cleanSearchString(album);
    const firstArtist = getFirstArtist(artist);
    const cleanFirstArtist = cleanSearchString(firstArtist);
    
    // Strategy 1: Exact match with artist and album
    queries.push(`artist:"${cleanArtist}" album:"${cleanAlbum}"`);
    
    // Strategy 2: With year (if available and valid)
    if (year && year > 1950 && year <= new Date().getFullYear() + 1) {
        queries.push(`artist:"${cleanArtist}" album:"${cleanAlbum}" year:${year}`);
    }
    
    // Strategy 3: First artist only (in case of collaborations)
    if (firstArtist !== artist) {
        queries.push(`artist:"${cleanFirstArtist}" album:"${cleanAlbum}"`);
    }
    
    // Strategy 4: Without quotes (broader search)
    queries.push(`artist:${cleanArtist} album:${cleanAlbum}`);
    
    // Strategy 5: Album name only (for compilations/various artists)
    if (artist.toLowerCase().includes('various') || artist.toLowerCase().includes('various artists')) {
        queries.push(`album:"${cleanAlbum}"`);
        if (year && year > 1950) {
            queries.push(`album:"${cleanAlbum}" year:${year}`);
        }
    }
    
    // Strategy 6: Simplified album name (remove common suffixes)
    const simplifiedAlbum = cleanAlbum
        .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses content
        .replace(/\s*\[.*?\]\s*/g, ' ') // Remove brackets content
        .replace(/\s+/g, ' ')
        .trim();
    
    if (simplifiedAlbum !== cleanAlbum && simplifiedAlbum.length > 3) {
        queries.push(`artist:"${cleanArtist}" album:"${simplifiedAlbum}"`);
    }
    
    // Strategy 7: Try without "The" prefix
    const artistWithoutThe = cleanArtist.replace(/^the\s+/i, '');
    if (artistWithoutThe !== cleanArtist) {
        queries.push(`artist:"${artistWithoutThe}" album:"${cleanAlbum}"`);
    }
    
    return [...new Set(queries)]; // Remove duplicates
}

// Verify match quality by checking year and artist similarity
function verifyMatch(spotifyAlbum, discogsRecord) {
    // Check year match (allow ±2 years for reissues)
    if (discogsRecord.year && discogsRecord.year > 1950) {
        const spotifyYear = parseInt(spotifyAlbum.release_date?.substring(0, 4) || '0');
        if (spotifyYear > 0) {
            const yearDiff = Math.abs(spotifyYear - discogsRecord.year);
            if (yearDiff > 2) {
                return false; // Year mismatch too large
            }
        }
    }
    
    // Check artist similarity
    const discogsArtists = discogsRecord.artists.toLowerCase().split(',').map(a => a.trim());
    const spotifyArtists = spotifyAlbum.artists.map(a => a.name.toLowerCase());
    
    // Check if at least one artist matches
    const hasMatchingArtist = discogsArtists.some(dArtist => 
        spotifyArtists.some(sArtist => 
            sArtist.includes(dArtist) || dArtist.includes(sArtist)
        )
    );
    
    if (!hasMatchingArtist && !discogsRecord.artists.toLowerCase().includes('various')) {
        return false; // No artist match
    }
    
    // Check album name similarity
    const discogsTitle = discogsRecord.title.toLowerCase();
    const spotifyTitle = spotifyAlbum.name.toLowerCase();
    
    // Remove common suffixes for comparison
    const normalize = (str) => str
        .replace(/\s*\(.*?\)\s*/g, '')
        .replace(/\s*\[.*?\]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    const normalizedDiscogs = normalize(discogsTitle);
    const normalizedSpotify = normalize(spotifyTitle);
    
    // Check if titles are similar (at least 70% match)
    const similarity = calculateSimilarity(normalizedDiscogs, normalizedSpotify);
    if (similarity < 0.7) {
        return false; // Title too different
    }
    
    return true;
}

// Simple string similarity (Levenshtein-based)
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Search for album on Spotify with multiple strategies
async function searchSpotifyAlbum(token, record) {
    const artist = record.artists;
    const album = record.title;
    const year = record.year;
    
    const queries = generateSearchQueries(artist, album, year);
    
    // Try each query strategy
    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        
        try {
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    q: query,
                    type: 'album',
                    limit: 10 // Get more results to find best match
                }
            });

            if (response.data.albums.items.length > 0) {
                // Try to find the best match
                for (const albumData of response.data.albums.items) {
                    // Verify this is a good match
                    if (verifyMatch(albumData, record)) {
                        return {
                            spotify_uri: albumData.uri,
                            spotify_id: albumData.id,
                            spotify_url: albumData.external_urls.spotify,
                            spotify_image: albumData.images[0]?.url,
                            match_quality: 'verified'
                        };
                    }
                }
                
                // If no verified match, use first result but mark as unverified
                // (sometimes year info might be missing in Spotify)
                const firstResult = response.data.albums.items[0];
                return {
                    spotify_uri: firstResult.uri,
                    spotify_id: firstResult.id,
                    spotify_url: firstResult.external_urls.spotify,
                    spotify_image: firstResult.images[0]?.url,
                    match_quality: 'unverified'
                };
            }
        } catch (error) {
            // Continue to next query strategy
            continue;
        }
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return null;
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
    let verified = 0;
    let unverified = 0;
    const notFoundList = [];
    const needsPopularity = [];

    // PASS 1: Find Spotify IDs for all records
    console.log('--- Phase 1: Matching Albums to Spotify IDs ---');
    for (let i = 0; i < discogsData.length; i++) {
        const record = discogsData[i];
        const progress = `[${i + 1}/${discogsData.length}]`;

        // Check if we need to search
        if (!record.spotify_id) {
            console.log(`${progress} 🔍 Searching: ${record.artists} - ${record.title}${record.year ? ` (${record.year})` : ''}`);
            const spotifyData = await searchSpotifyAlbum(token, record);

            if (spotifyData) {
                Object.assign(record, {
                    spotify_uri: spotifyData.spotify_uri,
                    spotify_id: spotifyData.spotify_id,
                    spotify_url: spotifyData.spotify_url,
                    spotify_image: spotifyData.spotify_image
                });
                
                if (spotifyData.match_quality === 'verified') {
                    console.log(`${progress} ✅ Found (verified): ${spotifyData.spotify_url}`);
                    verified++;
                } else {
                    console.log(`${progress} ⚠️  Found (unverified): ${spotifyData.spotify_url}`);
                    unverified++;
                }
                
                matched++;
                needsPopularity.push(record);
            } else {
                console.log(`${progress} ❌ Not found`);
                notFound++;
                notFoundList.push(`${record.artists} - ${record.title}${record.year ? ` (${record.year})` : ''}`);
            }
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 150));
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
    console.log(`   ✅ Matched: ${matched} (${verified} verified, ${unverified} unverified)`);
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
