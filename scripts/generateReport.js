import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../src/data/discogsData.json');

function generateReport() {
    console.log('📊 Generating Data Enrichment Report...\n');
    
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`❌ Data file not found: ${DATA_FILE}`);
        console.error('Please run the enrichment pipeline first.');
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const totalReleases = data.length;
    
    // Album-level statistics
    let albumsWithSpotify = 0;
    let albumsWithoutSpotify = 0;
    let albumsWithTracklist = 0;
    let albumsWithoutTracklist = 0;
    
    // Track-level statistics
    let totalTracks = 0;
    let tracksWithSpotify = 0;
    let tracksWithoutSpotify = 0;
    let tracksWithGetSongBPM = 0;
    let tracksWithoutGetSongBPM = 0;
    
    // Detailed lists
    const albumsWithoutSpotifyList = [];
    const albumsWithoutTracklistList = [];
    
    // Process each release
    for (const release of data) {
        // Album Spotify matching
        if (release.spotify_id) {
            albumsWithSpotify++;
        } else {
            albumsWithoutSpotify++;
            albumsWithoutSpotifyList.push({
                artist: release.artists,
                title: release.title,
                year: release.year
            });
        }
        
        // Tracklist presence
        if (release.tracklist && release.tracklist.length > 0) {
            albumsWithTracklist++;
            
            // Process tracks
            for (const track of release.tracklist) {
                if (track.type_ === 'track') {
                    totalTracks++;
                    
                    if (track.spotify_id) {
                        tracksWithSpotify++;
                    } else {
                        tracksWithoutSpotify++;
                    }
                    
                    if (track.getsongbpm && track.getsongbpm.bpm !== null) {
                        tracksWithGetSongBPM++;
                    } else {
                        tracksWithoutGetSongBPM++;
                    }
                }
            }
        } else {
            albumsWithoutTracklist++;
            albumsWithoutTracklistList.push({
                artist: release.artists,
                title: release.title,
                year: release.year
            });
        }
    }
    
    // Calculate percentages
    const spotifyMatchRate = totalReleases > 0 ? ((albumsWithSpotify / totalReleases) * 100).toFixed(1) : 0;
    const tracklistRate = totalReleases > 0 ? ((albumsWithTracklist / totalReleases) * 100).toFixed(1) : 0;
    const trackSpotifyRate = totalTracks > 0 ? ((tracksWithSpotify / totalTracks) * 100).toFixed(1) : 0;
    const trackGetSongBPMRate = totalTracks > 0 ? ((tracksWithGetSongBPM / totalTracks) * 100).toFixed(1) : 0;
    
    // Print report
    console.log('═'.repeat(70));
    console.log('📊 DATA ENRICHMENT REPORT');
    console.log('═'.repeat(70));
    console.log();
    
    console.log('📀 ALBUM STATISTICS');
    console.log('─'.repeat(70));
    console.log(`   Total Albums:              ${totalReleases}`);
    console.log(`   Albums with Tracklist:     ${albumsWithTracklist} (${tracklistRate}%)`);
    console.log(`   Albums without Tracklist:  ${albumsWithoutTracklist}`);
    console.log(`   Albums matched to Spotify:  ${albumsWithSpotify} (${spotifyMatchRate}%)`);
    console.log(`   Albums not on Spotify:     ${albumsWithoutSpotify}`);
    console.log();
    
    console.log('🎵 TRACK STATISTICS');
    console.log('─'.repeat(70));
    console.log(`   Total Tracks:               ${totalTracks}`);
    console.log(`   Tracks matched to Spotify: ${tracksWithSpotify} (${trackSpotifyRate}%)`);
    console.log(`   Tracks not on Spotify:      ${tracksWithoutSpotify}`);
    console.log(`   Tracks with GetSongBPM:      ${tracksWithGetSongBPM} (${trackGetSongBPMRate}%)`);
    console.log(`   Tracks without GetSongBPM:  ${tracksWithoutGetSongBPM}`);
    console.log();
    
    // Show albums without Spotify (limit to 20)
    if (albumsWithoutSpotifyList.length > 0) {
        console.log('❌ ALBUMS NOT MATCHED TO SPOTIFY');
        console.log('─'.repeat(70));
        const displayList = albumsWithoutSpotifyList.slice(0, 20);
        for (const album of displayList) {
            console.log(`   • ${album.artist} - ${album.title}${album.year ? ` (${album.year})` : ''}`);
        }
        if (albumsWithoutSpotifyList.length > 20) {
            console.log(`   ... and ${albumsWithoutSpotifyList.length - 20} more`);
        }
        console.log();
    }
    
    // Show albums without tracklist (limit to 20)
    if (albumsWithoutTracklistList.length > 0) {
        console.log('⚠️  ALBUMS WITHOUT TRACKLIST');
        console.log('─'.repeat(70));
        const displayList = albumsWithoutTracklistList.slice(0, 20);
        for (const album of displayList) {
            console.log(`   • ${album.artist} - ${album.title}${album.year ? ` (${album.year})` : ''}`);
        }
        if (albumsWithoutTracklistList.length > 20) {
            console.log(`   ... and ${albumsWithoutTracklistList.length - 20} more`);
        }
        console.log();
    }
    
    console.log('═'.repeat(70));
    console.log('✅ Report complete!');
    console.log('═'.repeat(70));
}

generateReport();

