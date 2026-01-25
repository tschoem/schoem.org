import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/MixConfirm.css';

const MixConfirm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate requests (React StrictMode runs effects twice in dev)
    if (hasRequestedRef.current) {
      return;
    }

    const confirmPlaylist = async () => {
      if (!token) {
        setError('Missing confirmation token');
        setIsLoading(false);
        return;
      }

      // Mark that we've made a request
      hasRequestedRef.current = true;

      // Clean the token - remove any unexpected suffixes (like :1 from React Router)
      // Also remove any non-hex characters to ensure we only have a valid hex token
      const cleanToken = token.split(':')[0].replace(/[^a-f0-9]/gi, '');
      console.log('Original token from URL:', token);
      console.log('Cleaned token:', cleanToken);
      
      if (cleanToken.length !== 32) {
        console.error('Invalid token length:', cleanToken.length, 'Expected 32');
        setError('Invalid confirmation token format');
        setIsLoading(false);
        return;
      }

      const apiUrl = `/api/confirm-mix?token=${encodeURIComponent(cleanToken)}`;
      console.log('Fetching from:', apiUrl);

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Error response:', errorData);
          throw new Error(errorData.error || 'Failed to confirm playlist');
        }

        const data = await response.json();
        console.log('Success! Playlist data:', data);
        setPlaylist(data.playlist);
      } catch (err) {
        console.error('Confirm playlist error:', err);
        setError(err.message || 'Failed to create playlist. The link may have expired.');
      } finally {
        setIsLoading(false);
      }
    };

    confirmPlaylist();
  }, [token]);

  const formatDuration = (ms) => {
    if (!ms || ms === 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (tracks) => {
    if (!tracks || tracks.length === 0) return '0m';
    const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="mix-confirm-container">
        <div className="mix-confirm-content">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Creating your playlist...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mix-confirm-container">
        <div className="mix-confirm-content">
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <h2>Oops!</h2>
            <p>{error}</p>
            <button className="back-button" onClick={() => navigate('/music')}>
              Back to Music
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return null;
  }

  return (
    <div className="mix-confirm-container">
      <div className="mix-confirm-content">
        <div className="success-state">
          <div className="success-icon">🎉</div>
          <h1>Playlist Created!</h1>
          <p className="success-message">
            Your mix has been successfully created on Spotify.
          </p>

          <div className="playlist-preview">
            <h2>{playlist.name}</h2>
            <p className="playlist-meta">
              {playlist.trackCount || 0} tracks · {formatTotalDuration(playlist.tracks || [])}
            </p>

            {playlist.tracks && playlist.tracks.length > 0 && (
              <div className="track-list">
                <h3>Track List</h3>
                <div className="tracks-scroll">
                  {playlist.tracks.map((track, index) => {
                    const durationMs = track.duration_ms || 0;
                    return (
                      <div key={`track-${index}-${track.spotify_id || track.id || 'unknown'}`} className="track-item">
                        <div className="track-number">{index + 1}</div>
                        <div className="track-info">
                          <div className="track-title">{track.name || track.title || 'N/A'}</div>
                          <div className="track-artist">{track.artists || track.albumArtist || 'N/A'}</div>
                        </div>
                        <div className="track-duration">{formatDuration(durationMs)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="playlist-actions">
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="spotify-link-btn"
              >
                Open in Spotify →
              </a>
              <button
                className="copy-link-btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(playlist.url);
                    const btn = document.querySelector('.copy-link-btn');
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
          </div>

          <div className="thank-you-message">
            <p>
              Thank you for creating this mix! Your musical journey through my collection 
              is a gift, and I'm excited to discover the tracks you've chosen.
            </p>
          </div>

          <button className="back-button" onClick={() => navigate('/music')}>
            Create Another Mix
          </button>
        </div>
      </div>
    </div>
  );
};

export default MixConfirm;
