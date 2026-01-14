// Utility functions for finding mixable tracks based on DJ mixing criteria

import { getCamelotKey } from './vinylLabelUtils';

/**
 * Convert duration string (MM:SS) to milliseconds
 * @param {string|number} duration - Duration string or milliseconds
 * @returns {number} - Duration in milliseconds
 */
export function parseDurationToMs(duration) {
  if (typeof duration === 'number') return duration;
  if (!duration) return 0;

  // Handle MM:SS format
  const parts = duration.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return (minutes * 60 + seconds) * 1000;
  }

  // Handle HH:MM:SS format
  if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return 0;
}

/**
 * Get compatible Camelot keys for mixing
 * @param {string} camelotKey - The starting Camelot key (e.g., "6A", "9B")
 * @returns {string[]} - Array of compatible Camelot keys
 */
export function getCompatibleCamelotKeys(camelotKey) {
  if (!camelotKey || camelotKey === 'N/A') return [];

  const compatible = [camelotKey]; // Same key is always compatible

  // Parse the key (e.g., "6A" -> number: 6, letter: "A")
  const match = camelotKey.match(/^(\d+)([AB])$/);
  if (!match) return [camelotKey];

  const number = parseInt(match[1]);
  const letter = match[2];

  // Adjacent keys (same letter, ±1 number, wrapping around)
  const prevNumber = number === 1 ? 12 : number - 1;
  const nextNumber = number === 12 ? 1 : number + 1;

  compatible.push(`${prevNumber}${letter}`);
  compatible.push(`${nextNumber}${letter}`);

  // Same number, different letter (relative major/minor)
  const oppositeLetter = letter === 'A' ? 'B' : 'A';
  compatible.push(`${number}${oppositeLetter}`);

  return [...new Set(compatible)]; // Remove duplicates
}

/**
 * Check if two BPMs are compatible for mixing
 * @param {number} bpm1 - First track BPM
 * @param {number} bpm2 - Second track BPM
 * @param {number} tolerance - BPM tolerance (default: 8)
 * @returns {boolean} - True if BPMs are compatible
 */
export function areBPMsCompatible(bpm1, bpm2, tolerance = 8) {
  if (!bpm1 || !bpm2) return false;
  return Math.abs(bpm1 - bpm2) <= tolerance;
}

/**
 * Check if two values are within a similarity range
 * @param {number} val1 - First value
 * @param {number} val2 - Second value
 * @param {number} tolerance - Tolerance as percentage (default: 20)
 * @returns {boolean} - True if values are similar
 */
export function areValuesSimilar(val1, val2, tolerance = 20) {
  if (val1 === null || val1 === undefined || val2 === null || val2 === undefined) return false;
  const diff = Math.abs(val1 - val2);
  const maxVal = Math.max(val1, val2);
  const percentDiff = (diff / maxVal) * 100;
  return percentDiff <= tolerance;
}

/**
 * Calculate mixability score for a track pair
 * @param {Object} track1 - First track with getsongbpm data
 * @param {Object} track2 - Second track with getsongbpm data
 * @param {Object} settings - Matching settings
 * @returns {Object} - { score: number, reasons: string[] }
 */
