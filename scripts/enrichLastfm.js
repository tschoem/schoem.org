import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Last.fm API Configuration
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

if (!LASTFM_API_KEY) {
    console.error('❌ Missing Last.fm API key!');
    console.error('Please set LASTFM_API_KEY environment variable.');
    console.error('\nTo get an API key:');
    console.error('1. Go to https://www.last.fm/api/account/create');
    console.error('2. Create an API account');
    console.error('3. Add LASTFM_API_KEY to your .env file');
    process.exit(1);
}

const DATA_FILE = path.join(__dirname, '../src/data/discogsData.json');

// Clean track/artist names for Last.fm API
function cleanForLastfm(str) {
    if (!str) return '';
    return str
        .trim()
        // Remove common prefixes/suffixes that might interfere
        .replace(/^\(.*?\)\s*/, '') // Remove leading parentheses
        .replace(/\s*\(.*?\)$/, '') // Remove trailing parentheses
        .replace(/^\[.*?\]\s*/, '') // Remove leading brackets
        .replace(/\s*\[.*?\]$/, '') // Remove trailing brackets
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract first artist from comma-separated list
function getFirstArtist(artists) {
    if (!artists) return '';
    return artists.split(',')[0].trim();
}

// Fetch track info from Last.fm
async function fetchTrackInfo(artist, trackTitle) {
    const cleanArtist = cleanForLastfm(artist);
    const cleanTrack = cleanForLastfm(trackTitle);
    
    if (!cleanArtist || !cleanTrack) {
        return null;
    }
    
    try {
        const response = await axios.get(LASTFM_API_URL, {
            params: {
                method: 'track.getInfo',
                api_key: LASTFM_API_KEY,
                artist: cleanArtist,
                track: cleanTrack,
                format: 'json'
            }
        });
        
        const track = response.data?.track;
        
        if (!track || track.error) {
            return null;
        }
        
        // Extract relevant data
        return {
            playcount: parseInt(track.playcount || 0),
            listeners: parseInt(track.listeners || 0),
            tags: track.toptags?.tag ? 
                (Array.isArray(track.toptags.tag) ? 
                    track.toptags.tag.map(t => t.name) : 
                    [track.toptags.tag.name]) : 
                [],
            wiki: track.wiki ? {
                summary: track.wiki.summary || '',
                content: track.wiki.content || ''
            } : null,
            url: track.url || null
        };
    } catch (error) {
        // Handle API errors gracefully
        if (error.response?.status === 404 || error.response?.status === 6) {
            // Track not found
            return null;
        } else if (error.response?.status === 29) {
            // Rate limit exceeded
            console.warn(`  ⚠️  Rate limited, waiting longer...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return null; // Signal to retry
        } else {
            console.warn(`  ⚠️  Error fetching Last.fm data: ${error.response?.status || error.message}`);
            return null;
        }
    }
}

// Fetch top tags for track (additional endpoint)
async function fetchTrackTags(artist, trackTitle) {
    const cleanArtist = cleanForLastfm(artist);
    const cleanTrack = cleanForLastfm(trackTitle);
    
    if (!cleanArtist || !cleanTrack) {
        return [];
    }
    
    try {
        const response = await axios.get(LASTFM_API_URL, {
            params: {
                method: 'track.getTopTags',
                api_key: LASTFM_API_KEY,
                artist: cleanArtist,
                track: cleanTrack,
                format: 'json'
            }
        });
        
        const tags = response.data?.toptags?.tag;
        if (!tags) return [];
        
        return Array.isArray(tags) ? tags.map(t => t.name) : [tags.name];
    } catch (error) {
        // Silently fail for tags - not critical
        return [];
    }
}

async function enrichWithLastfm() {
    console.log('🎵 Starting Last.fm enrichment...\n');
    
    // Read existing data
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Data file not found: ${DATA_FILE}`);
        console.error('Please run "npm run fetch-discogs" first.');
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`📀 Found ${data.length} releases\n`);
    
    let totalTracks = 0;
    let enrichedTracks = 0;
    let skippedTracks = 0;
    
    // Process each release
    for (let i = 0; i < data.length; i++) {
        const release = data[i];
        const progress = `[${i + 1}/${data.length}]`;
        
        if (!release.tracklist || release.tracklist.length === 0) {
            console.log(`${progress} ⏭️  ${release.title} - No tracklist`);
            continue;
        }
        
        console.log(`${progress} 🎧 ${release.title} by ${release.artists}`);
        console.log(`   Processing ${release.tracklist.length} tracks...`);
        
        // Process each track
        for (let j = 0; j < release.tracklist.length; j++) {
            const track = release.tracklist[j];
            
            // Skip non-track items (headings, indexes, etc.)
            if (track.type_ && track.type_ !== 'track') {
                continue;
            }
            
            totalTracks++;
            
            const artist = getFirstArtist(release.artists);
            const trackTitle = track.title;
            
            if (!artist || !trackTitle) {
                skippedTracks++;
                continue;
            }
            
            // Fetch Last.fm data
            let lastfmData = await fetchTrackInfo(artist, trackTitle);
            
            // Retry once if rate limited
            if (lastfmData === null) {
                await new Promise(resolve => setTimeout(resolve, 500));
                lastfmData = await fetchTrackInfo(artist, trackTitle);
            }
            
            if (lastfmData) {
                // Add Last.fm data to track
                track.lastfm = {
                    playcount: lastfmData.playcount,
                    listeners: lastfmData.listeners,
                    tags: lastfmData.tags,
                    url: lastfmData.url
                };
                enrichedTracks++;
            } else {
                // Mark as not found
                track.lastfm = null;
                skippedTracks++;
            }
            
            // Rate limiting: Last.fm allows 5 requests per second (200ms between requests)
            // We'll be conservative and wait 250ms
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        console.log(`   ✓ Processed ${release.tracklist.length} tracks\n`);
    }
    
    // Save enriched data
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    console.log('\n✅ Last.fm enrichment complete!');
    console.log(`📊 Statistics:`);
    console.log(`   Total tracks processed: ${totalTracks}`);
    console.log(`   Enriched with Last.fm data: ${enrichedTracks}`);
    console.log(`   Not found/skipped: ${skippedTracks}`);
    console.log(`\n💾 Data saved to ${DATA_FILE}`);
}

enrichWithLastfm().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});


