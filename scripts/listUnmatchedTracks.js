import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../src/data/discogsData.json');

// Read data
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

console.log('🔍 Finding tracks without Spotify and GetSongBPM data...\n');

const unmatchedSpotify = [];
const unmatchedGetSongBPM = [];
let totalTracks = 0;
let matchedSpotify = 0;
let matchedGetSongBPM = 0;

for (const release of data) {
    if (!release.tracklist || release.tracklist.length === 0) {
        continue;
    }
    
    for (const track of release.tracklist) {
        if (track.type_ === 'track') {
            totalTracks++;
            
            // Check Spotify
            if (!track.spotify_id) {
                unmatchedSpotify.push({
                    album: release.title,
                    artist: release.artists,
                    track: track.title,
                    trackArtist: track.artist || null,
                    position: track.position || '',
                    duration: track.duration || '',
                    year: release.year || null
                });
            } else {
                matchedSpotify++;
            }
            
            // Check GetSongBPM
            if (!track.getsongbpm || track.getsongbpm.bpm === null) {
                unmatchedGetSongBPM.push({
                    album: release.title,
                    artist: release.artists,
                    track: track.title,
                    trackArtist: track.artist || null,
                    position: track.position || '',
                    duration: track.duration || '',
                    year: release.year || null,
                    hasSpotify: !!track.spotify_id
                });
            } else {
                matchedGetSongBPM++;
            }
        }
    }
}

// Helper function to print unmatched tracks
function printUnmatchedTracks(unmatchedTracks, title) {
    if (unmatchedTracks.length > 0) {
        console.log(`\n${title} (${unmatchedTracks.length}):`);
        console.log('═'.repeat(80));
        
        // Group by album for better readability
        const byAlbum = {};
        for (const track of unmatchedTracks) {
            const key = `${track.artist} - ${track.album}`;
            if (!byAlbum[key]) {
                byAlbum[key] = [];
            }
            byAlbum[key].push(track);
        }
        
        let count = 1;
        for (const [albumKey, tracks] of Object.entries(byAlbum)) {
            console.log(`\n${count}. ${albumKey}${tracks[0].year ? ` (${tracks[0].year})` : ''}`);
            for (const track of tracks) {
                let trackInfo = `   • ${track.position} ${track.track}`;
                if (track.trackArtist) {
                    trackInfo += ` (by ${track.trackArtist})`;
                }
                if (title.includes('GetSongBPM') && track.hasSpotify) {
                    trackInfo += ` [has Spotify]`;
                }
                console.log(trackInfo);
            }
            count++;
        }
        
        console.log(`\n═`.repeat(80));
        console.log(`\nTotal: ${unmatchedTracks.length} unmatched track(s) across ${Object.keys(byAlbum).length} album(s)`);
    } else {
        console.log(`\n✅ ${title.replace('❌', '').trim()} - All tracks have data!`);
    }
}

console.log(`📊 Statistics:`);
console.log(`   Total tracks: ${totalTracks}`);
console.log(`\n   Spotify:`);
console.log(`      Matched: ${matchedSpotify}`);
console.log(`      Unmatched: ${unmatchedSpotify.length}`);
console.log(`      Match rate: ${((matchedSpotify / totalTracks) * 100).toFixed(1)}%`);
console.log(`\n   GetSongBPM:`);
console.log(`      Matched: ${matchedGetSongBPM}`);
console.log(`      Unmatched: ${unmatchedGetSongBPM.length}`);
console.log(`      Match rate: ${((matchedGetSongBPM / totalTracks) * 100).toFixed(1)}%`);

printUnmatchedTracks(unmatchedSpotify, '❌ TRACKS WITHOUT SPOTIFY DATA');
printUnmatchedTracks(unmatchedGetSongBPM, '❌ TRACKS WITHOUT GETSONGBPM DATA');

