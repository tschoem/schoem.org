import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GetSongBPM API Configuration
const GETSONGBPM_API_KEY = process.env.GETSONGBPM_API_KEY;
const GETSONGBPM_BASE_URL = 'https://api.getsong.co';

if (!GETSONGBPM_API_KEY) {
    console.error('❌ Missing GetSongBPM API key!');
    console.error('Please set GETSONGBPM_API_KEY environment variable.');
    console.error('\nTo get an API key:');
    console.error('1. Go to https://getsongbpm.com/api');
    console.error('2. Register your application');
    console.error('3. Add GETSONGBPM_API_KEY to your .env file');
    process.exit(1);
}

const DATA_FILE = path.join(__dirname, '../src/data/discogsData.json');

// Get limit from command line args or environment variable
// Usage: node enrichGetSongBPM.js [max_releases] [max_tracks_per_release]
const MAX_RELEASES = process.argv[2] ? parseInt(process.argv[2]) : (process.env.MAX_RELEASES ? parseInt(process.env.MAX_RELEASES) : null);
const MAX_TRACKS_PER_RELEASE = process.argv[3] ? parseInt(process.argv[3]) : (process.env.MAX_TRACKS_PER_RELEASE ? parseInt(process.env.MAX_TRACKS_PER_RELEASE) : null);

