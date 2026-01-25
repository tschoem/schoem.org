// Utility functions for generating vinyl labels

// Camelot Wheel mapping: musical key -> Camelot notation
const keyToCamelot = {
  // Minor keys (A)
  'Abm': '1A', 'Abmin': '1A', 'Ab minor': '1A', 'G#m': '1A', 'G#min': '1A', 'G# minor': '1A',
  'Ebm': '2A', 'Ebmin': '2A', 'Eb minor': '2A', 'D#m': '2A', 'D#min': '2A', 'D# minor': '2A',
  'Bbm': '3A', 'Bbmin': '3A', 'Bb minor': '3A', 'A#m': '3A', 'A#min': '3A', 'A# minor': '3A',
  'Fm': '4A', 'Fmin': '4A', 'F minor': '4A',
  'Cm': '5A', 'Cmin': '5A', 'C minor': '5A',
  'Gm': '6A', 'Gmin': '6A', 'G minor': '6A',
  'Dm': '7A', 'Dmin': '7A', 'D minor': '7A',
  'Am': '8A', 'Amin': '8A', 'A minor': '8A',
  'Em': '9A', 'Emin': '9A', 'E minor': '9A',
  'Bm': '10A', 'Bmin': '10A', 'B minor': '10A',
  'F#m': '11A', 'F#min': '11A', 'F# minor': '11A', 'F♯m': '11A', 'F♯min': '11A', 'F♯ minor': '11A',
  'C#m': '12A', 'C#min': '12A', 'C# minor': '12A', 'C♯m': '12A', 'C♯min': '12A', 'C♯ minor': '12A',
  
  // Major keys (B)
  'B': '1B', 'B major': '1B',
  'Gb': '2B', 'Gb major': '2B', 'F#': '2B', 'F# major': '2B', 'F♯': '2B', 'F♯ major': '2B',
  'Db': '3B', 'Db major': '3B', 'C#': '3B', 'C# major': '3B', 'C♯': '3B', 'C♯ major': '3B',
  'Ab': '4B', 'Ab major': '4B', 'G#': '4B', 'G# major': '4B',
  'Eb': '5B', 'Eb major': '5B', 'D#': '5B', 'D# major': '5B',
  'Bb': '6B', 'Bb major': '6B', 'A#': '6B', 'A# major': '6B',
  'F': '7B', 'F major': '7B',
  'C': '8B', 'C major': '8B',
  'G': '9B', 'G major': '9B',
  'D': '10B', 'D major': '10B',
  'A': '11B', 'A major': '11B',
  'E': '12B', 'E major': '12B'
};

export function getCamelotKey(key) {
  if (!key) return 'N/A';
  
  // Normalize the key
  let normalized = key.replace('♯', '#').replace('♭', 'b').trim();
  
  // Handle minor keys
  if (normalized.toLowerCase().includes('min')) {
    normalized = normalized.replace(/min/i, 'm');
  }
  if (normalized.toLowerCase().includes('minor')) {
    normalized = normalized.replace(/minor/i, 'm');
  }
  
  // Try direct lookup
  if (keyToCamelot[normalized]) {
    return keyToCamelot[normalized];
  }
  
  // Try case-insensitive
  const lowerKey = normalized.toLowerCase();
  for (const [k, camelot] of Object.entries(keyToCamelot)) {
    if (k.toLowerCase() === lowerKey) {
      return camelot;
    }
  }
  
  return key; // Return original if not found
}

// Parse position to determine side (A, B, C, D, etc.)
export function getSideFromPosition(position) {
  if (!position) return null;
  const match = position.match(/^([A-Z]+)/);
  return match ? match[1] : null;
}

// Group tracks by record and side
export function groupTracksByRecordAndSide(tracklist) {
  if (!tracklist || tracklist.length === 0) return [];
  
  const tracks = tracklist.filter(t => t.type_ === 'track');
  const groups = [];
  let currentRecord = null;
  let currentSide = null;
  let currentGroup = null;
  
  tracks.forEach(track => {
    const side = getSideFromPosition(track.position);
    
    if (!side) {
      // No position info, add to current group or create new
      if (currentGroup) {
        currentGroup.tracks.push(track);
      }
      return;
    }
    
    // Determine if this is a new record (side A after a previous side)
    const isNewRecord = currentSide && side === 'A' && 
                       (currentSide === 'B' || currentSide === 'C' || currentSide === 'D');
    
    if (isNewRecord || !currentGroup) {
      // Start new record
      if (isNewRecord) {
        currentRecord = (currentRecord || 0) + 1;
      } else {
        currentRecord = 1;
      }
      currentGroup = {
        record: currentRecord,
        side: side,
        tracks: [track]
      };
      groups.push(currentGroup);
    } else if (side !== currentSide) {
      // New side on same record
      currentGroup = {
        record: currentRecord,
        side: side,
        tracks: [track]
      };
      groups.push(currentGroup);
    } else {
      // Same side, add to current group
      currentGroup.tracks.push(track);
    }
    
    currentSide = side;
  });
  
  return groups;
}

// Format duration
export function formatDuration(duration) {
  if (!duration) return 'N/A';
  if (typeof duration === 'string') return duration;
  // If it's in seconds, convert to MM:SS
  if (typeof duration === 'number') {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return duration;
}

// Format percentage
export function formatPercentage(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${Math.round(value)}%`;
}