export function calculateMixabilityScore(track1, track2, settings = {}) {
  const {
    keyStrictness = 'normal', // 'strict', 'normal', 'loose'
    bpmTolerance = 8, // BPM difference allowed
    danceabilityTolerance = 20, // Percentage difference
    acousticnessTolerance = 30, // Percentage difference
    matchGenre = true, // Whether to consider genre/style matching
  } = settings;
  const reasons = [];
  let score = 0;

  const bpm1 = track1.getsongbpm?.bpm;
  const key1 = track1.getsongbpm?.key;
  const danceability1 = track1.getsongbpm?.danceability;
  const acousticness1 = track1.getsongbpm?.acousticness;

  const bpm2 = track2.getsongbpm?.bpm;
  const key2 = track2.getsongbpm?.key;
  const danceability2 = track2.getsongbpm?.danceability;
  const acousticness2 = track2.getsongbpm?.acousticness;

  // Camelot key compatibility (40 points)
  if (key1 && key2) {
    const camelot1 = getCamelotKey(key1);
    const camelot2 = getCamelotKey(key2);

    if (camelot1 === camelot2) {
      score += 40;
      reasons.push('Perfect key match');
    } else {
      if (keyStrictness === 'strict') {
        // Only exact matches
        reasons.push('Key mismatch (strict mode)');
      } else {
        const compatibleKeys = getCompatibleCamelotKeys(camelot1);
        if (compatibleKeys.includes(camelot2)) {
          score += keyStrictness === 'loose' ? 35 : 30;
          reasons.push('Compatible key');
        } else {
          // For loose mode, allow any key but with lower score
          if (keyStrictness === 'loose') {
            score += 20;
            reasons.push('Different key (loose mode)');
          } else {
            reasons.push('Key mismatch');
          }
        }
      }
    }
  } else {
    reasons.push('Missing key data');
  }

  // BPM compatibility (30 points)
  if (bpm1 && bpm2) {
    const bpmDiff = Math.abs(bpm1 - bpm2);
    const strictTolerance = bpmTolerance * 0.5;
    const normalTolerance = bpmTolerance;
    const looseTolerance = bpmTolerance * 1.5;

    if (bpmDiff <= strictTolerance) {
      score += 30;
      reasons.push('Perfect BPM match');
    } else if (bpmDiff <= normalTolerance) {
      score += 20;
      reasons.push('Good BPM match');
    } else if (bpmDiff <= looseTolerance) {
      score += 10;
      reasons.push('Acceptable BPM difference');
    } else {
      reasons.push('BPM mismatch');
    }
  } else {
    reasons.push('Missing BPM data');
  }

  // Danceability similarity (15 points)
  if (danceability1 !== null && danceability1 !== undefined &&
    danceability2 !== null && danceability2 !== undefined) {
    const strictTol = danceabilityTolerance * 0.5;
    const normalTol = danceabilityTolerance;

    if (areValuesSimilar(danceability1, danceability2, strictTol)) {
      score += 15;
      reasons.push('Similar danceability');
    } else if (areValuesSimilar(danceability1, danceability2, normalTol)) {
      score += 10;
      reasons.push('Acceptable danceability difference');
    } else {
      reasons.push('Danceability mismatch');
    }
  } else {
    reasons.push('Missing danceability data');
  }

  // Acousticness similarity (15 points)
  if (acousticness1 !== null && acousticness1 !== undefined &&
    acousticness2 !== null && acousticness2 !== undefined) {
    const strictTol = acousticnessTolerance * 0.5;
    const normalTol = acousticnessTolerance;

    if (areValuesSimilar(acousticness1, acousticness2, strictTol)) {
      score += 15;
      reasons.push('Similar acousticness');
    } else if (areValuesSimilar(acousticness1, acousticness2, normalTol)) {
      score += 10;
      reasons.push('Acceptable acousticness difference');
    } else {
      reasons.push('Acousticness mismatch');
    }
  } else {
    reasons.push('Missing acousticness data');
  }

  // Genre/Style matching (30 points when enabled)
  if (matchGenre && track1.record && track2.record) {
    const genres1 = track1.record.genres || [];
    const styles1 = track1.record.styles || [];
    const genres2 = track2.record.genres || [];
    const styles2 = track2.record.styles || [];

    const hasGenreMatch = genres1.some(g => genres2.includes(g));
    const hasStyleMatch = styles1.some(s => styles2.includes(s));

    if (hasGenreMatch || hasStyleMatch) {
      score += 30;
      reasons.push('Genre/style match');
    } else {
      reasons.push('No genre/style match');
    }
  }

  return { score, reasons };
}

/**
 * Find mixable tracks from a collection starting with a seed track
 * @param {Object} seedTrack - The starting track (from discogsData tracklist)
 * @param {Array} allTracks - All available tracks from the collection
 * @param {Object} options - Matching options
 * @returns {Array} - Array of mixable tracks sorted by mixability score
 */
