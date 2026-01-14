import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import '../styles/MusicPlayer.css';

const MusicPlayer = ({ currentTrack, currentAlbum, onClose }) => {
  const [controller, setController] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const embedContainerRef = useRef(null); // Wrapper container div for the embed
  const scriptLoadedRef = useRef(false);
  const shouldAutoplayRef = useRef(false);
  const autoplayAttemptedRef = useRef(false);
  const iframeApiRef = useRef(null); // Store the IFrameAPI object from the callback
  const controllerRef = useRef(null); // Store controller for cleanup
  const requestIdRef = useRef(0); // Monotonic id to ignore stale async callbacks (StrictMode-safe)
  const isReadyRef = useRef(false); // Track if controller is ready (for cleanup)

  if (!currentTrack && !currentAlbum) return null;

  const spotifyId = currentTrack?.spotify_id || currentAlbum?.spotify_id;
  const title = currentTrack?.title || currentTrack?.name || currentAlbum?.title;
  const artist = currentTrack?.albumArtist || currentTrack?.artists || currentAlbum?.artists;
  const coverImage = currentTrack?.record?.cover_image || currentAlbum?.cover_image;
  const isTrack = !!currentTrack;

  if (!spotifyId) return null;

  // Load Spotify iFrame API script using the callback pattern
  useEffect(() => {
    // Check if API is already available (from previous load)
    if (iframeApiRef.current) {
      scriptLoadedRef.current = true;
      setApiReady(true);
      return;
    }

    // Check if API is already stored globally (from previous component instance)
    if (window.__spotifyIframeAPI) {
      iframeApiRef.current = window.__spotifyIframeAPI;
      scriptLoadedRef.current = true;
      setApiReady(true);
      return;
    }

    if (scriptLoadedRef.current) {
      // Set up callback in case script loads while we're waiting
      if (!window.onSpotifyIframeApiReady) {
        window.onSpotifyIframeApiReady = (IFrameAPI) => {
          iframeApiRef.current = IFrameAPI;
          scriptLoadedRef.current = true;
          setApiReady(true);
        };
      }
      return;
    }

    // Define the callback BEFORE loading the script
    // This function will be called by the Spotify script when it's ready
    // Store it globally so other component instances can use it
    if (!window.onSpotifyIframeApiReady) {
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        // Store globally so other component instances can use it
        window.__spotifyIframeAPI = IFrameAPI;
        // Also store in current instance
        if (iframeApiRef.current === null) {
          iframeApiRef.current = IFrameAPI;
          scriptLoadedRef.current = true;
          setApiReady(true); // Trigger controller initialization
        }
      };
    } else {
      // Callback already exists, check if API is available
      if (window.__spotifyIframeAPI) {
        iframeApiRef.current = window.__spotifyIframeAPI;
        scriptLoadedRef.current = true;
        setApiReady(true);
        return;
      }
    }

    scriptLoadedRef.current = true; // Set immediately to prevent multiple loads

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (existingScript) {
      // If script is loaded, the callback should have been called already
      // Check if we have the global API
      if (window.__spotifyIframeAPI) {
        iframeApiRef.current = window.__spotifyIframeAPI;
        scriptLoadedRef.current = true;
        setApiReady(true);
        return;
      }
      // Otherwise wait a bit for the callback
      const checkInterval = setInterval(() => {
        if (window.__spotifyIframeAPI) {
          iframeApiRef.current = window.__spotifyIframeAPI;
          scriptLoadedRef.current = true;
          setApiReady(true);
          clearInterval(checkInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 2000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;

    script.onload = () => {
      // The callback will be called by Spotify's script
    };

    script.onerror = () => {
      console.error('[MusicPlayer] Failed to load Spotify iFrame API script');
      scriptLoadedRef.current = false; // Allow retry
      delete window.onSpotifyIframeApiReady; // Clean up callback
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it's shared across instances
      // Don't delete the callback either - other instances might need it
    };
  }, []);

  // Create / replace the embed controller when spotifyId changes (single source of truth).
  // This avoids races between "reset" and "create" effects (especially in React StrictMode).
  useEffect(() => {
    if (!apiReady || !iframeApiRef.current) return;
    if (!spotifyId) return;
    if (!embedContainerRef.current) return;

    const reqId = ++requestIdRef.current;
    const IFrameAPI = iframeApiRef.current;
    const wrapper = embedContainerRef.current;
    const spotifyUri = isTrack ? `spotify:track:${spotifyId}` : `spotify:album:${spotifyId}`;

    // Reset local state for the new item
    shouldAutoplayRef.current = true;
    autoplayAttemptedRef.current = false;
    setIsReady(false);
    isReadyRef.current = false;
    setIsPlaying(false);
    setController(null);

    // Detach previous controller (don't pause - new iframe will replace it)
    const prevController = controllerRef.current;
    if (prevController) {
      // Just remove listeners - don't pause, as the iframe is being replaced
      try {
        prevController.removeListener?.('ready');
        prevController.removeListener?.('playback_update');
        prevController.removeListener?.('error');
      } catch { }
    }
    controllerRef.current = null;

    // Replace embed DOM with a fresh element each time.
    // This avoids edge cases where Spotify's internal embed wiring "sticks" to the prior element.
    wrapper.innerHTML = '';
    const mountEl = document.createElement('div');
    mountEl.style.width = '100%';
    mountEl.style.height = '80px';
    wrapper.appendChild(mountEl);

    let cancelled = false;

    try {
      IFrameAPI.createController(
        mountEl,
        { uri: spotifyUri, width: '100%', height: '80', theme: 0 },
        (embedController) => {
          // Ignore stale callbacks (StrictMode / rapid switching safe)
          if (cancelled || reqId !== requestIdRef.current) {
            try { embedController.pause?.(); } catch { }
            return;
          }

          controllerRef.current = embedController;
          setController(embedController);

          // IMPORTANT: On fast switches, Spotify can fire "ready" before we attach the listener.
          // Treat "controller created" as ready-enough so UI isn't stuck disabled.
          setIsReady(true);
          isReadyRef.current = true;

          // Autoplay immediately on controller creation (don't wait for ready event)
          if (shouldAutoplayRef.current && !autoplayAttemptedRef.current) {
            autoplayAttemptedRef.current = true;
            try {
              embedController.play();
            } catch (e) {
            }
          }

          const onReady = () => {
            if (cancelled || reqId !== requestIdRef.current) return;
            isReadyRef.current = true;

            if (shouldAutoplayRef.current && !autoplayAttemptedRef.current) {
              autoplayAttemptedRef.current = true;
              try {
                embedController.play();
              } catch (e) {
              }
            }
          };

          const onPlaybackUpdate = (e) => {
            if (cancelled || reqId !== requestIdRef.current) return;
            const data = e?.data;
            // Spotify iFrame API reports isPaused (not isPlaying)
            const playing = data?.isPaused === undefined ? !!data?.isPlaying : !data.isPaused;
            setIsPlaying(playing);
          };

          const onError = (e) => {
            if (cancelled || reqId !== requestIdRef.current) return;
            console.error('[MusicPlayer] Spotify embed error:', e);
          };

          try {
            embedController.addListener('ready', onReady);
            embedController.addListener('playback_update', onPlaybackUpdate);
            embedController.addListener('error', onError);
          } catch (e) {
            console.error('[MusicPlayer] addListener failed:', e);
          }
        }
      );
    } catch (e) {
      console.error('[MusicPlayer] createController threw:', e);
    }

    return () => {
      cancelled = true;
      const c = controllerRef.current;
      if (c) {
        // Don't try to pause here - iframe is being replaced/destroyed
        // Just clean up listeners. The browser will stop playback when iframe is removed.
        try {
          c.removeListener?.('ready');
          c.removeListener?.('playback_update');
          c.removeListener?.('error');
        } catch {
          // Ignore errors during cleanup
        }
      }
      // Don't clear container here; next run will replace it.
    };
  }, [apiReady, spotifyId, isTrack]);

  // Try to play immediately if controller becomes ready and autoplay is enabled
  // This is a backup in case the ready event handler doesn't catch it
  useEffect(() => {
    if (controller && isReady && shouldAutoplayRef.current && !autoplayAttemptedRef.current) {
      autoplayAttemptedRef.current = true;

      const attemptPlay = () => {
        try {
          controller.play();
        } catch (error) {
          // Autoplay can be blocked by browser policy; user can click play manually.
        }
      };

      // Try immediately and with a small delay
      attemptPlay();
      setTimeout(attemptPlay, 100);
    }
  }, [controller, isReady]);

  // Cleanup on unmount or when track/album is cleared
  useEffect(() => {
    return () => {
      // Cleanup controller when component unmounts
      // Don't try to pause - iframe is being destroyed and browser will stop playback
      const c = controllerRef.current;
      if (c) {
        try {
          c.removeListener?.('ready');
          c.removeListener?.('playback_update');
          c.removeListener?.('error');
        } catch {
          // Ignore errors during cleanup
        }
        controllerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, []);

  const handlePlayPause = () => {
    if (!controller || !isReady) {
      return;
    }

    try {
      if (isPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
    } catch (error) {
      console.error('[MusicPlayer] Error controlling playback:', error);
    }
  };

  return (
    <motion.div
      className="music-player-dock"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="music-player-content">
        {/* Track/Album Info */}
        <div className="player-info">
          {coverImage && (
            <img src={coverImage} alt={title} className="player-cover" />
          )}
          <div className="player-details">
            <div className="player-title">{title}</div>
            <div className="player-artist">{artist}</div>
          </div>
        </div>

        {/* Custom Play/Pause Button */}
        <div className="player-controls">
          <button
            className={`player-play-pause-btn ${isPlaying ? 'playing' : ''}`}
            onClick={handlePlayPause}
            disabled={!controller}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={!controller ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Spotify Player Container */}
        <div className="player-embed">
          <div ref={embedContainerRef} style={{ width: '100%', height: '80px' }} />
        </div>

        {/* Close Button */}
        {onClose && (
          <button
            className="player-close-btn"
            onClick={() => {
              // Pause playback before closing (only if ready)
              const c = controllerRef.current;
              if (c && isReadyRef.current) {
                try {
                  c.pause?.();
                } catch (e) {
                  // Ignore errors - iframe might be unloading
                }
              }
              onClose();
            }}
            aria-label="Close player"
          >
            ✕
          </button>
        )}
      </div>

    </motion.div>
  );
};

export default MusicPlayer;
