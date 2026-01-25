import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { buildMixChain, findMixableTracks, getCompatibleCamelotKeys } from './mixMatchingUtils';
import { getCamelotKey } from './vinylLabelUtils';
import '../styles/MixCreator.css';

// Mix theme definitions
const MIX_THEMES = {
  party: {
    name: 'Party',
    description: 'High-energy tracks to get the party started',
    filters: {
      genres: ['Electronic', 'Funk / Soul', 'Hip Hop', 'Pop', 'Rock', 'Reggae'],
      styles: ['Disco', 'House', 'Dance-pop', 'Funk', 'Electro', 'Dance', 'Pop Rock', 'Indie Pop'],
      minPopularity: 20,
      keywords: ['dance', 'party', 'upbeat', 'energetic']
    }
  },
  upbeat: {
    name: 'Upbeat',
    description: 'Positive and energetic vibes',
    filters: {
      genres: ['Pop', 'Rock', 'Funk / Soul', 'Electronic'],
      styles: ['Pop Rock', 'Indie Pop', 'Synth-pop', 'Disco'],
      minPopularity: 30,
      keywords: ['upbeat', 'happy', 'energetic', 'positive']
    }
  },
  classical: {
    name: 'Classical',
    description: 'Timeless classical compositions',
    filters: {
      genres: ['Classical'],
      styles: ['Modern', 'Baroque', 'Classical'],
      keywords: ['classical', 'orchestral', 'symphony']
    }
  },
  french: {
    name: 'French',
    description: 'French music from your collection',
    filters: {
      styles: ['Chanson', 'French House'],
      keywords: ['french', 'chanson', 'français'],
      artists: ['Stromae', 'Jacques', 'Francis Cabrel', 'MC Solaar', 'Les Rita Mitsouko', 'Serge Gainsbourg', 'Jacques Brel']
    }
  },
  chill: {
    name: 'Chill',
    description: 'Relaxed and mellow sounds',
    filters: {
      genres: ['Jazz', 'Electronic', 'Folk, World, & Country'],
      styles: ['Downtempo', 'Trip Hop', 'Smooth Jazz', 'Contemporary Jazz', 'Soul-Jazz', 'Bossa Nova'],
      maxPopularity: 60,
      keywords: ['chill', 'relax', 'mellow', 'ambient']
    }
  },
  jazz: {
    name: 'Jazz',
    description: 'Jazz from your collection',
    filters: {
      genres: ['Jazz'],
      styles: ['Jazz', 'Soul-Jazz', 'Contemporary Jazz', 'Hard Bop', 'Modal', 'Latin Jazz', 'Bossa Nova']
    }
  },
  reggae: {
    name: 'Reggae',
    description: 'Reggae and roots vibes',
    filters: {
      genres: ['Reggae'],
      styles: ['Roots Reggae', 'Reggae-Pop', 'Calypso']
    }
  },
  rock: {
    name: 'Rock',
    description: 'Rock classics and modern rock',
    filters: {
      genres: ['Rock'],
      styles: ['Classic Rock', 'Alternative Rock', 'Indie Rock', 'Prog Rock', 'Hard Rock', 'Grunge']
    }
  },
  latin: {
    name: 'Latin',
    description: 'Latin and world music',
    filters: {
      genres: ['Latin', 'Folk, World, & Country'],
      styles: ['Afro-Cuban', 'Cumbia', 'Tango', 'Bossa Nova', 'African', 'Soca', 'Calypso']
    }
  }
};

// Duration presets (in minutes)
const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: 'Custom', value: null }
];

