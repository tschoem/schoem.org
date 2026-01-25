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

// Remove parenthetical content (years, additional info, etc.)
function removeParentheticals(str) {
    if (!str) return '';
    return str
        .replace(/\s*\([^)]*\)\s*/g, ' ') // Remove parentheses and content
        .replace(/\s*\[[^\]]*\]\s*/g, ' ') // Remove brackets and content
        .replace(/\s*\{[^}]*\}\s*/g, ' ') // Remove braces and content
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Normalize accented characters to their base form (é → e, ñ → n, etc.)
function normalizeAccents(str) {
    if (!str) return '';
    return str
        .normalize('NFD') // Decompose characters (é → e + ́)
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .normalize('NFC'); // Recompose
}

// Clean string for search (preserve accented chars, remove only special punctuation)
function cleanSearchString(str) {
    if (!str) return '';
    // First remove parentheticals
    const withoutParentheticals = removeParentheticals(str);
    // Remove format suffixes (EP, Single, etc.) for better search matching
    const withoutFormats = removeFormatSuffixes(withoutParentheticals);
    // Keep accented characters, only remove non-letter/non-space punctuation
    // This preserves é, ñ, ü, etc. which Spotify supports
    return withoutFormats
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ') // Remove special chars but keep Unicode letters/numbers
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Normalize volume numbers and common patterns
function normalizeVolumeNumbers(str) {
    if (!str) return '';
    return str
        // Normalize comma spacing first (before volume normalization)
        .replace(/\s*,\s*/g, ' ')
        // Normalize "Vol.1", "Vol. 1", "Vol 1", "Volume 1" -> "vol 1"
        .replace(/\bvol\.?\s*(\d+)\b/gi, 'vol $1')
        .replace(/\bvolume\s+(\d+)\b/gi, 'vol $1')
        // Normalize "Part 1", "Pt. 1", "Pt 1" -> "part 1"
        .replace(/\bpt\.?\s*(\d+)\b/gi, 'part $1')
        .replace(/\bpart\s+(\d+)\b/gi, 'part $1')
        .trim();
}

// Remove format suffixes (EP, Single, LP, etc.) for better matching
// These are metadata, not part of the actual album title
function removeFormatSuffixes(str) {
    if (!str) return '';
    return str
        // Remove format indicators at the end (case-insensitive, with optional punctuation)
        .replace(/\s+(ep|single|lp|maxi|mini|album|mixtape|compilation|comp)\b\.?$/gi, '')
        // Also remove if they appear before a parenthetical (e.g., "Title EP (Remastered)")
        .replace(/\s+(ep|single|lp|maxi|mini|album|mixtape|compilation|comp)\b\.?\s*(?=\()/gi, '')
        .trim();
}

// Normalize string for comparison (remove accents for fuzzy matching)
function normalizeForComparison(str) {
    if (!str) return '';
    const normalized = normalizeAccents(str.toLowerCase());
    const volumeNormalized = normalizeVolumeNumbers(normalized);
    const formatNormalized = removeFormatSuffixes(volumeNormalized);
    return formatNormalized
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract first artist from comma-separated list and clean it
function getFirstArtist(artists) {
    if (!artists) return '';
    const first = artists.split(',')[0].trim();
    // Remove parentheticals from artist name (e.g., "Artist (2)" -> "Artist")
    return removeParentheticals(first);
}

// Generate search query variations
function generateSearchQueries(artist, album, year) {
    const queries = [];
    
    // Clean artist and album names (removes parentheticals)
    const cleanArtist = cleanSearchString(artist);
    const cleanAlbum = cleanSearchString(album);
    const firstArtist = getFirstArtist(artist);
    const cleanFirstArtist = cleanSearchString(firstArtist);
    
    // Also get versions without parentheticals but with original cleaning
    const artistNoParens = removeParentheticals(artist).trim();
    const albumNoParens = removeParentheticals(album).trim();
    const cleanArtistNoParens = cleanSearchString(artistNoParens);
    const cleanAlbumNoParens = cleanSearchString(albumNoParens);
    
    // Strategy 1: Exact match with cleaned artist and album (no parentheticals)
    // Always try without year first - many albums on Spotify have original release year, not reissue year
    queries.push(`artist:"${cleanArtist}" album:"${cleanAlbum}"`);
    
    // Strategy 2: With year (if available and valid)
    // Note: We try without year first (Strategy 1) because reissues are often listed with original year on Spotify
    if (year && year > 1950 && year <= new Date().getFullYear() + 1) {
        queries.push(`artist:"${cleanArtist}" album:"${cleanAlbum}" year:${year}`);
    }
    
    // Strategy 3: First artist only (in case of collaborations)
    if (firstArtist !== artist) {
        queries.push(`artist:"${cleanFirstArtist}" album:"${cleanAlbum}"`);
        if (year && year > 1950) {
            queries.push(`artist:"${cleanFirstArtist}" album:"${cleanAlbum}" year:${year}`);
        }
    }
    
    // Strategy 4: Without quotes (broader search)
    queries.push(`artist:${cleanArtist} album:${cleanAlbum}`);
    
    // Strategy 5: Try album name with artist in parentheses (Spotify sometimes has "Artist (Album Title)")
    const albumWithArtistParens = `${cleanArtist} (${cleanAlbum})`;
    queries.push(`album:"${albumWithArtistParens}"`);
    if (year && year > 1950) {
        queries.push(`album:"${albumWithArtistParens}" year:${year}`);
    }
    
    // Strategy 5.25: Try just album name (in case Spotify has "Artist (Album Title)" format)
    // This helps when Discogs has "Album Title" but Spotify has "Artist (Album Title)"
    queries.push(`album:"${cleanAlbum}"`);
    if (year && year > 1950) {
        queries.push(`album:"${cleanAlbum}" year:${year}`);
    }
    
    // Strategy 5.5: Album name only (for compilations/various artists) - try this early
    const artistLower = artist.toLowerCase();
    const isVarious = artistLower.includes('various') || artistLower.includes('various artists') || artistLower.includes('various artist');
    
    if (isVarious) {
        // Try exact album name
        queries.push(`album:"${cleanAlbum}"`);
        if (year && year > 1950) {
            queries.push(`album:"${cleanAlbum}" year:${year}`);
        }
        
        // Try with volume numbers normalized
        const albumWithNormalizedVol = normalizeVolumeNumbers(cleanAlbum);
        if (albumWithNormalizedVol !== cleanAlbum) {
            queries.push(`album:"${albumWithNormalizedVol}"`);
            if (year && year > 1950) {
                queries.push(`album:"${albumWithNormalizedVol}" year:${year}`);
            }
        }
        
        // Try without quotes for broader search
        queries.push(`album:${cleanAlbum}`);
        if (albumWithNormalizedVol !== cleanAlbum) {
            queries.push(`album:${albumWithNormalizedVol}`);
        }
        
        // Try with comma before volume (e.g., "Nova Rare Grooves Reggae, Vol. 1")
        const albumWithComma = cleanAlbum.replace(/\s+vol\.?\s*/i, ', Vol. ');
        if (albumWithComma !== cleanAlbum) {
            queries.push(`album:"${albumWithComma}"`);
            if (year && year > 1950) {
                queries.push(`album:"${albumWithComma}" year:${year}`);
            }
        }
        
        // Try without volume number (e.g., "Nova Rare Grooves Reggae" instead of "Nova Rare Grooves Reggae Vol.1")
        const albumWithoutVol = cleanAlbum.replace(/\s+vol\.?\s*\d+.*$/i, '').trim();
        if (albumWithoutVol !== cleanAlbum && albumWithoutVol.length > 5) {
            queries.push(`album:"${albumWithoutVol}"`);
            if (year && year > 1950) {
                queries.push(`album:"${albumWithoutVol}" year:${year}`);
            }
        }
        
        // Try with just the main part (before "Vol")
        const mainPart = cleanAlbum.split(/\s+vol\.?/i)[0].trim();
        if (mainPart !== cleanAlbum && mainPart.length > 5) {
            queries.push(`album:"${mainPart}"`);
            if (year && year > 1950) {
                queries.push(`album:"${mainPart}" year:${year}`);
            }
        }
    }
    
    // Strategy 6: Try with parentheticals removed (if different from cleaned)
    if (cleanAlbumNoParens !== cleanAlbum && cleanAlbumNoParens.length > 3) {
        queries.push(`artist:"${cleanArtist}" album:"${cleanAlbumNoParens}"`);
        if (year && year > 1950) {
            queries.push(`artist:"${cleanArtist}" album:"${cleanAlbumNoParens}" year:${year}`);
        }
    }
    
    // Strategy 7: Try without "The" prefix
    const artistWithoutThe = cleanArtist.replace(/^the\s+/i, '');
    if (artistWithoutThe !== cleanArtist) {
        queries.push(`artist:"${artistWithoutThe}" album:"${cleanAlbum}"`);
        if (cleanAlbumNoParens !== cleanAlbum) {
            queries.push(`artist:"${artistWithoutThe}" album:"${cleanAlbumNoParens}"`);
        }
    }
    
    // Strategy 8: Try with artist without parentheticals (if different)
    if (cleanArtistNoParens !== cleanArtist && cleanArtistNoParens.length > 2) {
        queries.push(`artist:"${cleanArtistNoParens}" album:"${cleanAlbum}"`);
        if (cleanAlbumNoParens !== cleanAlbum) {
            queries.push(`artist:"${cleanArtistNoParens}" album:"${cleanAlbumNoParens}"`);
        }
    }
    
    // Strategy 9: Try with accent-normalized versions (in case Spotify has different accenting)
    const normalizedArtist = normalizeAccents(cleanArtist);
    const normalizedAlbum = normalizeAccents(cleanAlbum);
    if (normalizedArtist !== cleanArtist || normalizedAlbum !== cleanAlbum) {
        queries.push(`artist:"${normalizedArtist}" album:"${normalizedAlbum}"`);
        if (year && year > 1950) {
            queries.push(`artist:"${normalizedArtist}" album:"${normalizedAlbum}" year:${year}`);
        }
    }
    
    // Strategy 10: Try with volume numbers normalized (Vol.1 vs Vol. 1, etc.)
    const albumWithNormalizedVol = normalizeVolumeNumbers(cleanAlbum);
    if (albumWithNormalizedVol !== cleanAlbum && albumWithNormalizedVol.length > 3) {
        queries.push(`artist:"${cleanArtist}" album:"${albumWithNormalizedVol}"`);
        if (year && year > 1950) {
            queries.push(`artist:"${cleanArtist}" album:"${albumWithNormalizedVol}" year:${year}`);
        }
        // Also try with first artist only
        if (firstArtist !== artist) {
            queries.push(`artist:"${cleanFirstArtist}" album:"${albumWithNormalizedVol}"`);
        }
    }
    
    return [...new Set(queries)]; // Remove duplicates
}

// Verify match quality by checking year and artist similarity
function verifyMatch(spotifyAlbum, discogsRecord) {
    // Normalize titles for comparison
    const normalize = (str) => {
        const noParens = removeParentheticals(str);
        return normalizeForComparison(noParens);
    };
    
    // Extract content from parentheses before normalizing (for cases like "Guts (Le Bienheureux)")
    const extractFromParens = (str) => {
        const match = str.match(/\(([^)]+)\)/);
        return match ? normalizeForComparison(match[1]) : null;
    };
    
    const normalizedDiscogsTitle = normalize(discogsRecord.title);
    const normalizedSpotifyTitle = normalize(spotifyAlbum.name);
    const spotifyInParens = extractFromParens(spotifyAlbum.name);
    
    // Calculate title similarity (perfect if matches parenthetical content)
    const titleSimilarity = spotifyInParens && normalizedDiscogsTitle === spotifyInParens 
        ? 1.0 
        : calculateSimilarity(normalizedDiscogsTitle, normalizedSpotifyTitle);
    
    // Check year match (allow ±2 years for reissues, but be more lenient if title matches well)
    if (discogsRecord.year && discogsRecord.year > 1950) {
        const spotifyYear = parseInt(spotifyAlbum.release_date?.substring(0, 4) || '0');
        if (spotifyYear > 0) {
            const yearDiff = Math.abs(spotifyYear - discogsRecord.year);
            // If title matches perfectly (100%), allow any year difference (reissues can be decades apart)
            // If title matches very well (>90%), allow larger year differences (up to 50 years)
            // Otherwise, allow ±2 years for minor reissues
            const maxYearDiff = titleSimilarity >= 1.0 ? 1000 : (titleSimilarity > 0.9 ? 50 : 2);
            if (yearDiff > maxYearDiff) {
                return false; // Year mismatch too large
            }
        }
    }
    
    // Check if this is a compilation/various artists album
    const isVarious = discogsRecord.artists.toLowerCase().includes('various');
    
    // For compilations, skip artist matching (they often have different artists on Spotify)
    if (!isVarious) {
        // Check artist similarity (normalize for comparison - remove parentheticals and accents)
        const normalizeArtist = (str) => {
            const noParens = removeParentheticals(str);
            return normalizeForComparison(noParens);
        };
        const discogsArtists = discogsRecord.artists.split(',').map(a => normalizeArtist(a));
        const spotifyArtists = spotifyAlbum.artists.map(a => normalizeArtist(a.name));
        
        // Check if at least one artist matches (after normalization)
        const hasMatchingArtist = discogsArtists.some(dArtist => 
            spotifyArtists.some(sArtist => {
                // Exact match or contains match (accent-insensitive)
                if (dArtist === sArtist || sArtist.includes(dArtist) || dArtist.includes(sArtist)) {
                    return true;
                }
                // Also try without "the" prefix
                const dWithoutThe = dArtist.replace(/^the\s+/, '');
                const sWithoutThe = sArtist.replace(/^the\s+/, '');
                return dWithoutThe === sWithoutThe || sWithoutThe.includes(dWithoutThe) || dWithoutThe.includes(sWithoutThe);
            })
        );
        
        if (!hasMatchingArtist) {
            return false; // No artist match for non-compilation albums
        }
    }
    
    // Check album name similarity (already normalized above)
    const normalizedDiscogs = normalizedDiscogsTitle;
    const normalizedSpotify = normalizedSpotifyTitle;
    
    // Check if Discogs title matches content in Spotify parentheses (e.g., "Le Bienheureux" in "Guts (Le Bienheureux)")
    if (spotifyInParens && normalizedDiscogs === spotifyInParens) {
        return true; // Perfect match with parenthetical content
    }
    
    // Check if titles are similar (at least 65% match, lowered for accent differences)
    // For compilations, be slightly more lenient (60%)
    const minSimilarity = isVarious ? 0.60 : 0.65;
    
    // Exact match after normalization (handles accent differences, volume numbers, etc.)
    if (normalizedDiscogs === normalizedSpotify) {
        return true; // Perfect match after normalization
    }
    
    // Check if Spotify title contains Discogs title (e.g., "Guts (Le Bienheureux)" contains "Le Bienheureux")
    // Extract base title from Spotify (before parentheses)
    const spotifyBase = normalizedSpotify.split(/\s*\(/)[0].trim();
    
    // Check if Discogs title matches Spotify base
    if (normalizedDiscogs === spotifyBase) {
        return true; // Matches base
    }
    
    // Check if Discogs title is contained in Spotify title (before normalization removed parentheticals)
    const spotifyOriginal = normalizeForComparison(spotifyAlbum.name); // Don't remove parentheticals yet
    if (spotifyOriginal.includes(normalizedDiscogs)) {
        return true; // Discogs title is in Spotify title
    }
    
    // Check if Discogs title is contained in normalized Spotify title
    if (normalizedSpotify.includes(normalizedDiscogs) || normalizedDiscogs.includes(normalizedSpotify)) {
        const shorter = normalizedDiscogs.length < normalizedSpotify.length ? normalizedDiscogs : normalizedSpotify;
        const longer = normalizedDiscogs.length >= normalizedSpotify.length ? normalizedDiscogs : normalizedSpotify;
        // If shorter is at least 70% of longer, it's a good match
        if (shorter.length / longer.length >= 0.7) {
            return true;
        }
    }
    
    const similarity = calculateSimilarity(normalizedDiscogs, normalizedSpotify);
    if (similarity < minSimilarity) {
        // Check if one contains the other (for cases like "nova rare grooves reggae vol 1" vs "nova rare grooves reggae vol 1 standard")
        const shorter = normalizedDiscogs.length < normalizedSpotify.length ? normalizedDiscogs : normalizedSpotify;
        const longer = normalizedDiscogs.length >= normalizedSpotify.length ? normalizedDiscogs : normalizedSpotify;
        // For compilations, allow shorter minimum length for partial matches
        const minLength = isVarious ? 4 : 5;
        if (!longer.includes(shorter) || shorter.length < minLength) {
            return false; // Title too different
        }
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
                // For compilations, be more lenient - try all results
                const isVarious = record.artists.toLowerCase().includes('various');
                
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
                
                // For compilations, if no verified match but we have results, check if any are close
                if (isVarious && response.data.albums.items.length > 0) {
                    // Check if any result has a similar normalized title
                    const discogsTitleNormalized = normalizeForComparison(removeParentheticals(record.title));
                    for (const albumData of response.data.albums.items) {
                        const spotifyTitleNormalized = normalizeForComparison(removeParentheticals(albumData.name));
                        // If normalized titles match or one contains the other, accept it
                        if (discogsTitleNormalized === spotifyTitleNormalized || 
                            discogsTitleNormalized.includes(spotifyTitleNormalized) ||
                            spotifyTitleNormalized.includes(discogsTitleNormalized)) {
            return {
                spotify_uri: albumData.uri,
                spotify_id: albumData.id,
                spotify_url: albumData.external_urls.spotify,
                                spotify_image: albumData.images[0]?.url,
                                match_quality: 'unverified'
                            };
                        }
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

// Convert milliseconds to MM:SS format
function formatDuration(ms) {
    if (!ms || ms === 0) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Parse duration string (MM:SS or HH:MM:SS) to seconds
function parseDuration(durationStr) {
    if (!durationStr || durationStr.trim() === '') return null;
    
    const parts = durationStr.trim().split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
}

// Match a Discogs track to a Spotify track using improved matching
// Supports name-based, position-based, and duration-based matching
// Uses track-level artist information when available for better matching
function matchTrackToSpotify(discogsTrack, spotifyTracks, discogsIndex = null, discogsTrackArtist = null) {
    const discogsTitle = discogsTrack.title;
    
    if (!discogsTitle || discogsTitle.trim() === '') {
        return null;
    }
    
    // Normalize for comparison (handles accents, case, etc.)
    const normalizedDiscogs = normalizeForComparison(discogsTitle);
    
    // Normalize track artist if available (for artist-based matching)
    const normalizedDiscogsArtist = discogsTrackArtist 
        ? normalizeForComparison(discogsTrackArtist)
        : null;
    
    // Parse Discogs duration if available
    const discogsDuration = discogsTrack.duration ? parseDuration(discogsTrack.duration) : null;
    
    // Find best matching Spotify track
    let match = null;
    let bestSimilarity = 0;
    let bestMatchType = null;
    
    // Strategy 1: Name-based matching (highest priority)
    for (const spotifyTrack of spotifyTracks) {
        const spotifyTitle = spotifyTrack.name;
        if (!spotifyTitle || spotifyTitle.trim() === '') {
            continue;
        }
        
        const normalizedSpotify = normalizeForComparison(spotifyTitle);
        
        // If we have track artist info, also check artist match
        let artistMatch = false;
        if (normalizedDiscogsArtist && spotifyTrack.artists && spotifyTrack.artists.length > 0) {
            const spotifyArtists = spotifyTrack.artists.map(a => normalizeForComparison(a.name));
            artistMatch = spotifyArtists.some(sArtist => 
                sArtist === normalizedDiscogsArtist ||
                sArtist.includes(normalizedDiscogsArtist) ||
                normalizedDiscogsArtist.includes(sArtist)
            );
        }
        
        // Try exact match first (after normalization)
        if (normalizedDiscogs === normalizedSpotify) {
            // If we have artist info and it matches, this is a perfect match
            if (normalizedDiscogsArtist && artistMatch) {
                return spotifyTrack; // Perfect match with artist, use it immediately
            }
            // If no artist info or artist matches, still use it
            if (!normalizedDiscogsArtist || artistMatch) {
                return spotifyTrack; // Perfect match, use it immediately
            }
        }
        
        // Try contains match (more lenient) - check if base track name is in Spotify title
        // For remixes: "Por Que Ou Ka Fe Sa" should match "Por qué ou ka fè sa - Poirier Remix"
        const baseTrackInSpotify = normalizedSpotify.includes(normalizedDiscogs);
        const spotifyBase = normalizedSpotify.split(/\s*-\s*/)[0].trim(); // Get base track name before " - "
        const baseMatch = normalizedDiscogs === spotifyBase; // spotifyBase is already normalized
        
        // For remix albums, prioritize base name match
        if (baseMatch) {
            return spotifyTrack; // Base name matches, use it immediately (perfect for remixes)
        }
        
        if (baseTrackInSpotify) {
            // Calculate similarity for contains matches
            const shorter = normalizedDiscogs.length < normalizedSpotify.length 
                ? normalizedDiscogs 
                : normalizedSpotify;
            const longer = normalizedDiscogs.length >= normalizedSpotify.length 
                ? normalizedDiscogs 
                : normalizedSpotify;
            
            // If shorter is at least 60% of longer, it's a good match
            const similarity = shorter.length / longer.length;
            if (similarity > bestSimilarity && similarity >= 0.6) {
                match = spotifyTrack;
                bestSimilarity = similarity;
                bestMatchType = 'name';
            }
        }
        
        // Try Levenshtein similarity for fuzzy matching
        const similarity = calculateSimilarity(normalizedDiscogs, normalizedSpotify);
        
        // Boost similarity if artist matches (for tracks with different artists)
        let adjustedSimilarity = similarity;
        if (normalizedDiscogsArtist && artistMatch) {
            // Boost by 0.15 (15%) if artist matches - helps prioritize correct matches
            adjustedSimilarity = Math.min(1.0, similarity + 0.15);
        }
        
        if (adjustedSimilarity > bestSimilarity && adjustedSimilarity >= 0.8) {
            match = spotifyTrack;
            bestSimilarity = adjustedSimilarity;
            bestMatchType = normalizedDiscogsArtist && artistMatch ? 'name+artist' : 'name';
        }
    }
    
    // Strategy 2: Position-based matching (if name matching failed and we have position info)
    if (!match && discogsIndex !== null && discogsIndex < spotifyTracks.length) {
        const positionMatch = spotifyTracks[discogsIndex];
        if (positionMatch) {
            // Verify it's not already matched and check if name is at least somewhat similar
            const positionTitle = normalizeForComparison(positionMatch.name);
            const basePositionTitle = positionTitle.split(/\s*-\s*/)[0].trim();
            const baseDiscogsTitle = normalizedDiscogs;
            
            // If base titles are similar (at least 50% match), use position match
            const positionSimilarity = calculateSimilarity(baseDiscogsTitle, basePositionTitle);
            if (positionSimilarity >= 0.5) {
                match = positionMatch;
                bestMatchType = 'position';
            }
        }
    }
    
    // Strategy 3: Duration-based matching (if we have durations)
    if (!match && discogsDuration !== null) {
        let bestDurationMatch = null;
        let smallestDurationDiff = Infinity;
        
        for (const spotifyTrack of spotifyTracks) {
            // Spotify tracks have duration_ms, convert to seconds
            if (spotifyTrack.duration_ms) {
                const spotifyDuration = Math.floor(spotifyTrack.duration_ms / 1000);
                const durationDiff = Math.abs(spotifyDuration - discogsDuration);
                
                // Allow ±2 seconds difference (for rounding differences)
                if (durationDiff <= 2 && durationDiff < smallestDurationDiff) {
                    bestDurationMatch = spotifyTrack;
                    smallestDurationDiff = durationDiff;
                }
            }
        }
        
        if (bestDurationMatch) {
            match = bestDurationMatch;
            bestMatchType = 'duration';
        }
    }
    
    // Strategy 4: Position + Duration combination (most reliable for remix albums)
    if (!match && discogsIndex !== null && discogsDuration !== null) {
        const positionMatch = spotifyTracks[discogsIndex];
        if (positionMatch && positionMatch.duration_ms) {
            const spotifyDuration = Math.floor(positionMatch.duration_ms / 1000);
            const durationDiff = Math.abs(spotifyDuration - discogsDuration);
            
            // If position matches and duration is close (±5 seconds), use it
            if (durationDiff <= 5) {
                match = positionMatch;
                bestMatchType = 'position+duration';
            }
        }
    }
    
    return match;
}

// Fetch track durations from Spotify for tracks missing duration data
async function fetchTrackDurations(token, tracks) {
    if (tracks.length === 0) return;
    
    // Spotify allows fetching up to 50 tracks at once
    const batchSize = 50;
    let updatedCount = 0;
    
    for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize);
        const trackIds = batch.map(t => t.spotify_id).filter(Boolean);
        
        if (trackIds.length === 0) continue;
        
        try {
            const response = await axios.get('https://api.spotify.com/v1/tracks', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    ids: trackIds.join(',')
                }
            });
            
            if (response.data && response.data.tracks) {
                const spotifyTracks = response.data.tracks.filter(t => t !== null);
                
                // Match Spotify tracks to our tracks and update durations
                for (const discogsTrack of batch) {
                    const spotifyTrack = spotifyTracks.find(st => st.id === discogsTrack.spotify_id);
                    if (spotifyTrack && spotifyTrack.duration_ms) {
                        discogsTrack.duration = formatDuration(spotifyTrack.duration_ms);
                        updatedCount++;
                    }
                }
            }
    } catch (error) {
            console.log(`   ⚠️  Could not fetch track durations: ${error.response?.status || error.message}`);
        }
        
        // Rate limiting - small delay between batches
        if (i + batchSize < tracks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    if (updatedCount > 0) {
        console.log(`   ⏱️  Updated ${updatedCount} track duration(s) from Spotify`);
    }
}

// Main enrichment function
async function enrichDiscogsData() {
    // Check environment variable (default: true if not set)
    const SPOTIFY_SCAN = process.env.SPOTIFY_SCAN !== 'false';
    if (!SPOTIFY_SCAN) {
        console.log('⏭️  Spotify enrichment skipped (SPOTIFY_SCAN=false)\n');
        return;
    }

    const INCREMENTAL = process.argv[2] !== '--full';
    const mode = INCREMENTAL ? 'INCREMENTAL' : 'FULL';
    console.log(`🎵 Starting Spotify URI enrichment... (Mode: ${mode})\n`);

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

    // PASS 1: Find Spotify IDs for albums missing them
    const albumsNeedingMatch = INCREMENTAL 
        ? discogsData.filter(r => !r.spotify_id)
        : discogsData;
    
    // PASS 1.5: Albums with Spotify ID but missing track data (incremental mode)
    const albumsNeedingTrackRescan = INCREMENTAL
        ? discogsData.filter(r => 
            r.spotify_id && 
            r.tracklist && 
            r.tracklist.length > 0 &&
            r.tracklist.some(t => t.type_ === 'track' && !t.spotify_id)
        )
        : [];
    
    console.log(`--- Phase 1: Matching Albums to Spotify IDs ---`);
    console.log(`   Processing ${albumsNeedingMatch.length} album(s)${INCREMENTAL ? ' (incremental mode)' : ''}\n`);
    
    for (let i = 0; i < albumsNeedingMatch.length; i++) {
        const record = albumsNeedingMatch[i];
        const progress = `[${i + 1}/${albumsNeedingMatch.length}]`;

        // Check if we need to search (should always be true in incremental mode)
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
                
                // Match Discogs tracks to Spotify tracks (only for tracks missing Spotify IDs)
                if (record.tracklist && record.tracklist.length > 0 && spotifyData.spotify_id) {
                    try {
                        const tracksResponse = await axios.get(`https://api.spotify.com/v1/albums/${spotifyData.spotify_id}/tracks`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            params: {
                                limit: 50 // Max tracks per request
                            }
                        });
                        
                        if (tracksResponse.data.items && tracksResponse.data.items.length > 0) {
                            const spotifyTracks = tracksResponse.data.items;
                            let matchedCount = 0;
                            const tracksNeedingMatch = INCREMENTAL
                                ? record.tracklist.filter(t => t.type_ === 'track' && !t.spotify_id)
                                : record.tracklist.filter(t => t.type_ === 'track');
                            
                            // Try to match each Discogs track to a Spotify track
                            // Calculate track indices (only counting actual tracks, not headings/indexes)
                            const trackIndices = new Map();
                            let trackIndex = 0;
                            for (let idx = 0; idx < record.tracklist.length; idx++) {
                                const t = record.tracklist[idx];
                                if (t.type_ === 'track') {
                                    trackIndices.set(t, trackIndex);
                                    trackIndex++;
                                }
                            }
                            
                            for (let j = 0; j < tracksNeedingMatch.length; j++) {
                                const discogsTrack = tracksNeedingMatch[j];
                                // Get the track index (position in album, only counting tracks)
                                const discogsTrackIndex = trackIndices.get(discogsTrack);
                                const match = matchTrackToSpotify(discogsTrack, spotifyTracks, discogsTrackIndex);
                                
                                if (match) {
                                    discogsTrack.spotify_id = match.id;
                                    discogsTrack.spotify_uri = match.uri;
                                    matchedCount++;
                                }
                            }
                            
                            if (matchedCount > 0) {
                                console.log(`   🎵 Matched ${matchedCount}/${tracksNeedingMatch.length} tracks to Spotify`);
                                
                                // Fetch durations for tracks missing duration data (including newly matched ones)
                                const tracksNeedingDuration = record.tracklist.filter(t => 
                                    t.type_ === 'track' && 
                                    t.spotify_id && 
                                    (!t.duration || t.duration.trim() === '')
                                );
                                
                                if (tracksNeedingDuration.length > 0) {
                                    await fetchTrackDurations(token, tracksNeedingDuration);
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`   ⚠️  Could not fetch Spotify tracks: ${error.response?.status || error.message}`);
                    }
                } else {
                    // Even if no new matches, check for tracks missing durations
                    const tracksNeedingDuration = record.tracklist.filter(t => 
                        t.type_ === 'track' && 
                        t.spotify_id && 
                        (!t.duration || t.duration.trim() === '')
                    );
                    
                    if (tracksNeedingDuration.length > 0) {
                        await fetchTrackDurations(token, tracksNeedingDuration);
                    }
                }
                
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
            // Check if album has Spotify ID but tracks are missing Spotify IDs
            const hasAlbumButNoTracks = record.spotify_id && 
                record.tracklist && 
                record.tracklist.length > 0 &&
                record.tracklist.some(t => t.type_ === 'track' && !t.spotify_id);
            
            // In incremental mode, only process if tracks are missing
            if (INCREMENTAL && !hasAlbumButNoTracks) {
                matched++;
                if (record.spotify_popularity === undefined) {
                    needsPopularity.push(record);
                }
                continue;
            }
            
            if (hasAlbumButNoTracks) {
                console.log(`${progress} 🔄 Re-scanning tracks: "${record.title}" (album matched but tracks missing)`);
        } else {
            console.log(`${progress} ⏭️  Already matched: "${record.title}"`);
            }
            
            // Match Discogs tracks to Spotify tracks (only for tracks missing Spotify IDs)
            if (record.tracklist && record.tracklist.length > 0 && record.spotify_id) {
                const tracksNeedingMatch = record.tracklist.filter(t => t.type_ === 'track' && !t.spotify_id);
                
                if (tracksNeedingMatch.length > 0) {
                    try {
                        // First verify the album to ensure we have the right one
                        const albumInfoResponse = await axios.get(`https://api.spotify.com/v1/albums/${record.spotify_id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        const albumInfo = albumInfoResponse.data;
                        
                        // Verify this is the right album using the same logic as verifyMatch
                        // This ensures consistency - if verifyMatch would accept it, we keep it
                        if (!verifyMatch(albumInfo, record)) {
                            const spotifyAlbumName = albumInfo.name;
                            const spotifyAlbumArtist = albumInfo.artists.map(a => a.name).join(', ');
                            console.log(`   ⚠️  Album ID mismatch detected!`);
                            console.log(`      Discogs: "${record.title}" by ${record.artists}${record.year ? ` (${record.year})` : ''}`);
                            console.log(`      Spotify: "${spotifyAlbumName}" by ${spotifyAlbumArtist}${albumInfo.release_date ? ` (${albumInfo.release_date.substring(0, 4)})` : ''}`);
                            console.log(`      ⚠️  Clearing wrong spotify_id - will re-match on next run`);
                            // Clear the wrong spotify_id so it can be re-matched
                            record.spotify_id = null;
                            record.spotify_uri = null;
                            record.spotify_url = null;
                            record.spotify_image = null;
                            continue;
                        }
                        
                        const tracksResponse = await axios.get(`https://api.spotify.com/v1/albums/${record.spotify_id}/tracks`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            params: {
                                limit: 50 // Max tracks per request
                            }
                        });
                        
                        if (tracksResponse.data.items && tracksResponse.data.items.length > 0) {
                            const spotifyTracks = tracksResponse.data.items;
                            let matchedCount = 0;
                            
                            console.log(`   📊 Found ${spotifyTracks.length} Spotify track(s) from "${spotifyAlbumName}"`);
                            
                            // Try to match each Discogs track to a Spotify track
                            // Calculate track indices (only counting actual tracks, not headings/indexes)
                            const trackIndices = new Map();
                            let trackIndex = 0;
                            for (let idx = 0; idx < record.tracklist.length; idx++) {
                                const t = record.tracklist[idx];
                                if (t.type_ === 'track') {
                                    trackIndices.set(t, trackIndex);
                                    trackIndex++;
                                }
                            }
                            
                            for (let j = 0; j < tracksNeedingMatch.length; j++) {
                                const discogsTrack = tracksNeedingMatch[j];
                                // Get the track index (position in album, only counting tracks)
                                const discogsTrackIndex = trackIndices.get(discogsTrack);
                                // Use track artist if available, otherwise use album artist
                                const trackArtist = discogsTrack.artist || getFirstArtist(record.artists);
                                const match = matchTrackToSpotify(discogsTrack, spotifyTracks, discogsTrackIndex, trackArtist);
                                
                                if (match) {
                                    discogsTrack.spotify_id = match.id;
                                    discogsTrack.spotify_uri = match.uri;
                                    matchedCount++;
                                }
                            }
                            
                            if (matchedCount > 0) {
                                console.log(`   🎵 Matched ${matchedCount}/${tracksNeedingMatch.length} tracks to Spotify`);
                            }
                            
                            if (matchedCount < tracksNeedingMatch.length) {
                                const unmatched = tracksNeedingMatch.filter(t => !t.spotify_id);
                                const unmatchedNames = unmatched.map(t => t.title).slice(0, 5).join(', ');
                                const spotifyNames = spotifyTracks.map(t => t.name).join(', ');
                                console.log(`   ⚠️  ${unmatched.length} track(s) unmatched: ${unmatchedNames}${unmatched.length > 5 ? '...' : ''}`);
                                console.log(`   📋 Spotify has ${spotifyTracks.length} track(s): ${spotifyNames}`);
                                
                                // Debug: Show normalization and check for matches
                                if (unmatched.length > 0 && spotifyTracks.length > 0) {
                                    const firstUnmatched = unmatched[0];
                                    const normalized = normalizeForComparison(firstUnmatched.title);
                                    console.log(`   🔍 Debug - Discogs "${firstUnmatched.title}" → "${normalized}"`);
                                    
                                    // Check if any Spotify track matches the normalized version
                                    const matchingSpotify = spotifyTracks.find(st => {
                                        const stNormalized = normalizeForComparison(st.name);
                                        return stNormalized === normalized;
                                    });
                                    
                                    if (matchingSpotify) {
                                        console.log(`   ✅ Found potential match: "${matchingSpotify.name}" should match "${firstUnmatched.title}"`);
                                        console.log(`   ❓ Why didn't it match? Checking matchTrackToSpotify logic...`);
                                    } else {
                                        const firstSpotify = spotifyTracks[0];
                                        const spotifyNormalized = normalizeForComparison(firstSpotify.name);
                                        console.log(`   🔍 Debug - Spotify "${firstSpotify.name}" → "${spotifyNormalized}"`);
                                    }
                                }
                            }
                            
                            // Fetch durations for tracks missing duration data (including newly matched ones)
                            const tracksNeedingDuration = record.tracklist.filter(t => 
                                t.type_ === 'track' && 
                                t.spotify_id && 
                                (!t.duration || t.duration.trim() === '')
                            );
                            
                            if (tracksNeedingDuration.length > 0) {
                                await fetchTrackDurations(token, tracksNeedingDuration);
                            }
                        }
                    } catch (error) {
                        console.log(`   ⚠️  Could not fetch Spotify tracks: ${error.response?.status || error.message}`);
                    }
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 150));
                } else {
                    // Even if no new matches needed, check for tracks missing durations
                    const tracksNeedingDuration = record.tracklist.filter(t => 
                        t.type_ === 'track' && 
                        t.spotify_id && 
                        (!t.duration || t.duration.trim() === '')
                    );
                    
                    if (tracksNeedingDuration.length > 0) {
                        await fetchTrackDurations(token, tracksNeedingDuration);
                    }
                }
            }
            
            matched++;
            if (record.spotify_popularity === undefined) {
                needsPopularity.push(record);
            }
        }
    }

    // PASS 1.5: Re-scan tracks for albums with Spotify ID but missing track data (incremental mode only)
    if (albumsNeedingTrackRescan.length > 0) {
        console.log(`\n--- Phase 1.5: Re-scanning Tracks for Albums with Missing Track Data ---`);
        console.log(`   Processing ${albumsNeedingTrackRescan.length} album(s)\n`);
        
        for (let i = 0; i < albumsNeedingTrackRescan.length; i++) {
            const record = albumsNeedingTrackRescan[i];
            const progress = `[${i + 1}/${albumsNeedingTrackRescan.length}]`;
            
            console.log(`${progress} 🔄 Re-scanning tracks: "${record.title}" (album matched but tracks missing)`);
            
            // Match Discogs tracks to Spotify tracks
            if (record.tracklist && record.tracklist.length > 0 && record.spotify_id) {
                const tracksNeedingMatch = record.tracklist.filter(t => t.type_ === 'track' && !t.spotify_id);
                
                if (tracksNeedingMatch.length > 0) {
                    try {
                        // First verify the album to ensure we have the right one
                        const albumInfoResponse = await axios.get(`https://api.spotify.com/v1/albums/${record.spotify_id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        const albumInfo = albumInfoResponse.data;
                        const spotifyAlbumName = albumInfo.name;
                        const spotifyAlbumArtist = albumInfo.artists.map(a => a.name).join(', ');
                        
                        // Verify this is the right album using the same logic as verifyMatch
                        // This ensures consistency - if verifyMatch would accept it, we keep it
                        if (!verifyMatch(albumInfo, record)) {
                            console.log(`   ⚠️  Album ID mismatch detected!`);
                            console.log(`      Discogs: "${record.title}" by ${record.artists}${record.year ? ` (${record.year})` : ''}`);
                            console.log(`      Spotify: "${spotifyAlbumName}" by ${spotifyAlbumArtist}${albumInfo.release_date ? ` (${albumInfo.release_date.substring(0, 4)})` : ''}`);
                            console.log(`      ⚠️  Clearing wrong spotify_id - will re-match on next run`);
                            // Clear the wrong spotify_id so it can be re-matched
                            record.spotify_id = null;
                            record.spotify_uri = null;
                            record.spotify_url = null;
                            record.spotify_image = null;
                            continue;
                        }
                        
                        const tracksResponse = await axios.get(`https://api.spotify.com/v1/albums/${record.spotify_id}/tracks`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            params: {
                                limit: 50 // Max tracks per request
                            }
                        });
                        
                        if (tracksResponse.data.items && tracksResponse.data.items.length > 0) {
                            const spotifyTracks = tracksResponse.data.items;
                            let matchedCount = 0;
                            
                            console.log(`   📊 Found ${spotifyTracks.length} Spotify track(s) from "${spotifyAlbumName}"`);
                            
                            // Try to match each Discogs track to a Spotify track
                            // Calculate track indices (only counting actual tracks, not headings/indexes)
                            const trackIndices = new Map();
                            let trackIndex = 0;
                            for (let idx = 0; idx < record.tracklist.length; idx++) {
                                const t = record.tracklist[idx];
                                if (t.type_ === 'track') {
                                    trackIndices.set(t, trackIndex);
                                    trackIndex++;
                                }
                            }
                            
                            for (let j = 0; j < tracksNeedingMatch.length; j++) {
                                const discogsTrack = tracksNeedingMatch[j];
                                // Get the track index (position in album, only counting tracks)
                                const discogsTrackIndex = trackIndices.get(discogsTrack);
                                // Use track artist if available, otherwise use album artist
                                const trackArtist = discogsTrack.artist || getFirstArtist(record.artists);
                                const match = matchTrackToSpotify(discogsTrack, spotifyTracks, discogsTrackIndex, trackArtist);
                                
                                if (match) {
                                    discogsTrack.spotify_id = match.id;
                                    discogsTrack.spotify_uri = match.uri;
                                    matchedCount++;
                                }
                            }
                            
                            if (matchedCount > 0) {
                                console.log(`   🎵 Matched ${matchedCount}/${tracksNeedingMatch.length} tracks to Spotify`);
                            }
                            
                            if (matchedCount < tracksNeedingMatch.length) {
                                const unmatched = tracksNeedingMatch.filter(t => !t.spotify_id);
                                const unmatchedNames = unmatched.map(t => t.title).slice(0, 5).join(', ');
                                const spotifyNames = spotifyTracks.map(t => t.name).join(', ');
                                console.log(`   ⚠️  ${unmatched.length} track(s) unmatched: ${unmatchedNames}${unmatched.length > 5 ? '...' : ''}`);
                                console.log(`   📋 Spotify has ${spotifyTracks.length} track(s): ${spotifyNames}`);
                                
                                // Debug: Show normalization and check for matches
                                if (unmatched.length > 0 && spotifyTracks.length > 0) {
                                    const firstUnmatched = unmatched[0];
                                    const normalized = normalizeForComparison(firstUnmatched.title);
                                    console.log(`   🔍 Debug - Discogs "${firstUnmatched.title}" → "${normalized}"`);
                                    
                                    // Check if any Spotify track matches the normalized version
                                    const matchingSpotify = spotifyTracks.find(st => {
                                        const stNormalized = normalizeForComparison(st.name);
                                        return stNormalized === normalized;
                                    });
                                    
                                    if (matchingSpotify) {
                                        console.log(`   ✅ Found potential match: "${matchingSpotify.name}" should match "${firstUnmatched.title}"`);
                                        console.log(`   ❓ Why didn't it match? Checking matchTrackToSpotify logic...`);
                                    } else {
                                        const firstSpotify = spotifyTracks[0];
                                        const spotifyNormalized = normalizeForComparison(firstSpotify.name);
                                        console.log(`   🔍 Debug - Spotify "${firstSpotify.name}" → "${spotifyNormalized}"`);
                                    }
                                }
                            }
                            
                            // Fetch durations for tracks missing duration data (including newly matched ones)
                            const tracksNeedingDuration = record.tracklist.filter(t => 
                                t.type_ === 'track' && 
                                t.spotify_id && 
                                (!t.duration || t.duration.trim() === '')
                            );
                            
                            if (tracksNeedingDuration.length > 0) {
                                await fetchTrackDurations(token, tracksNeedingDuration);
                            }
                        }
                    } catch (error) {
                        console.log(`   ⚠️  Could not fetch Spotify tracks: ${error.response?.status || error.message}`);
                    }
                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 150));
                } else {
                    // Even if no new matches needed, check for tracks missing durations
                    const tracksNeedingDuration = record.tracklist.filter(t => 
                        t.type_ === 'track' && 
                        t.spotify_id && 
                        (!t.duration || t.duration.trim() === '')
                    );
                    
                    if (tracksNeedingDuration.length > 0) {
                        await fetchTrackDurations(token, tracksNeedingDuration);
                    }
                }
            }
        }
        
        // Save after track re-scan
        fs.writeFileSync(dataPath, JSON.stringify(discogsData, null, 2));
        console.log(`\n✅ Track re-scan complete!`);
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
