import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import './AudioPlayer.css';
import { Mp3UploadService } from '../../services/mp3UploadService';

interface WebAudioTrack {
  id: string;
  name: string;
  audioBuffer: AudioBuffer;
  gainNode: GainNode;
  source: AudioBufferSourceNode | null;
  volume: number;
  isMuted: boolean;
}

interface AudioPlayerProps {
  title: string;
  contentType: 'single_track' | 'stem_group';
  mp3ContentId: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export interface AudioPlayerHandle {
  setVolume: (volume: number) => void;
  getVolume: () => number;
  playPause: () => void;
}

interface TrackState {
  audio: HTMLAudioElement;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(({ title, contentType, mp3ContentId, onError, onTimeUpdate, onDurationChange, onPlayStateChange }, ref) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tracks, setTracks] = useState<Map<string, TrackState>>(new Map());
  const [webAudioTracks, setWebAudioTracks] = useState<Map<string, WebAudioTrack>>(new Map());
  const [masterVolume, setMasterVolume] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackInfos, setTrackInfos] = useState<any[]>([]);
  const [currentContentId, setCurrentContentId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const uploadService = Mp3UploadService.getInstance();
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Initialize Web Audio API context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Load audio buffer from URL
  const loadAudioBuffer = useCallback(async (url: string): Promise<AudioBuffer> => {
    const audioContext = initAudioContext();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load audio buffer:', error);
      throw error;
    }
  }, [initAudioContext]);

  // Update current time for Web Audio API
  const updateCurrentTime = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return;

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const newCurrentTime = pauseTimeRef.current + elapsed;
    setCurrentTime(newCurrentTime);
    onTimeUpdate?.(newCurrentTime);

    animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
  }, [isPlaying, onTimeUpdate]);

  // Define volume control function
  const setVolumeImperative = useCallback((volume: number) => {
    setMasterVolume(volume);

    // Update HTML audio volumes for all tracks
    tracks.forEach((track) => {
      if (!track.isMuted) {
        track.audio.volume = (track.volume / 100) * (volume / 100);
      }
    });
  }, [tracks]);

  const loadTracks = useCallback(async () => {
    setIsLoading(true);

    // Only cleanup if we're loading different content
    if (currentContentId !== mp3ContentId) {
      // Cleanup HTML audio elements
      tracks.forEach(track => {
        track.audio.pause();
        track.audio.src = '';
      });
      setTracks(new Map());
      setIsPlaying(false);
      setCurrentContentId(mp3ContentId);
    }

    try {
      if (contentType === 'single_track') {
        // For single tracks, mp3ContentId is the track ID, we need to get the audio_file_id
        // Query the audio_tracks table to get the audio_file_id for this track
        const audioFileId = await uploadService.getAudioFileIdForTrack(mp3ContentId);

        // Load single audio file using the actual audio_file_id
        const audioUrl = await uploadService.getAudioUrl(audioFileId);
        const audio = new Audio(audioUrl);
        audio.preload = 'metadata';

        // Track this audio element
        audioElementsRef.current = [audio];

        const trackState: TrackState = {
          audio,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          volume: 100,
          isMuted: false
        };

        audio.addEventListener('loadedmetadata', () => {
          setTracks(new Map([['main', { ...trackState, duration: audio.duration }]]));
          onDurationChange?.(audio.duration);
        });

        audio.addEventListener('timeupdate', () => {
          setTracks(prev => new Map(prev.set('main', { ...prev.get('main')!, currentTime: audio.currentTime })));
          onTimeUpdate?.(audio.currentTime);
        });

        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setTracks(prev => new Map(prev.set('main', { ...prev.get('main')!, isPlaying: false })));
          onPlayStateChange?.(false);
        });

        setTrackInfos([{ id: 'main', track_name: title, track_type: 'full' }]);

      } else {
        // Load stem group tracks using optimized HTML5 Audio with better sync
        const stemTracks = await uploadService.getStemGroupTracks(mp3ContentId);
        const newTracks = new Map<string, TrackState>();
        const newAudioElements: HTMLAudioElement[] = [];

        // Pre-load all tracks before starting any
        const loadPromises = stemTracks.map(async (trackInfo) => {
          const audioUrl = await uploadService.getAudioUrl(trackInfo.audio_file_id, mp3ContentId);
          const audio = new Audio(audioUrl);
          audio.preload = 'auto'; // Force full preload

          // Track this audio element
          newAudioElements.push(audio);

          const trackState: TrackState = {
            audio,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            volume: trackInfo.volume,
            isMuted: trackInfo.is_muted
          };

          // Wait for track to be fully loaded
          return new Promise<void>((resolve) => {
            const onCanPlayThrough = () => {
              audio.removeEventListener('canplaythrough', onCanPlayThrough);
              newTracks.set(trackInfo.id, { ...trackState, duration: audio.duration });
              audio.volume = (trackInfo.volume / 100) * (masterVolume / 100);
              audio.muted = trackInfo.is_muted;

              console.log(`Pre-loaded track: ${trackInfo.track_name}, duration: ${audio.duration}s`);
              resolve();
            };

            audio.addEventListener('canplaythrough', onCanPlayThrough);
            audio.load(); // Start loading
          });
        });

        // Wait for all tracks to be fully loaded
        await Promise.all(loadPromises);

        // Add time update listeners after all tracks are loaded
        stemTracks.forEach((trackInfo) => {
          const trackState = newTracks.get(trackInfo.id)!;

          trackState.audio.addEventListener('timeupdate', () => {
            setTracks(prev => new Map(prev.set(trackInfo.id, {
              ...prev.get(trackInfo.id)!,
              currentTime: trackState.audio.currentTime
            })));

            // Use first track as time reference
            if (trackInfo === stemTracks[0]) {
              onTimeUpdate?.(trackState.audio.currentTime);
            }
          });
        });

        // Store all audio elements in ref
        audioElementsRef.current = newAudioElements;
        setTracks(newTracks);
        setTrackInfos(stemTracks);

        const maxDuration = Math.max(...Array.from(newTracks.values()).map(t => t.duration));
        onDurationChange?.(maxDuration);

        console.log(`Pre-loaded ${newTracks.size} stem tracks with enhanced HTML5 Audio`);
      }
    } catch (error) {
      console.error('Failed to load tracks:', error);
      onError?.(`Failed to load audio: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [contentType, mp3ContentId, uploadService]);

  useEffect(() => {
    loadTracks();

    // Cleanup when component unmounts or content changes
    return () => {
      // Stop via tracks state
      tracks.forEach((track) => {
        track.audio.pause();
        track.audio.src = '';
        track.audio.load(); // Force reload to clear any buffered data
      });

      // Also stop via direct ref access for any missed elements
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
        audio.load();
      });

      // Clear the ref
      audioElementsRef.current = [];
    };
  }, [contentType, mp3ContentId]); // Only reload when content actually changes

  // Enhanced sync check to prevent tracks from drifting apart
  useEffect(() => {
    if (!isPlaying || tracks.size <= 1) return;

    const syncInterval = setInterval(() => {
      const trackArray = Array.from(tracks.values());
      if (trackArray.length <= 1) return;

      const referenceTimes = trackArray.map((track, index) => ({
        index,
        time: track.audio.currentTime,
        readyState: track.audio.readyState
      }));

      // Only sync if all tracks are ready
      const allReady = referenceTimes.every(t => t.readyState >= 3); // HAVE_FUTURE_DATA
      if (!allReady) return;

      const times = referenceTimes.map(t => t.time);
      const maxDrift = Math.max(...times) - Math.min(...times);

      // Log drift for debugging
      if (maxDrift > 0.02) { // Log if drift > 20ms
        console.log('Track drift detected:', {
          maxDrift: (maxDrift * 1000).toFixed(1) + 'ms',
          times: times.map(t => t.toFixed(3))
        });
      }

      // If tracks have drifted more than 50ms apart, resync them
      if (maxDrift > 0.05) {
        const referenceTime = times[0]; // Use first track as reference
        console.log('🔄 Resyncing tracks - drift:', (maxDrift * 1000).toFixed(1) + 'ms');

        tracks.forEach((track, trackId) => {
          if (track.audio.currentTime !== referenceTime) {
            track.audio.currentTime = referenceTime;
          }
        });
      }
    }, 100); // Check every 100ms for tighter sync

    return () => clearInterval(syncInterval);
  }, [isPlaying, tracks]);

  const handlePlayPause = useCallback(() => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);

    if (newIsPlaying) {
      // Enhanced synchronization for multi-track playback
      console.log('Starting synchronized playback of', tracks.size, 'tracks');

      // Step 1: Sync all tracks to the same time position
      let referenceTime = 0;
      const firstTrack = tracks.values().next().value;
      if (firstTrack) {
        referenceTime = firstTrack.audio.currentTime;
      }

      // Step 2: Set all tracks to the same position
      tracks.forEach((track) => {
        track.audio.currentTime = referenceTime;
      });

      // Step 3: Start all tracks as close together as possible
      const playPromises: Promise<void>[] = [];
      tracks.forEach((track, trackId) => {
        const playPromise = track.audio.play().catch(error => {
          console.error(`Failed to play track ${trackId}:`, error);
          onError?.(`Failed to play audio: ${error}`);
        });

        if (playPromise) {
          playPromises.push(playPromise);
        }
      });

      // Step 4: Update state after all tracks start
      Promise.all(playPromises).then(() => {
        console.log('All tracks started successfully');
        const trackUpdates = new Map(tracks);
        tracks.forEach((track, trackId) => {
          trackUpdates.set(trackId, { ...track, isPlaying: newIsPlaying });
        });
        setTracks(trackUpdates);
        onPlayStateChange?.(true);
      });

    } else {
      // Pause all tracks simultaneously
      console.log('Pausing all tracks');
      tracks.forEach((track, trackId) => {
        track.audio.pause();
        setTracks(prev => new Map(prev.set(trackId, { ...prev.get(trackId)!, isPlaying: newIsPlaying })));
      });
      onPlayStateChange?.(false);
    }
  }, [isPlaying, tracks, onError, onPlayStateChange]);

  // Define playPause function for imperative handle
  const playPauseImperative = useCallback(() => {
    handlePlayPause();
  }, [handlePlayPause]);

  // Expose control methods via ref
  useImperativeHandle(ref, () => ({
    setVolume: setVolumeImperative,
    getVolume: () => masterVolume,
    playPause: playPauseImperative
  }), [masterVolume, setVolumeImperative, playPauseImperative]);

  // Immediate stop function that can be called externally
  const stopAllAudio = useCallback(() => {
    // Stop via tracks state
    tracks.forEach((track) => {
      track.audio.pause();
      track.audio.currentTime = 0;
    });

    // Also stop via direct ref access (more reliable)
    audioElementsRef.current.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });

    setIsPlaying(false);
  }, [tracks]);

  // Expose the stop function via a ref or global way if needed
  useEffect(() => {
    // Store stop function globally so it can be called from outside
    (window as any).stopAudioPlayer = stopAllAudio;
    return () => {
      delete (window as any).stopAudioPlayer;
    };
  }, [stopAllAudio]);

  const handleSeek = useCallback((newTime: number) => {
    console.log('Seeking all tracks to:', newTime);

    // Synchronize seek across all tracks
    const trackUpdates = new Map(tracks);

    tracks.forEach((track, trackId) => {
      track.audio.currentTime = newTime;
      trackUpdates.set(trackId, { ...track, currentTime: newTime });
    });

    // Update all tracks at once to maintain sync
    setTracks(trackUpdates);
  }, [tracks]);

  const handleVolumeChange = useCallback((trackId: string, newVolume: number) => {
    const track = tracks.get(trackId);
    if (!track) return;

    // Update HTML audio volume
    if (!track.isMuted) {
      track.audio.volume = (newVolume / 100) * (masterVolume / 100);
    }

    // Create a new track object to ensure React detects the state change
    const updatedTrack = { ...track, volume: newVolume };
    setTracks(prev => new Map(prev.set(trackId, updatedTrack)));

    // Update database
    if (contentType === 'stem_group') {
      uploadService.updateTrackSettings(trackId, { volume: newVolume });
    }
  }, [tracks, masterVolume, contentType, uploadService]);

  const handleMuteToggle = useCallback((trackId: string) => {
    const track = tracks.get(trackId);
    if (!track) return;

    const newMuted = !track.isMuted;
    track.audio.muted = newMuted;

    // If unmuting, restore volume; if muting, set to 0
    if (!newMuted) {
      track.audio.volume = (track.volume / 100) * (masterVolume / 100);
    }

    // Create a new track object to ensure React detects the state change
    const updatedTrack = { ...track, isMuted: newMuted };
    setTracks(prev => new Map(prev.set(trackId, updatedTrack)));

    // Update database
    if (contentType === 'stem_group') {
      uploadService.updateTrackSettings(trackId, { is_muted: newMuted });
    }
  }, [tracks, masterVolume, contentType, uploadService]);

  const handleMasterVolumeChange = useCallback((newMasterVolume: number) => {
    setMasterVolume(newMasterVolume);

    // Apply master volume to all tracks
    tracks.forEach((track) => {
      track.audio.volume = (track.volume / 100) * (newMasterVolume / 100);
    });
  }, [tracks]);

  // Get main track for progress/duration display
  const mainTrack = tracks.values().next().value;
  const displayCurrentTime = mainTrack?.currentTime || 0;
  const displayDuration = mainTrack?.duration || 0;

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="audio-player loading">
        <div className="player-header">
          <h3>🎵 {title}</h3>
          <p>Loading audio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <div className="player-header">
        <h3>🎵 {title}</h3>
        <span className="content-type-badge">
          {contentType === 'single_track' ? '📄 Single Track' : '🎛️ Multi-Track Stems'}
        </span>
      </div>

      {/* Main Controls */}
      <div className="main-controls">
        <button
          className="play-pause-btn"
          onClick={handlePlayPause}
          disabled={tracks.size === 0}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        <div className="time-display">
          {formatTime(displayCurrentTime)} / {formatTime(displayDuration)}
        </div>

        <input
          type="range"
          className="seek-bar"
          min={0}
          max={displayDuration || 0}
          value={displayCurrentTime}
          onChange={(e) => handleSeek(Number(e.target.value))}
          disabled={tracks.size === 0}
        />
      </div>

      {/* Master Volume (for multi-track) */}
      {contentType === 'stem_group' && (
        <div className="master-volume">
          <label>🎚️ Master Volume</label>
          <input
            type="range"
            min={0}
            max={100}
            value={masterVolume}
            onChange={(e) => handleMasterVolumeChange(Number(e.target.value))}
          />
          <span>{masterVolume}%</span>
        </div>
      )}

      {/* Individual Track Controls (for multi-track) */}
      {contentType === 'stem_group' && (
        <div className="track-controls">
          <h4>Individual Track Controls</h4>
          {trackInfos.map((trackInfo) => {
            const track = tracks.get(trackInfo.id);

            return (
              <div key={trackInfo.id} className="track-control">
                <div className="track-info">
                  <span className="track-name">{trackInfo.track_name}</span>
                  <button
                    className={`mute-btn ${track?.isMuted ? 'muted' : ''}`}
                    onClick={() => handleMuteToggle(trackInfo.id)}
                  >
                    {track?.isMuted ? '🔇' : '🔊'}
                  </button>
                </div>
                <div className="track-volume">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={track?.volume || 0}
                    onChange={(e) => handleVolumeChange(trackInfo.id, Number(e.target.value))}
                  />
                  <span>{track?.volume || 0}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});