export function findMixableTracks(seedTrack, allTracks, options = {}) {
  const {
    minScore = 50, // Minimum mixability score
    maxResults = 50, // Maximum number of results
    excludeSameAlbum = true, // Exclude tracks from the same album
    // Matching settings
    keyStrictness = 'normal',
    bpmTolerance = 8,
    danceabilityTolerance = 20,
    acousticnessTolerance = 30,
    matchGenre = true
  } = options;

  if (!seedTrack || !seedTrack.getsongbpm) {
    return [];
  }

  const seedAlbumId = seedTrack.albumId || seedTrack.spotify_id?.split(':')[2]?.split('/')[0];

  const seedBPM = seedTrack.getsongbpm?.bpm;
  const seedKey = seedTrack.getsongbpm?.key ? getCamelotKey(seedTrack.getsongbpm.key) : null;
  const seedDanceability = seedTrack.getsongbpm?.danceability;
  const seedAcousticness = seedTrack.getsongbpm?.acousticness;

  const mixableTracks = allTracks
    .filter(track => {
      // Must have getsongbpm data
      if (!track.getsongbpm) return false;

      // Exclude the seed track itself
      if (track.spotify_id === seedTrack.spotify_id) return false;

      // Optionally exclude tracks from same album
      if (excludeSameAlbum && track.albumId === seedAlbumId) return false;

      // Hard filter: BPM tolerance
      if (seedBPM && track.getsongbpm?.bpm) {
        const bpmDiff = Math.abs(seedBPM - track.getsongbpm.bpm);
        if (bpmDiff > bpmTolerance) return false;
      }

      // Hard filter: Key compatibility
      if (seedKey && track.getsongbpm?.key) {
        const trackKey = getCamelotKey(track.getsongbpm.key);
        if (keyStrictness === 'strict') {
          if (trackKey !== seedKey) return false;
        } else if (keyStrictness === 'normal') {
          const compatibleKeys = getCompatibleCamelotKeys(seedKey);
          if (!compatibleKeys.includes(trackKey)) return false;
        }
        // 'loose' allows any key
      }

      // Hard filter: Danceability tolerance
      // Tolerance is in percentage points: 50% means ±25 percentage points
      // Example: Danceability 68 with 50% tolerance = range 43 to 93
      if (seedDanceability != null && track.getsongbpm?.danceability != null) {
        const danceDiff = Math.abs(seedDanceability - track.getsongbpm.danceability);
        // Convert tolerance to percentage points: 50% setting = ±25 percentage points
        const tolerance = danceabilityTolerance / 2;
        if (danceDiff > tolerance) return false;
      }

      // Hard filter: Acousticness tolerance
      // Tolerance is in percentage points: 50% means ±25 percentage points
      // Example: Acousticness 5 with 50% tolerance = range 0 to 30 (clamped at 0)
      if (seedAcousticness != null && track.getsongbpm?.acousticness != null) {
        const acousticDiff = Math.abs(seedAcousticness - track.getsongbpm.acousticness);
        // Convert tolerance to percentage points: 50% setting = ±25 percentage points
        const tolerance = acousticnessTolerance / 2;
        if (acousticDiff > tolerance) return false;
      }

      return true;
    })
    .map(track => {
      const { score, reasons } = calculateMixabilityScore(seedTrack, track, {
        keyStrictness,
        bpmTolerance,
        danceabilityTolerance,
        acousticnessTolerance,
        matchGenre
      });
      return {
        ...track,
        mixabilityScore: score,
        mixabilityReasons: reasons
      };
    })
    .filter(track => track.mixabilityScore >= minScore)
    .sort((a, b) => b.mixabilityScore - a.mixabilityScore)
    .slice(0, maxResults);

  return mixableTracks;
}

/**
 * Build a mix by finding a chain of mixable tracks with progressive relaxation
 * @param {Object} seedTrack - Starting track
 * @param {Array} allTracks - All available tracks
 * @param {Object} options - Mix building options
 * @returns {Array} - Array of tracks forming a mix
 */