// Clean track/artist names for API search
function cleanForSearch(str) {
    if (!str) return '';
    return str
        .trim()
        // Remove common prefixes/suffixes
        .replace(/^\(.*?\)\s*/, '') // Remove leading parentheses
        .replace(/\s*\(.*?\)$/, '') // Remove trailing parentheses
        .replace(/^\[.*?\]\s*/, '') // Remove leading brackets
        .replace(/\s*\[.*?\]$/, '') // Remove trailing brackets
        // Remove special characters that might interfere
        .replace(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract first artist from comma-separated list
function getFirstArtist(artists) {
    if (!artists) return '';
    return artists.split(',')[0].trim();
}

// Search for tracks by artist (and optionally album) in GetSongBPM API
async function searchTracksByArtist(artist, albumTitle = null) {
    const cleanArtist = cleanForSearch(artist);
    
    if (!cleanArtist) {
        return [];
    }
    
    // Try searching by artist name only (GetSongBPM search works best with artist name)
    // The API doesn't seem to support album-based searches effectively
    const searchQueries = [cleanArtist];
    
    console.log(`   🔍 Searching GetSongBPM for tracks by: "${cleanArtist}"`);
    
    for (const searchQuery of searchQueries) {
        try {
            const response = await axios.get(`${GETSONGBPM_BASE_URL}/search/`, {
                params: {
                    api_key: GETSONGBPM_API_KEY,
                    type: 'song',
                    lookup: searchQuery
                }
            });
            
            const data = response.data;
            
            if (data && data.search) {
                if (data.search.error) {
                    console.log(`   ⚠️  API error: ${data.search.error}`);
                    continue; // Try next query
                }
                
                if (Array.isArray(data.search) && data.search.length > 0) {
                    console.log(`   📊 Found ${data.search.length} total results`);
                    
                    // Filter results to match artist
                    const searchArtistLower = cleanArtist.toLowerCase();
                    const matchingTracks = data.search
                        .filter(song => {
                            const songArtist = (song.artist?.name || '').toLowerCase();
                            const matches = songArtist === searchArtistLower || 
                                          songArtist.includes(searchArtistLower) || 
                                          searchArtistLower.includes(songArtist);
                            return matches;
                        })
                        .map(song => ({
                            position: '',
                            title: song.title || '',
                            duration: song.duration || '',
                            type_: 'track',
                            getsongbpm: {
                                bpm: song.tempo ? parseInt(song.tempo) : null,
                                key: song.key_of || null,
                                danceability: song.danceability || null,
                                acousticness: song.acousticness || null,
                                time_signature: song.time_sig || null,
                                song_id: song.id || null
                            }
                        }));
                    
                    console.log(`   ✅ Found ${matchingTracks.length} tracks by ${cleanArtist}`);
                    
                    if (matchingTracks.length > 0) {
                        // Limit to top 20 tracks to avoid too many results
                        return matchingTracks.slice(0, 20);
                    } else {
                        console.log(`   ⚠️  No tracks matched artist "${cleanArtist}"`);
                        // Debug: show first few artist names from results
                        if (data.search.length > 0) {
                            const sampleArtists = data.search.slice(0, 5).map(s => s.artist?.name).filter(Boolean);
                            console.log(`   📝 Sample artists in results: ${sampleArtists.join(', ')}`);
                        }
                    }
                } else {
                    console.log(`   ⚠️  Empty search results`);
                }
            } else {
                console.log(`   ⚠️  Unexpected API response structure`);
            }
        } catch (error) {
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 60;
                console.warn(`  ⚠️  Rate limited, waiting ${retryAfter} seconds...`);
                await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
            } else {
                console.log(`   ❌ API error: ${error.response?.status || error.message}`);
                if (error.response?.data) {
                    console.log(`   Response:`, JSON.stringify(error.response.data).substring(0, 200));
                }
            }
            continue; // Try next query
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return [];
}

// Search for track in GetSongBPM API
async function searchGetSongBPM(artist, trackTitle) {
    const cleanArtist = cleanForSearch(artist);
    const cleanTrack = cleanForSearch(trackTitle);
    
    if (!cleanArtist || !cleanTrack) {
        return null;
    }
    
    // Try multiple search strategies
    const searchQueries = [
        cleanTrack, // Track name only (most likely to find results)
        `${cleanArtist} ${cleanTrack}`, // Artist + track
        `${cleanTrack} ${cleanArtist}` // Track + artist
    ];
    
    // Debug logging for first few searches
    const isDebug = cleanTrack.toLowerCase().includes('intro') || cleanTrack.toLowerCase().includes('good morning');
    
    for (const searchQuery of searchQueries) {
        try {
            const response = await axios.get(`${GETSONGBPM_BASE_URL}/search/`, {
                params: {
                    api_key: GETSONGBPM_API_KEY,
                    type: 'song',
                    lookup: searchQuery
                }
            });
            
            const data = response.data;
            
            // Check response structure: search can be an array (success) or object with error
            if (data && data.search) {
                // If it's an error object, try next query
                if (data.search.error) {
                    if (isDebug && searchQuery === searchQueries[0]) {
                        console.log(`       Query "${searchQuery}" returned: ${data.search.error}`);
                    }
                    continue; // Try next query
                }
                
                // If it's an array of results
                if (Array.isArray(data.search) && data.search.length > 0) {
                    if (isDebug) {
                        console.log(`       Query "${searchQuery}" found ${data.search.length} results`);
                        console.log(`       First result: "${data.search[0].title}" by ${data.search[0].artist?.name}`);
                    }
                    
                    // Try to find the best match by artist name
                    // Priority: 1) Exact artist + title match, 2) Partial artist + title match, 3) Title only
                    const searchTitle = cleanTrack.toLowerCase();
                    const searchArtist = cleanArtist.toLowerCase();
                    
                    let bestMatch = null;
                    let bestScore = 0;
                    
                    for (const song of data.search) {
                        const songTitle = (song.title || '').toLowerCase();
                        const songArtist = (song.artist?.name || '').toLowerCase();
                        
                        // Check title match
                        const titleMatch = songTitle === searchTitle || 
                                         songTitle.includes(searchTitle) || 
                                         searchTitle.includes(songTitle);
                        
                        if (!titleMatch) continue;
                        
                        // Score based on artist match quality
                        let score = 1; // Base score for title match
                        
                        if (songArtist === searchArtist) {
                            score = 10; // Exact artist match
                        } else if (songArtist.includes(searchArtist) || searchArtist.includes(songArtist)) {
                            score = 5; // Partial artist match
                        }
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = song;
                        }
                    }
                    
                    // Use best match if found (score >= 5 means artist matched), otherwise use first result
                    const match = (bestMatch && bestScore >= 5) ? bestMatch : data.search[0];
                    
                    if (isDebug) {
                        console.log(`       Using match: "${match.title}" by ${match.artist?.name}`);
                        console.log(`       Match quality:`, bestMatch ? 'Best match (artist + title)' : 'First result (title only)');
                    }
                    
                    return {
                        bpm: match.tempo ? parseInt(match.tempo) : null,
                        key: match.key_of || null,
                        danceability: match.danceability || null,
                        acousticness: match.acousticness || null,
                        time_signature: match.time_sig || null,
                        song_id: match.id || null,
                        title: match.title || null,
                        artist: match.artist?.name || null
                    };
                }
            }
        } catch (error) {
            // Handle API errors gracefully
            if (error.response?.status === 404) {
                continue; // Try next query
            } else if (error.response?.status === 429) {
                // Rate limit exceeded
                const retryAfter = error.response.headers['retry-after'] || 60;
                console.warn(`  ⚠️  Rate limited, waiting ${retryAfter} seconds...`);
                await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
                continue; // Try next query
            } else if (error.response?.status === 401 || error.response?.status === 403) {
                console.error(`  ❌ Authentication failed. Check your API key.`);
                return null;
            } else {
                continue; // Try next query
            }
        }
        
        // Small delay between query attempts
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return null;
}

async function enrichWithGetSongBPM() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    
    // Check for skip flag (highest priority)
    if (args.includes('--skip')) {
        console.log('⏭️  GetSongBPM enrichment skipped (--skip flag)\n');
        return;
    }
    
    // Check for full mode (only if not skipping)
    const INCREMENTAL = !args.includes('--full');
    const mode = INCREMENTAL ? 'INCREMENTAL' : 'FULL';
    console.log(`🎵 Starting GetSongBPM enrichment... (Mode: ${mode})\n`);
    
    // Read existing data
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Data file not found: ${DATA_FILE}`);
        console.error('Please run "npm run fetch-discogs" first.');
        process.exit(1);
    }
    
    let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const totalReleases = data.length;
    
    // Apply limits for partial enrichment
    if (MAX_RELEASES) {
        data = data.slice(0, MAX_RELEASES);
        console.log(`⚠️  PARTIAL ENRICHMENT MODE:`);
        console.log(`   Processing only first ${MAX_RELEASES} releases (out of ${totalReleases})\n`);
    }
    
    // Filter releases that need processing
    const releasesNeedingEnrichment = INCREMENTAL
        ? data.filter(release => {
            // Include if has tracklist and at least one track needs enrichment
            if (!release.tracklist || release.tracklist.length === 0) return false;
            return release.tracklist.some(track => 
                track.type_ === 'track' && 
                (!track.getsongbpm || track.getsongbpm.bpm === null)
            );
        })
        : data;
    
    console.log(`📀 Processing ${releasesNeedingEnrichment.length} release(s)${INCREMENTAL ? ' (incremental mode)' : ''}\n`);
    
    let totalTracks = 0;
    let enrichedTracks = 0;
    let skippedTracks = 0;
    let rateLimitHits = 0;
    
    // Process each release
    for (let i = 0; i < releasesNeedingEnrichment.length; i++) {
        const release = releasesNeedingEnrichment[i];
        const progress = `[${i + 1}/${releasesNeedingEnrichment.length}]`;
        
        const albumArtist = getFirstArtist(release.artists);
        
        // Skip if no tracklist exists (should have been fetched from Discogs)
        if (!release.tracklist || release.tracklist.length === 0) {
            console.log(`${progress} ⏭️  ${release.title} by ${release.artists} - No tracklist, skipping`);
            skippedTracks++;
            continue;
        }
        
        // Count tracks that need enrichment
        let tracksNeedingEnrichmentCount = 0;
        for (const track of release.tracklist) {
            if (track.type_ === 'track') {
                if (!INCREMENTAL || !track.getsongbpm || track.getsongbpm.bpm === null) {
                    tracksNeedingEnrichmentCount++;
                }
            }
        }
        
        if (tracksNeedingEnrichmentCount === 0) {
            console.log(`${progress} ⏭️  ${release.title} by ${release.artists} - All tracks already enriched`);
            continue;
        }
        
        console.log(`${progress} 🎧 ${release.title} by ${release.artists}`);
        
        // Determine how many tracks to process
        const maxTracks = MAX_TRACKS_PER_RELEASE 
            ? Math.min(MAX_TRACKS_PER_RELEASE, tracksNeedingEnrichmentCount)
            : tracksNeedingEnrichmentCount;
        
        console.log(`   Processing ${maxTracks} track(s)${MAX_TRACKS_PER_RELEASE && tracksNeedingEnrichmentCount > MAX_TRACKS_PER_RELEASE ? ` (limited from ${tracksNeedingEnrichmentCount})` : ''}...`);
        
        // Process each track (work with original array to persist changes)
        let processedCount = 0;
        for (let j = 0; j < release.tracklist.length && processedCount < maxTracks; j++) {
            const track = release.tracklist[j];
            
            // Skip non-track items
            if (track.type_ && track.type_ !== 'track') {
                continue;
            }
            
            // Skip if already enriched (incremental mode)
            if (INCREMENTAL && track.getsongbpm && track.getsongbpm.bpm !== null) {
                continue;
            }
            
            totalTracks++;
            processedCount++;
            
            const trackTitle = track.title;
            // Use track artist if available, otherwise use album artist
            const trackArtist = track.artist || albumArtist;
            
            if (!trackArtist || !trackTitle) {
                skippedTracks++;
                continue;
            }
            
            // Search GetSongBPM using track artist (better for compilations and featured artists)
            let getsongbpmData = await searchGetSongBPM(trackArtist, trackTitle);
            
            
            // Retry once if rate limited
            if (getsongbpmData === null && rateLimitHits === 0) {
                // Small delay before retry
                await new Promise(resolve => setTimeout(resolve, 500));
                getsongbpmData = await searchGetSongBPM(trackArtist, trackTitle);
            }
            
            if (getsongbpmData) {
                // Add GetSongBPM data to track
                track.getsongbpm = {
                    bpm: getsongbpmData.bpm,
                    key: getsongbpmData.key,
                    danceability: getsongbpmData.danceability,
                    acousticness: getsongbpmData.acousticness,
                    time_signature: getsongbpmData.time_signature,
                    song_id: getsongbpmData.song_id
                };
                enrichedTracks++;
            } else {
                // Mark as not found
                track.getsongbpm = null;
                skippedTracks++;
            }
            
            // Rate limiting: GetSongBPM allows 3,000 requests per hour
            // That's ~50 requests per minute, so wait 1.2 seconds between requests
            await new Promise(resolve => setTimeout(resolve, 1200));
        }
        
        console.log(`   ✓ Processed ${processedCount} track(s)\n`);
    }
    
    // Save enriched data
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    console.log('\n✅ GetSongBPM enrichment complete!');
    console.log(`📊 Statistics:`);
    console.log(`   Total tracks processed: ${totalTracks}`);
    console.log(`   Enriched with GetSongBPM data: ${enrichedTracks}`);
    console.log(`   Not found/skipped: ${skippedTracks}`);
    
    if (MAX_RELEASES) {
        console.log(`\n⚠️  PARTIAL ENRICHMENT: Only processed ${MAX_RELEASES} releases`);
        console.log(`   To process all releases, run without limits:`);
        console.log(`   npm run enrich-getsongbpm`);
    }
    
    console.log(`\n💾 Data saved to ${DATA_FILE}`);
    console.log(`\n⚠️  Note: Rate limit is 3,000 requests/hour.`);
    console.log(`   If you hit the limit, wait 1 hour and run again.`);
}

enrichWithGetSongBPM().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

