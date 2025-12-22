import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const MixCreator = ({ records, onClose, onMixCreated }) => {
    const [step, setStep] = useState(1); // 1: Theme, 2: Duration, 3: Preview
    const [selectedTheme, setSelectedTheme] = useState(null);
    const [customName, setCustomName] = useState('');
    const [duration, setDuration] = useState(60); // minutes
    const [customDuration, setCustomDuration] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    
    // Track data
    const [allTracks, setAllTracks] = useState([]);
    const [tracksWithFeatures, setTracksWithFeatures] = useState([]);
    const [selectedTracks, setSelectedTracks] = useState([]);

    // Check for access token in URL or localStorage
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('access_token');
        const expiresIn = urlParams.get('expires_in');
        const spotifyAuth = urlParams.get('spotify_auth');
        
        if (token) {
            const expirationTime = Date.now() + (parseInt(expiresIn) * 1000);
            localStorage.setItem('spotify_access_token', token);
            localStorage.setItem('spotify_token_expires', expirationTime.toString());
            setAccessToken(token);
            setIsAuthenticating(false);
            
            setTimeout(() => {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }, 100);
        } else {
            const storedToken = localStorage.getItem('spotify_access_token');
            const expires = localStorage.getItem('spotify_token_expires');
            
            if (storedToken && expires) {
                const expirationTime = parseInt(expires);
                if (Date.now() < expirationTime) {
                    setAccessToken(storedToken);
                } else {
                    localStorage.removeItem('spotify_access_token');
                    localStorage.removeItem('spotify_token_expires');
                }
            }
            
            if (spotifyAuth === 'success' && !token) {
                setIsAuthenticating(false);
            }
        }
    }, []);

    const handleSpotifyAuth = () => {
        setIsAuthenticating(true);
        window.location.replace('/api/spotify-auth');
    };

    const filterRecordsByTheme = (theme) => {
        if (!theme) return records;
        
        const themeConfig = MIX_THEMES[theme];
        if (!themeConfig) return records;

        return records.filter(record => {
            if (!record.spotify_id) return false;
            
            const filters = themeConfig.filters;
            let matches = false;

            // Check genres (case-insensitive, partial match)
            if (filters.genres && record.genres) {
                const recordGenres = Array.isArray(record.genres) ? record.genres : [record.genres];
                matches = matches || filters.genres.some(g => 
                    recordGenres.some(rg => rg.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(rg.toLowerCase()))
                );
            }

            // Check styles (case-insensitive, partial match)
            if (filters.styles && record.styles) {
                const recordStyles = Array.isArray(record.styles) ? record.styles : [record.styles];
                matches = matches || filters.styles.some(s => 
                    recordStyles.some(rs => rs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(rs.toLowerCase()))
                );
            }

            // Check artists
            if (filters.artists) {
                matches = matches || filters.artists.some(a => 
                    record.artists.toLowerCase().includes(a.toLowerCase())
                );
            }

            // If no genre/style/artist filters, accept all records (for themes like "current selection")
            if (!filters.genres && !filters.styles && !filters.artists) {
                matches = true;
            }

            // Apply popularity filters only if we have a match
            if (matches) {
                if (filters.minPopularity && record.spotify_popularity !== undefined) {
                    matches = record.spotify_popularity >= filters.minPopularity;
                }
                if (filters.maxPopularity && record.spotify_popularity !== undefined) {
                    matches = matches && record.spotify_popularity <= filters.maxPopularity;
                }
            }

            return matches;
        });
    };

    // Select tracks based on duration
    const selectTracksByDuration = (tracks, targetDurationMs) => {
        // Shuffle tracks for variety
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        
        // Select tracks up to target duration
        const selected = [];
        let totalDuration = 0;
        
        for (const track of shuffled) {
            if (totalDuration + track.duration_ms <= targetDurationMs) {
                selected.push(track);
                totalDuration += track.duration_ms;
            }
        }
        
        return selected;
    };

    const handleGenerateTracks = async () => {
        if (!selectedTheme && !customName) {
            setError('Please select a theme or create a custom mix');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Get filtered records
            const filteredRecords = selectedTheme 
                ? filterRecordsByTheme(selectedTheme)
                : records.filter(r => r.spotify_id);

            console.log(`Filtered ${filteredRecords.length} records for theme: ${selectedTheme}`);
            
            if (filteredRecords.length === 0) {
                setError('No records match this theme. Try a different theme or use your current selection.');
                setIsLoading(false);
                return;
            }

            // Get album IDs
            const albumIds = filteredRecords.map(r => r.spotify_id).filter(Boolean);

            // Fetch tracks from albums
            const tracksResponse = await fetch('/api/spotify-get-tracks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumIds })
            });

            if (!tracksResponse.ok) {
                const errorData = await tracksResponse.json();
                throw new Error(errorData.error || 'Failed to fetch tracks');
            }

            const tracksData = await tracksResponse.json();
            const tracks = tracksData.tracks;

            console.log(`Fetched ${tracks.length} tracks from ${filteredRecords.length} albums`);

            if (tracks.length === 0) {
                setError('No tracks found for the selected albums');
                setIsLoading(false);
                return;
            }

            setAllTracks(tracks);

            // Select tracks based on duration
            const targetDurationMs = duration * 60 * 1000;
            const selected = selectTracksByDuration(tracks, targetDurationMs);
            
            if (selected.length === 0) {
                setError('No tracks could be selected. Try adjusting the duration or selecting a different theme.');
                setIsLoading(false);
                return;
            }

            setTracksWithFeatures(selected);
            setSelectedTracks(selected);
            setStep(3); // Move to preview step

        } catch (err) {
            console.error('Generate tracks error:', err);
            setError(err.message || 'Failed to generate tracks. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const createPlaylist = async () => {
        if (selectedTracks.length === 0) {
            setError('No tracks selected');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            const trackUris = selectedTracks.map(t => t.uri);

            const playlistName = customName || 
                `${MIX_THEMES[selectedTheme]?.name || 'Vinyl'} Mix - ${new Date().toLocaleDateString()}`;
            
            const description = selectedTheme 
                ? MIX_THEMES[selectedTheme].description 
                : `A custom mix from my vinyl collection (${selectedTracks.length} tracks)`;

            // Create new playlist
            const createResponse = await fetch('/api/spotify-create-playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken,
                    playlistName,
                    description,
                    trackUris
                })
            });

            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                throw new Error(errorData.error || 'Failed to create playlist');
            }

            const playlistData = await createResponse.json();

            setSuccess({
                name: playlistData.playlist.name,
                url: playlistData.playlist.url,
                trackCount: trackUris.length
            });

            if (onMixCreated) {
                onMixCreated(playlistData.playlist);
            }

        } catch (err) {
            console.error('Create playlist error:', err);
            setError(err.message || 'Failed to create playlist. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const formatDuration = (ms) => {
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

    const filteredCount = selectedTheme ? filterRecordsByTheme(selectedTheme).length : records.filter(r => r.spotify_id).length;

    return (
        <motion.div
            className="mix-creator-overlay"
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
                <p className="mix-creator-subtitle">
                    Generate an intelligent Spotify playlist from your vinyl collection
                </p>

                {/* Step indicator */}
                {accessToken && (
                    <div className="step-indicator">
                        <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Theme</div>
                        <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Duration</div>
                        <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Preview</div>
                    </div>
                )}

                {!accessToken ? (
                    <div className="mix-creator-auth">
                        <p>Connect to Spotify to create and save playlists</p>
                        <button
                            className="spotify-auth-btn"
                            onClick={handleSpotifyAuth}
                            disabled={isAuthenticating}
                        >
                            {isAuthenticating ? 'Connecting...' : 'Connect to Spotify'}
                        </button>
                        <p className="auth-note">
                            You'll be redirected to Spotify to authorize playlist creation
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Step 1: Theme Selection */}
                        {step === 1 && (
                            <>
                                <div className="mix-creator-section">
                                    <h3>Choose a Theme</h3>
                                    <div className="theme-grid">
                                        {Object.entries(MIX_THEMES).map(([key, theme]) => (
                                            <button
                                                key={key}
                                                className={`theme-card ${selectedTheme === key ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedTheme(key);
                                                    setCustomName('');
                                                }}
                                            >
                                                <div className="theme-name">{theme.name}</div>
                                                <div className="theme-description">{theme.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="mix-creator-section">
                                    <h3>Or Create from Current Selection</h3>
                                    <p className="selection-info">
                                        Create a mix from your currently filtered/viewed records
                                    </p>
                                    <button
                                        className={`theme-card ${!selectedTheme && customName ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedTheme(null);
                                            setCustomName(`My Vinyl Mix - ${new Date().toLocaleDateString()}`);
                                        }}
                                    >
                                        <div className="theme-name">Custom Mix</div>
                                        <div className="theme-description">Use your current selection</div>
                                    </button>
                                </div>

                                {(selectedTheme || customName) && (
                                    <div className="mix-creator-section">
                                        <label htmlFor="playlist-name">Playlist Name (optional)</label>
                                        <input
                                            id="playlist-name"
                                            type="text"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            placeholder={selectedTheme ? `${MIX_THEMES[selectedTheme].name} Mix` : 'My Vinyl Mix'}
                                            className="playlist-name-input"
                                        />
                                        <p className="mix-info">
                                            Will include tracks from <strong>{filteredCount}</strong> album{filteredCount !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                )}

                                <div className="mix-creator-actions">
                                    <button
                                        className="create-mix-btn"
                                        onClick={() => setStep(2)}
                                        disabled={!selectedTheme && !customName}
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
                                        onClick={handleGenerateTracks}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Analyzing Tracks...' : 'Generate Track List'}
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
                                    <h3>Track Preview</h3>
                                    <div className="playlist-summary">
                                        <p>
                                            <strong>{selectedTracks.length}</strong> tracks selected · 
                                            Total duration: <strong>{formatTotalDuration(selectedTracks)}</strong>
                                        </p>
                                    </div>

                                    <div className="tracks-list-container">
                                        <h4 style={{ marginBottom: '1rem', color: 'white' }}>Track List ({selectedTracks.length} tracks)</h4>
                                        <div className="tracks-list">
                                            {tracksWithFeatures.map((track, index) => (
                                                <div key={track.id} className="track-item">
                                                    <div className="track-header">
                                                        <div className="track-number">{index + 1}</div>
                                                        <div className="track-info">
                                                            <div className="track-name">{track.name}</div>
                                                            <div className="track-artist">{track.artists}</div>
                                                            <div className="track-album">{track.albumName}</div>
                                                        </div>
                                                        <div className="track-duration">{formatDuration(track.duration_ms)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mix-creator-actions">
                                    <button
                                        className="create-mix-btn"
                                        onClick={createPlaylist}
                                        disabled={isCreating}
                                    >
                                        {isCreating ? 'Creating Playlist...' : 'Create Playlist'}
                                    </button>
                                    <button className="cancel-btn" onClick={() => setStep(2)}>
                                        Back
                                    </button>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="mix-error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mix-success">
                                <h4>🎉 Playlist Created!</h4>
                                <p><strong>{success.name}</strong></p>
                                <p>{success.trackCount} tracks added</p>
                                <a
                                    href={success.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="spotify-link-btn"
                                >
                                    Open in Spotify
                                </a>
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};

export default MixCreator;