const MixCreator = ({ records, onClose, onPlayTrack, isPlayerVisible = false }) => {
  const [step, setStep] = useState(1); // 1: Select Starting Track, 2: Duration, 3: Preview
  const [selectedSeedTrack, setSelectedSeedTrack] = useState(null);
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState(60); // minutes
  const [customDuration, setCustomDuration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);


  // Track data
  const [mixChain, setMixChain] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(null); // 'title', 'artist', 'album', 'bpm', 'key', 'duration', 'danceability', 'acousticness'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Mix matching settings
  const [matchingSettings, setMatchingSettings] = useState({
    keyStrictness: 'normal', // 'strict', 'normal', 'loose'
    bpmTolerance: 8, // BPM difference allowed (1-20)
    danceabilityTolerance: 20, // Percentage (5-50)
    acousticnessTolerance: 30, // Percentage (5-50)
    matchGenre: true // Genre/style matching
  });


  // Extract all tracks from records with getsongbpm data
  const availableTracks = useMemo(() => {
    const tracks = [];
    records.forEach(record => {
      if (record.tracklist && Array.isArray(record.tracklist)) {
        record.tracklist.forEach(track => {
          if (track.getsongbpm && track.spotify_id) {
            tracks.push({
              ...track,
              albumId: record.spotify_id,
              albumName: record.title,
              albumArtist: record.artists,
              record: record
            });
          }
        });
      }
    });
    return tracks;
  }, [records]);

  // Parse duration string to milliseconds
  const parseDurationToMs = (duration) => {
    if (typeof duration === 'number') return duration;
    if (!duration) return 0;
    const parts = duration.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return (minutes * 60 + seconds) * 1000;
    }
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
    return 0;
  };

  // Filter and sort tracks
  const filteredTracks = useMemo(() => {
    let filtered = availableTracks;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = availableTracks.filter(track =>
        track.title?.toLowerCase().includes(query) ||
        track.albumName?.toLowerCase().includes(query) ||
        track.albumArtist?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
          case 'title':
            aVal = (a.title || '').toLowerCase();
            bVal = (b.title || '').toLowerCase();
            break;
          case 'artist':
            aVal = (a.albumArtist || '').toLowerCase();
            bVal = (b.albumArtist || '').toLowerCase();
            break;
          case 'album':
            aVal = (a.albumName || '').toLowerCase();
            bVal = (b.albumName || '').toLowerCase();
            break;
          case 'bpm':
            aVal = a.getsongbpm?.bpm || 0;
            bVal = b.getsongbpm?.bpm || 0;
            break;
          case 'key':
            aVal = getCamelotKey(a.getsongbpm?.key);
            bVal = getCamelotKey(b.getsongbpm?.key);
            break;
          case 'duration':
            aVal = parseDurationToMs(a.duration || a.duration_ms);
            bVal = parseDurationToMs(b.duration || b.duration_ms);
            break;
          case 'danceability':
            aVal = a.getsongbpm?.danceability || 0;
            bVal = b.getsongbpm?.danceability || 0;
            break;
          case 'acousticness':
            aVal = a.getsongbpm?.acousticness || 0;
            bVal = b.getsongbpm?.acousticness || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [availableTracks, searchQuery, sortBy, sortDirection]);

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const handleRandomTrack = () => {
    if (filteredTracks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredTracks.length);
    const randomTrack = filteredTracks[randomIndex];
    setSelectedSeedTrack(randomTrack);
    // Scroll to the selected track
    setTimeout(() => {
      const selectedRow = document.querySelector(`.track-row.selected`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleGenerateMix = async () => {
    if (!selectedSeedTrack) {
      setError('Please select a starting track');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build mix chain starting from selected track
      const targetDurationMs = duration * 60 * 1000;
      // Use progressive relaxation on first build (when mixChain is empty)
      // Otherwise use current matching settings (user has customized)
      const useProgressiveRelaxation = mixChain.length === 0;
      const result = buildMixChain(selectedSeedTrack, availableTracks, {
        targetDuration: targetDurationMs,
        minScore: 50,
        maxTracks: 50,
        matchingSettings: useProgressiveRelaxation ? {} : matchingSettings,
        useProgressiveRelaxation
      });

      // Handle new return format: { mix, settingsUsed } or just mix (for backward compatibility)
      const mix = result.mix || result;
      const settingsUsed = result.settingsUsed;

      if (mix.length === 0) {
        setError('No mixable tracks found. Try selecting a different starting track.');
        setIsLoading(false);
        return;
      }

      // Update matching settings with the settings actually used (if progressive relaxation was used)
      if (useProgressiveRelaxation && settingsUsed) {
        setMatchingSettings(settingsUsed);
      }

      // Get full track data from Spotify if needed
      const tracksResponse = await fetch('/api/spotify-get-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumIds: [...new Set(mix.map(t => t.albumId).filter(Boolean))]
        })
      });

      let spotifyTracks = [];
      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        spotifyTracks = tracksData.tracks;
      }

      // Enrich mix tracks with Spotify data
      const enrichedMix = mix.map(track => {
        const spotifyTrack = spotifyTracks.find(st => st.id === track.spotify_id);
        // Parse duration from string format if needed
        let durationMs = spotifyTrack?.duration_ms || track.duration_ms;
        if (!durationMs && track.duration) {
          // Parse MM:SS format
          const parts = track.duration.split(':');
          if (parts.length === 2) {
            durationMs = (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000;
          }
        }

        return {
          ...track,
          uri: spotifyTrack?.uri || track.spotify_uri || `spotify:track:${track.spotify_id}`,
          name: spotifyTrack?.name || track.title,
          artists: spotifyTrack?.artists || track.albumArtist,
          albumName: spotifyTrack?.albumName || track.albumName,
          duration_ms: durationMs || 0
        };
      });

      setMixChain(enrichedMix);
      setStep(3); // Move to preview step

    } catch (err) {
      console.error('Generate mix error:', err);
      setError(err.message || 'Failed to generate mix. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const shareMix = async () => {
    if (mixChain.length === 0) {
      setError('No tracks in mix');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const trackUris = mixChain.map(t => t.uri).filter(Boolean);

      if (trackUris.length === 0) {
        throw new Error('No valid track URIs found');
      }

      // Generate default name with starting track if no custom name provided
      let defaultName = `Vinyl Mix - ${new Date().toLocaleDateString()}`;
      if (selectedSeedTrack?.title) {
        // Append track name to make it more unique
        const trackName = selectedSeedTrack.title.length > 40
          ? selectedSeedTrack.title.substring(0, 40) + '...'
          : selectedSeedTrack.title;
        defaultName = `Vinyl Mix - ${trackName} - ${new Date().toLocaleDateString()}`;
      }

      const playlistName = customName || defaultName;

      const description = `DJ mix from my vinyl collection (${mixChain.length} tracks) - Mixed by Camelot key, BPM, danceability, and acousticness`;

      // Send share email with confirmation link
      const shareResponse = await fetch('/api/share-mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          playlistName,
          description,
          trackUris,
          tracks: mixChain // Include full track data for email preview
        })
      });

      if (!shareResponse.ok) {
        let errorMessage = 'Failed to send email';
        try {
          const errorData = await shareResponse.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await shareResponse.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            // If we can't read the response, use status-based message
            errorMessage = `Server error (${shareResponse.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      setEmailSent(true);

    } catch (err) {
      console.error('Share mix error:', err);
      setError(err.message || 'Failed to send email. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms || ms === 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (tracks) => {
    const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get mixable tracks for preview
  const mixablePreview = useMemo(() => {
    if (!selectedSeedTrack) return [];
    return findMixableTracks(selectedSeedTrack, availableTracks, {
      minScore: 50,
      maxResults: 10,
      ...matchingSettings
    });
  }, [selectedSeedTrack, availableTracks, matchingSettings]);

  return (
    <>
      <motion.div
        className={`mix-creator-overlay ${isPlayerVisible ? 'player-visible' : 'player-hidden'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="mix-creator-content"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="mix-creator-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>

          <h2 className="mix-creator-title">Create a Mix</h2>
          <div className="mix-creator-welcome">
            <p className="mix-creator-subtitle">
              Welcome to this mix creator. Through a few clicks, you will be building a playlist based on my record collection.
            </p>
            <p className="mix-creator-description">
              This is a gift to me, and will allow me to rediscover some less played tunes, through a different musical journey.
              Each mix you create becomes a unique exploration of sounds I've collected over the years—tracks that might have been
              overlooked, forgotten gems waiting to be heard again, or familiar favorites recontextualized in new combinations.
            </p>
            <p className="mix-creator-description">
              The system intelligently matches tracks using DJ mixing principles—harmonious key progressions, compatible BPMs,
              and complementary energy levels—to create seamless transitions that flow like a carefully crafted DJ set.
              Your choices shape the journey, and I'll get to experience my collection through your musical perspective.
            </p>
          </div>

          {/* Step indicator */}
          <div className="step-indicator">
            <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Starting Track</div>
            <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Duration</div>
            <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Preview</div>
          </div>

          <>
            {/* Step 1: Select Starting Track */}
            {step === 1 && (
              <>
                <div className="mix-creator-section">
                  <h3>Select a Starting Track</h3>
                  <p className="selection-info">
                    Pick any track from my collection that catches your ear—this will be the seed for your mix. Your choice sets the mood and direction, and the system will intelligently find tracks that flow seamlessly together, matching musical keys, tempo, and energy levels to create a smooth, DJ-style journey through the collection.
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Search tracks, albums, or artists..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="playlist-name-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="random-track-pad-btn"
                        onClick={handleRandomTrack}
                        disabled={filteredTracks.length === 0}
                        title="Select random track"
                        aria-label="Select random track"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="tracks-list-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {filteredTracks.length === 0 ? (
                      <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
                        {availableTracks.length === 0
                          ? 'No tracks with mixing data found in your collection'
                          : 'No tracks match your search'}
                      </p>
                    ) : (
                      <div className="tracks-table">
                        <div className="tracks-table-header">
                          <div className="track-col-play">Play</div>
                          <div className="track-col-title sortable" onClick={() => handleSort('title')}>
                            Title {sortBy === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-artist sortable" onClick={() => handleSort('artist')}>
                            Artist {sortBy === 'artist' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-album sortable" onClick={() => handleSort('album')}>
                            Album {sortBy === 'album' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-bpm sortable" onClick={() => handleSort('bpm')}>
                            BPM {sortBy === 'bpm' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-key sortable" onClick={() => handleSort('key')}>
                            Key {sortBy === 'key' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-duration sortable" onClick={() => handleSort('duration')}>
                            Duration {sortBy === 'duration' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-danceability sortable" onClick={() => handleSort('danceability')}>
                            Dance {sortBy === 'danceability' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                          <div className="track-col-acousticness sortable" onClick={() => handleSort('acousticness')}>
                            Acoustic {sortBy === 'acousticness' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </div>
                        </div>
                        <div className="tracks-table-body">
                          {filteredTracks.map((track, index) => {
                            const camelot = getCamelotKey(track.getsongbpm?.key);
                            const isSelected = selectedSeedTrack?.spotify_id === track.spotify_id;
                            const durationMs = parseDurationToMs(track.duration || track.duration_ms);
                            return (
                              <div
                                key={`seed-${index}-${track.spotify_id || track.id || 'unknown'}`}
                                className={`track-row ${isSelected ? 'selected' : ''}`}
                              >
                                {track.spotify_id && onPlayTrack ? (
                                  <div className="track-col-play">
                                    <button
                                      className="track-play-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayTrack(track);
                                      }}
                                      aria-label="Play track"
                                      title="Play track"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="track-col-play"></div>
                                )}
                                <div className="track-col-title" onClick={() => setSelectedSeedTrack(track)}>{track.title || 'N/A'}</div>
                                <div className="track-col-artist" onClick={() => setSelectedSeedTrack(track)}>{track.albumArtist || 'N/A'}</div>
                                <div className="track-col-album" onClick={() => setSelectedSeedTrack(track)}>{track.albumName || 'N/A'}</div>
                                <div className="track-col-bpm" onClick={() => setSelectedSeedTrack(track)}>{track.getsongbpm?.bpm || 'N/A'}</div>
                                <div className="track-col-key" onClick={() => setSelectedSeedTrack(track)}>{camelot !== 'N/A' ? camelot : 'N/A'}</div>
                                <div className="track-col-duration" onClick={() => setSelectedSeedTrack(track)}>{formatDuration(durationMs)}</div>
                                <div className="track-col-danceability" onClick={() => setSelectedSeedTrack(track)}>{track.getsongbpm?.danceability ?? 'N/A'}</div>
                                <div className="track-col-acousticness" onClick={() => setSelectedSeedTrack(track)}>{track.getsongbpm?.acousticness ?? 'N/A'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedSeedTrack && (
                    <div className="mix-creator-section" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(93, 93, 255, 0.1)', borderRadius: '8px' }}>
                      <h4 style={{ marginBottom: '0.5rem' }}>Selected Starting Track</h4>
                      <p><strong>{selectedSeedTrack.title}</strong> by {selectedSeedTrack.albumArtist}</p>
                      <p style={{ fontSize: '0.9rem', color: '#888' }}>
                        {selectedSeedTrack.albumName} ·
                        BPM: {selectedSeedTrack.getsongbpm?.bpm} ·
                        Key: {getCamelotKey(selectedSeedTrack.getsongbpm?.key)}
                      </p>
                      {mixablePreview.length > 0 && (
                        <p style={{ fontSize: '0.85rem', color: '#5d5dff', marginTop: '0.5rem' }}>
                          Found {mixablePreview.length} mixable tracks
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mix-creator-section">
                    <label htmlFor="playlist-name">Playlist Name (optional)</label>
                    <input
                      id="playlist-name"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={
                        selectedSeedTrack?.title
                          ? `Vinyl Mix - ${selectedSeedTrack.title.length > 30 ? selectedSeedTrack.title.substring(0, 30) + '...' : selectedSeedTrack.title} - ${new Date().toLocaleDateString()}`
                          : `Vinyl Mix - ${new Date().toLocaleDateString()}`
                      }
                      className="playlist-name-input"
                    />
                  </div>
                </div>

                <div className="mix-creator-actions">
                  <button
                    className="create-mix-btn"
                    onClick={() => setStep(2)}
                    disabled={!selectedSeedTrack}
                  >
                    Next: Set Duration
                  </button>
                  <button className="cancel-btn" onClick={onClose}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* Step 2: Duration Configuration */}
            {step === 2 && (
              <>
                <div className="mix-creator-section">
                  <h3>Playlist Duration</h3>
                  <p className="selection-info">
                    Choose how long you want your mix to be
                  </p>

                  <div className="duration-presets">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        className={`duration-preset ${!customDuration && duration === preset.value ? 'selected' : ''} ${preset.value === null ? 'custom' : ''}`}
                        onClick={() => {
                          if (preset.value === null) {
                            setCustomDuration(true);
                          } else {
                            setCustomDuration(false);
                            setDuration(preset.value);
                          }
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {customDuration && (
                    <div className="custom-duration-input">
                      <label htmlFor="custom-duration">Custom Duration (minutes)</label>
                      <input
                        id="custom-duration"
                        type="number"
                        min="10"
                        max="480"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                        className="playlist-name-input"
                      />
                    </div>
                  )}

                  <p className="mix-info">
                    Target duration: <strong>{duration} minutes</strong>
                  </p>
                </div>

                <div className="mix-creator-actions">
                  <button
                    className="create-mix-btn"
                    onClick={handleGenerateMix}
                    disabled={isLoading || !selectedSeedTrack}
                  >
                    {isLoading ? 'Building Mix Chain...' : 'Generate Mix'}
                  </button>
                  <button className="cancel-btn" onClick={() => setStep(1)}>
                    Back
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Track Preview */}
            {step === 3 && (
              <>
                <div className="mix-creator-section">
                  <h3>Mix Preview</h3>
                  <div className="playlist-summary">
                    <p>
                      <strong>{mixChain.length}</strong> tracks in mix chain ·
                      Total duration: <strong>{formatTotalDuration(mixChain)}</strong>
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
                      Tracks are ordered by mixability (Camelot key, BPM, danceability, acousticness)
                    </p>
                  </div>
                </div>

                {/* DJ Hardware-Style Mixing Controls */}
                <div className="mix-creator-section">
                  <h3 style={{ marginBottom: '1rem' }}>🎛️ Mixing Controls</h3>
                  <div className="dj-mixer-panel">
                    {/* Key Alignment - Rotary Knob */}
                    <div className="dj-channel">
                      <label className="dj-channel-label">KEY</label>
                      <div className="dj-rotary-knob">
                        <div
                          className="dj-knob-dial"
                          style={{ transform: `rotate(${(matchingSettings.keyStrictness === 'strict' ? 0 : matchingSettings.keyStrictness === 'normal' ? 120 : 240) - 90}deg)` }}
                        >
                          <div className="dj-knob-indicator"></div>
                        </div>
                        <div className="dj-knob-marks">
                          <div className="dj-knob-mark" style={{ transform: 'rotate(0deg)' }}></div>
                          <div className="dj-knob-mark" style={{ transform: 'rotate(120deg)' }}></div>
                          <div className="dj-knob-mark" style={{ transform: 'rotate(240deg)' }}></div>
                        </div>
                      </div>
                      <div className="dj-knob-selector-horizontal">
                        <button
                          className={`dj-knob-btn-small ${matchingSettings.keyStrictness === 'strict' ? 'active' : ''}`}
                          onClick={() => setMatchingSettings({ ...matchingSettings, keyStrictness: 'strict' })}
                        >
                          S
                        </button>
                        <button
                          className={`dj-knob-btn-small ${matchingSettings.keyStrictness === 'normal' ? 'active' : ''}`}
                          onClick={() => setMatchingSettings({ ...matchingSettings, keyStrictness: 'normal' })}
                        >
                          N
                        </button>
                        <button
                          className={`dj-knob-btn-small ${matchingSettings.keyStrictness === 'loose' ? 'active' : ''}`}
                          onClick={() => setMatchingSettings({ ...matchingSettings, keyStrictness: 'loose' })}
                        >
                          L
                        </button>
                      </div>
                      {selectedSeedTrack?.getsongbpm?.key && (() => {
                        const seedKey = getCamelotKey(selectedSeedTrack.getsongbpm.key);
                        let keyInfo = '';
                        if (matchingSettings.keyStrictness === 'strict') {
                          keyInfo = `Only ${seedKey}`;
                        } else if (matchingSettings.keyStrictness === 'normal') {
                          const compatible = getCompatibleCamelotKeys(seedKey);
                          keyInfo = compatible.length > 1 ? compatible.join(', ') : seedKey;
                        } else {
                          keyInfo = 'Any key';
                        }
                        return <div className="dj-criteria-display">{keyInfo}</div>;
                      })()}
                    </div>

                    {/* BPM Tolerance - Rotary Knob */}
                    <div className="dj-channel">
                      <label className="dj-channel-label">BPM</label>
                      <div className="dj-rotary-knob">
                        <div
                          className="dj-knob-dial"
                          style={{ transform: `rotate(${(matchingSettings.bpmTolerance / 20) * 270 - 135}deg)` }}
                        >
                          <div className="dj-knob-indicator"></div>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={matchingSettings.bpmTolerance}
                          onChange={(e) => setMatchingSettings({ ...matchingSettings, bpmTolerance: parseInt(e.target.value) })}
                          className="dj-knob-input"
                        />
                      </div>
                      <div className="dj-knob-value-display">{matchingSettings.bpmTolerance}</div>
                      {selectedSeedTrack?.getsongbpm?.bpm && (() => {
                        const seedBPM = selectedSeedTrack.getsongbpm.bpm;
                        const minBPM = Math.round(seedBPM - matchingSettings.bpmTolerance);
                        const maxBPM = Math.round(seedBPM + matchingSettings.bpmTolerance);
                        return <div className="dj-criteria-display">{minBPM}-{maxBPM} BPM</div>;
                      })()}
                    </div>

                    {/* Danceability - Rotary Knob */}
                    <div className="dj-channel">
                      <label className="dj-channel-label">DANCE</label>
                      <div className="dj-rotary-knob">
                        <div
                          className="dj-knob-dial"
                          style={{ transform: `rotate(${(matchingSettings.danceabilityTolerance / 50) * 270 - 135}deg)` }}
                        >
                          <div className="dj-knob-indicator"></div>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={matchingSettings.danceabilityTolerance}
                          onChange={(e) => setMatchingSettings({ ...matchingSettings, danceabilityTolerance: parseInt(e.target.value) })}
                          className="dj-knob-input"
                        />
                      </div>
                      <div className="dj-knob-value-display">{matchingSettings.danceabilityTolerance}%</div>
                      {selectedSeedTrack?.getsongbpm?.danceability != null && (() => {
                        const seedDance = selectedSeedTrack.getsongbpm.danceability;
                        // Tolerance is in percentage points: 50% = ±25 percentage points
                        const tolerance = matchingSettings.danceabilityTolerance / 2;
                        const minDance = Math.max(0, Math.round(seedDance - tolerance));
                        const maxDance = Math.min(100, Math.round(seedDance + tolerance));
                        return <div className="dj-criteria-display">{minDance}-{maxDance}</div>;
                      })()}
                    </div>

                    {/* Acousticness - Rotary Knob */}
                    <div className="dj-channel">
                      <label className="dj-channel-label">ACOUSTIC</label>
                      <div className="dj-rotary-knob">
                        <div
                          className="dj-knob-dial"
                          style={{ transform: `rotate(${(matchingSettings.acousticnessTolerance / 50) * 270 - 135}deg)` }}
                        >
                          <div className="dj-knob-indicator"></div>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={matchingSettings.acousticnessTolerance}
                          onChange={(e) => setMatchingSettings({ ...matchingSettings, acousticnessTolerance: parseInt(e.target.value) })}
                          className="dj-knob-input"
                        />
                      </div>
                      <div className="dj-knob-value-display">{matchingSettings.acousticnessTolerance}%</div>
                      {selectedSeedTrack?.getsongbpm?.acousticness != null && (() => {
                        const seedAcoustic = selectedSeedTrack.getsongbpm.acousticness;
                        // Tolerance is in percentage points: 50% = ±25 percentage points
                        const tolerance = matchingSettings.acousticnessTolerance / 2;
                        const minAcoustic = Math.max(0, Math.round(seedAcoustic - tolerance));
                        const maxAcoustic = Math.min(100, Math.round(seedAcoustic + tolerance));
                        return <div className="dj-criteria-display">{minAcoustic}-{maxAcoustic}</div>;
                      })()}
                    </div>

                    {/* Genre/Style - Toggle Button */}
                    <div className="dj-channel">
                      <label className="dj-channel-label">GENRE</label>
                      <button
                        className={`dj-toggle-button ${matchingSettings.matchGenre ? 'active' : ''}`}
                        onClick={() => setMatchingSettings({ ...matchingSettings, matchGenre: !matchingSettings.matchGenre })}
                      >
                        <div className="dj-toggle-slider"></div>
                      </button>
                      <div className="dj-knob-value-display">{matchingSettings.matchGenre ? 'ON' : 'OFF'}</div>
                      {selectedSeedTrack?.record && (() => {
                        if (matchingSettings.matchGenre) {
                          const genres = selectedSeedTrack.record.genres || [];
                          const styles = selectedSeedTrack.record.styles || [];
                          const genreText = genres.length > 0 ? genres.join(', ') : '';
                          const styleText = styles.length > 0 ? styles.join(', ') : '';
                          const combined = [genreText, styleText].filter(Boolean).join(' / ');
                          return (
                            <div className="dj-criteria-display" title={combined}>
                              {combined || 'No genre/style'}
                            </div>
                          );
                        } else {
                          return <div className="dj-criteria-display">Any genre/style</div>;
                        }
                      })()}
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                      className="create-mix-btn"
                      onClick={handleGenerateMix}
                      disabled={isLoading || !selectedSeedTrack}
                      style={{ marginRight: '1rem' }}
                    >
                      {isLoading ? 'Rebuilding Mix...' : 'Rebuild Mix with New Settings'}
                    </button>
                  </div>
                </div>

                {/* Track List */}
                <div className="mix-creator-section">
                  <div className="tracks-list-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <h4 style={{ marginBottom: '1rem', color: 'white' }}>Mix Chain ({mixChain.length} tracks)</h4>
                    {mixChain.length === 0 ? (
                      <p style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>
                        No tracks in mix chain
                      </p>
                    ) : (
                      <div className="tracks-table">
                        <div className="tracks-table-header">
                          <div className="track-col-number">#</div>
                          <div className="track-col-play">Play</div>
                          <div className="track-col-title">Title</div>
                          <div className="track-col-artist">Artist</div>
                          <div className="track-col-album">Album</div>
                          <div className="track-col-genres">Genres</div>
                          <div className="track-col-bpm">BPM</div>
                          <div className="track-col-key">Key</div>
                          <div className="track-col-duration">Duration</div>
                          <div className="track-col-danceability">Dance</div>
                          <div className="track-col-acousticness">Acoustic</div>
                        </div>
                        <div className="tracks-table-body">
                          {mixChain.map((track, index) => {
                            const camelot = getCamelotKey(track.getsongbpm?.key);
                            const durationMs = parseDurationToMs(track.duration || track.duration_ms);

                            return (
                              <div
                                key={`mix-${index}-${track.spotify_id || track.id || 'unknown'}`}
                                className="track-row"
                              >
                                <div className="track-col-number">{index + 1}</div>
                                {track.spotify_id && onPlayTrack ? (
                                  <div className="track-col-play">
                                    <button
                                      className="track-play-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayTrack(track);
                                      }}
                                      aria-label="Play track"
                                      title="Play track"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="track-col-play"></div>
                                )}
                                <div className="track-col-title">{track.name || track.title || 'N/A'}</div>
                                <div className="track-col-artist">{track.artists || track.albumArtist || 'N/A'}</div>
                                <div className="track-col-album">{track.albumName || 'N/A'}</div>
                                <div className="track-col-genres">
                                  {track.record ? (() => {
                                    const genres = track.record.genres || [];
                                    const styles = track.record.styles || [];
                                    const genreText = genres.length > 0 ? genres.join(', ') : '';
                                    const styleText = styles.length > 0 ? styles.join(', ') : '';
                                    const combined = [genreText, styleText].filter(Boolean).join(' / ');
                                    return combined || 'N/A';
                                  })() : 'N/A'}
                                </div>
                                <div className="track-col-bpm">{track.getsongbpm?.bpm || 'N/A'}</div>
                                <div className="track-col-key">{camelot !== 'N/A' ? camelot : 'N/A'}</div>
                                <div className="track-col-duration">{formatDuration(durationMs)}</div>
                                <div className="track-col-danceability">{track.getsongbpm?.danceability ?? 'N/A'}</div>
                                <div className="track-col-acousticness">{track.getsongbpm?.acousticness ?? 'N/A'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {emailSent ? (
                  <div className="mix-creator-section">
                    <div className="mix-creator-auth" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
                      <h3 style={{ color: '#1db954', marginBottom: '1rem' }}>Email Sent!</h3>
                      <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1rem' }}>
                        We've sent a confirmation email to <strong>{email}</strong>
                      </p>
                      <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                        Please check your inbox and click the link to create your Spotify playlist.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mix-creator-section">
                      <h3>Share Your Mix</h3>
                      <p className="selection-info">
                        Enter your email address to receive a confirmation link. Once you click the link in the email,
                        your playlist will be created on Spotify and you'll be able to share it.
                      </p>
                      <div style={{ marginBottom: '1rem' }}>
                        <label htmlFor="share-email" style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                          Your Email Address
                        </label>
                        <input
                          id="share-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          className="playlist-name-input"
                          style={{ width: '100%' }}
                          disabled={isSharing}
                        />
                      </div>
                    </div>

                    <div className="mix-creator-actions">
                      <button
                        className="create-mix-btn"
                        onClick={shareMix}
                        disabled={isSharing || mixChain.length === 0 || !email || !email.includes('@')}
                      >
                        {isSharing ? 'Sending Email...' : 'Share the Playlist'}
                      </button>
                      <button className="cancel-btn" onClick={() => setStep(2)}>
                        Back
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {error && (
              <div className="mix-error">
                {error}
              </div>
            )}

          </>
        </motion.div>
      </motion.div>

      {/* Playlist Preview Modal - rendered via portal to document.body */}
      {createPortal(
        <AnimatePresence>
          {success && (
            <motion.div
              key="playlist-preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="playlist-preview-modal"
              onClick={(e) => {
                if (e.target.classList.contains('playlist-preview-modal')) {
                  setSuccess(null);
                }
              }}
            >
              <div className="playlist-preview-content" onClick={(e) => e.stopPropagation()}>
                <div className="playlist-preview-header">
                  <h2>🎉 Playlist Created!</h2>
                  <button
                    className="playlist-preview-close"
                    onClick={() => setSuccess(null)}
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                </div>

                <div className="playlist-preview-info">
                  <h3>{success?.name || 'Playlist'}</h3>
                  <p className="playlist-preview-meta">
                    {success?.trackCount || 0} tracks · {formatTotalDuration(success?.tracks || mixChain)}
                  </p>
                </div>

                <div className="playlist-preview-link-section">
                  <div className="playlist-link-container">
                    <input
                      type="text"
                      readOnly
                      value={success?.url || ''}
                      className="playlist-link-input"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      className="copy-link-btn"
                      onClick={async (e) => {
                        try {
                          await navigator.clipboard.writeText(success?.url || '');
                          const btn = e.target;
                          const originalText = btn.textContent;
                          btn.textContent = '✓ Copied!';
                          setTimeout(() => {
                            btn.textContent = originalText;
                          }, 2000);
                        } catch (err) {
                          console.error('Failed to copy:', err);
                        }
                      }}
                    >
                      Copy Link
                    </button>
                  </div>
                  <a
                    href={success?.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="spotify-link-btn"
                  >
                    Open in Spotify →
                  </a>
                </div>

                <div className="playlist-preview-tracks">
                  <h4>Track List</h4>
                  <div className="playlist-tracks-list">
                    {(success?.tracks || mixChain || []).map((track, index) => {
                      const durationMs = parseDurationToMs(track.duration_ms || track.duration);
                      return (
                        <div key={`preview-${index}-${track.spotify_id || track.id || 'unknown'}`} className="playlist-track-item">
                          <div className="playlist-track-number">{index + 1}</div>
                          <div className="playlist-track-info">
                            <div className="playlist-track-title">{track.name || track.title || 'N/A'}</div>
                            <div className="playlist-track-artist">{track.artists || track.albumArtist || 'N/A'}</div>
                          </div>
                          <div className="playlist-track-duration">{formatDuration(durationMs)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default MixCreator;