export function buildMixChain(seedTrack, allTracks, options = {}) {
  const {
    targetDuration = 60 * 60 * 1000, // Target duration in ms (default 1 hour)
    minScore = 50,
    maxTracks = 30,
    matchingSettings = {},
    useProgressiveRelaxation = true // Whether to use progressive relaxation on first build
  } = options;

  // Extract seed track values for hard filtering
  const seedBPM = seedTrack.getsongbpm?.bpm;
  const seedKey = seedTrack.getsongbpm?.key ? getCamelotKey(seedTrack.getsongbpm.key) : null;
  const seedDanceability = seedTrack.getsongbpm?.danceability;
  const seedAcousticness = seedTrack.getsongbpm?.acousticness;

  // Define relaxation levels for progressive matching
  const relaxationLevels = [
    // Level 0: Strictest - Key: normal, Genre: ON, BPM: ±5, Dance/Acoustic: 50%
    {
      keyStrictness: 'normal',
      matchGenre: true,
      bpmTolerance: 5,
      danceabilityTolerance: 50,
      acousticnessTolerance: 50
    },
    // Level 1: Relax danceability and acousticness (100%)
    {
      keyStrictness: 'normal',
      matchGenre: true,
      bpmTolerance: 5,
      danceabilityTolerance: 100,
      acousticnessTolerance: 100
    },
    // Level 2: Relax BPM to ±8
    {
      keyStrictness: 'normal',
      matchGenre: true,
      bpmTolerance: 8,
      danceabilityTolerance: 100,
      acousticnessTolerance: 100
    },
    // Level 3: Relax BPM to ±12
    {
      keyStrictness: 'normal',
      matchGenre: true,
      bpmTolerance: 12,
      danceabilityTolerance: 100,
      acousticnessTolerance: 100
    },
    // Level 4: Turn off genre matching
    {
      keyStrictness: 'normal',
      matchGenre: false,
      bpmTolerance: 12,
      danceabilityTolerance: 100,
      acousticnessTolerance: 100
    },
    // Level 5: Relax key to loose
    {
      keyStrictness: 'loose',
      matchGenre: false,
      bpmTolerance: 12,
      danceabilityTolerance: 100,
      acousticnessTolerance: 100
    }
  ];

  // Determine which settings to use
  let settingsToUse;
  if (useProgressiveRelaxation) {
    // First-time build: use progressive relaxation
    settingsToUse = null; // Will try each level
  } else {
    // User has customized settings: use their settings directly
    settingsToUse = {
      keyStrictness: matchingSettings.keyStrictness || 'normal',
      matchGenre: matchingSettings.matchGenre !== undefined ? matchingSettings.matchGenre : true,
      bpmTolerance: matchingSettings.bpmTolerance || 8,
      danceabilityTolerance: matchingSettings.danceabilityTolerance || 20,
      acousticnessTolerance: matchingSettings.acousticnessTolerance || 30
    };
  }

  // Try each relaxation level until we have enough tracks
  const levelsToTry = settingsToUse ? [settingsToUse] : relaxationLevels;
  
  for (let levelIndex = 0; levelIndex < levelsToTry.length; levelIndex++) {
    const currentSettings = levelsToTry[levelIndex];
    
    const mix = [seedTrack];
    let currentTrack = seedTrack;
    const seedDuration = parseDurationToMs(seedTrack.duration_ms || seedTrack.duration);
    let totalDuration = seedDuration;
    const usedTrackIds = new Set([seedTrack.spotify_id]);
    // Track all albums used in the mix - only one track per album allowed
    const usedAlbumIds = new Set();
    const seedAlbumId = seedTrack.albumId || seedTrack.spotify_id?.split(':')[2]?.split('/')[0];
    if (seedAlbumId) {
      usedAlbumIds.add(seedAlbumId);
    }

    while (mix.length < maxTracks && totalDuration < targetDuration) {
      // Find mixable tracks, excluding already used ones and tracks from used albums
      let candidates = findMixableTracks(seedTrack, allTracks, {
        minScore,
        maxResults: 20,
        excludeSameAlbum: false, // We'll handle album exclusion manually
        ...currentSettings
      }).filter(track => {
        // Exclude already used tracks
        if (usedTrackIds.has(track.spotify_id)) return false;
        // Exclude tracks from albums already used in the mix
        const trackAlbumId = track.albumId || track.spotify_id?.split(':')[2]?.split('/')[0];
        if (trackAlbumId && usedAlbumIds.has(trackAlbumId)) return false;
        return true;
      });

      // Additional hard filter: ensure all tracks stay within seed track's tolerance
      // This prevents BPM drift in the mix chain
      candidates = candidates.filter(track => {
        // BPM: Must be within seed track's tolerance
        if (seedBPM && track.getsongbpm?.bpm) {
          const bpmDiff = Math.abs(seedBPM - track.getsongbpm.bpm);
          if (bpmDiff > currentSettings.bpmTolerance) return false;
        }

        // Key: Must match seed track's key requirements
        if (seedKey && track.getsongbpm?.key) {
          const trackKey = getCamelotKey(track.getsongbpm.key);
          if (currentSettings.keyStrictness === 'strict') {
            if (trackKey !== seedKey) return false;
          } else if (currentSettings.keyStrictness === 'normal') {
            const compatibleKeys = getCompatibleCamelotKeys(seedKey);
            if (!compatibleKeys.includes(trackKey)) return false;
          }
          // 'loose' allows any key
        }

        // Danceability: Must be within seed track's tolerance
        // Tolerance is in percentage points: 50% means ±25 percentage points
        // Example: Danceability 68 with 50% tolerance = range 43 to 93
        if (currentSettings.danceabilityTolerance < 100 && seedDanceability != null && track.getsongbpm?.danceability != null) {
          const danceDiff = Math.abs(seedDanceability - track.getsongbpm.danceability);
          // Convert tolerance to percentage points: 50% setting = ±25 percentage points
          const tolerance = currentSettings.danceabilityTolerance / 2;
          if (danceDiff > tolerance) return false;
        }

        // Acousticness: Must be within seed track's tolerance
        // Tolerance is in percentage points: 50% means ±25 percentage points
        // Example: Acousticness 5 with 50% tolerance = range 0 to 30 (clamped at 0)
        if (currentSettings.acousticnessTolerance < 100 && seedAcousticness != null && track.getsongbpm?.acousticness != null) {
          const acousticDiff = Math.abs(seedAcousticness - track.getsongbpm.acousticness);
          // Convert tolerance to percentage points: 50% setting = ±25 percentage points
          const tolerance = currentSettings.acousticnessTolerance / 2;
          if (acousticDiff > tolerance) return false;
        }

        return true;
      });

      if (candidates.length === 0) {
        break; // No more mixable tracks found at this level
      }

      // Select the best matching track
      const nextTrack = candidates[0];

      // Check if adding this track would exceed duration
      const nextDuration = parseDurationToMs(nextTrack.duration_ms || nextTrack.duration);
      if (totalDuration + nextDuration > targetDuration) {
        break; // Would exceed target duration
      }

      mix.push(nextTrack);
      usedTrackIds.add(nextTrack.spotify_id);
      // Track the album of the added track
      const nextAlbumId = nextTrack.albumId || nextTrack.spotify_id?.split(':')[2]?.split('/')[0];
      if (nextAlbumId) {
        usedAlbumIds.add(nextAlbumId);
      }
      totalDuration += nextDuration;
      currentTrack = nextTrack;
    }

    // If we've reached the target duration, return this mix with the settings used
    if (totalDuration >= targetDuration || mix.length >= maxTracks) {
      return { mix, settingsUsed: currentSettings };
    }

    // If this is the last level, return what we have with the settings used
    if (levelIndex === levelsToTry.length - 1) {
      return { mix, settingsUsed: currentSettings };
    }

    // Otherwise, continue to next relaxation level
  }

  // Fallback: return empty mix (shouldn't reach here)
  return { mix: [seedTrack], settingsUsed: relaxationLevels[0] };
}
