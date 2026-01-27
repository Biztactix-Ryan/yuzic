import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from 'react';
import TrackPlayer, {
  Capability,
  State,
  usePlaybackState,
  RepeatMode,
  Event,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { PlaybackService } from '@/utils/track-player/PlaybackService';
import { Album, Playlist, Song } from '@/types';
import shuffleArray from '@/utils/shuffleArray';
import { useDownload } from '@/contexts/DownloadContext';
import { useApi } from '@/api';
import { buildCover } from '@/utils/builders/buildCover';
import { useDispatch, useSelector } from 'react-redux';
import { incrementPlay } from '@/utils/redux/slices/statsSlice';
import * as listenbrainz from '@/api/listenbrainz'
import { selectListenBrainzConfig } from '@/utils/redux/selectors/listenbrainzSelectors';
import { updatePlaybackState, clearPlaybackState } from '@/utils/redux/slices/playbackSlice';
import { selectPlaybackState } from '@/utils/redux/selectors/playbackSelectors';

TrackPlayer.registerPlaybackService(() => PlaybackService);

export interface PlayingContextType {
  currentSong: Song | null;
  isPlaying: boolean;

  pauseSong(): Promise<void>;
  resumeSong(): Promise<void>;

  playSong(song: Song): Promise<void>;
  playSongInCollection(
    selectedSong: Song,
    collection: Album | Playlist,
    shuffle?: boolean
  ): Promise<void>;

  addCollectionToQueue(collection: Album | Playlist): void;
  shuffleCollectionToQueue(collection: Album | Playlist): void;

  skipTo(index: number): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;

  getQueue(): Song[];
  resetQueue(): Promise<void>;

  moveTrack(fromIndex: number, toIndex: number): void;

  addToQueue(song: Song): void;
  playNext(song: Song): void;

  toggleShuffle(): Promise<void>;

  repeatOn: boolean;
  toggleRepeat(): void;

  shuffleOn: boolean;
  currentIndex: number;
  queueVersion: number;
  setCurrentSong(song: Song | null): void;
}

const PlayingContext = createContext<PlayingContextType | undefined>(undefined);

export const usePlaying = () => {
  const ctx = useContext(PlayingContext);
  if (!ctx) throw new Error('usePlaying must be used within PlayingProvider');
  return ctx;
};

export const PlayingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  const { getSongLocalUri } = useDownload();
  const dispatch = useDispatch();
  const listenBrainzConfig = useSelector(selectListenBrainzConfig);
  const persistedPlayback = useSelector(selectPlaybackState);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queueVersion, setQueueVersion] = useState(0);

  const queueRef = useRef<Song[]>([]);
  const originalQueueRef = useRef<Song[] | null>(null);
  const lastScrobbledIdRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);
  const playerSetupPromiseRef = useRef<Promise<void> | null>(null);

  const bumpQueue = () => setQueueVersion(v => v + 1);

  // Persist playback state to Redux whenever queue or settings change
  useEffect(() => {
    if (isRestoringRef.current) {
      console.log('[PlayingContext] Skipping save during restoration');
      return;
    }
    
    console.log('[PlayingContext] Saving playback state:', {
      queueLength: queueRef.current.length,
      currentIndex,
      repeatOn,
      shuffleOn,
    });
    
    dispatch(
      updatePlaybackState({
        queue: queueRef.current,
        originalQueue: originalQueueRef.current,
        currentIndex,
        repeatOn,
        shuffleOn,
      })
    );
  }, [queueVersion, currentIndex, repeatOn, shuffleOn, dispatch]);

  // Setup TrackPlayer once on mount
  useEffect(() => {
    if (playerSetupPromiseRef.current) return;

    const setupPlayer = async () => {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
        ],
      });
    };

    playerSetupPromiseRef.current = setupPlayer();
  }, []);

  // Restore playback state when persistedPlayback is rehydrated
  useEffect(() => {
    const restorePlaybackState = async () => {
      console.log('[PlayingContext] Restoration effect triggered', {
        hasRestored: hasRestoredRef.current,
        queueLength: persistedPlayback.queue.length,
        currentIndex: persistedPlayback.currentIndex,
        lastSavedAt: persistedPlayback.lastSavedAt,
      });

      // Only restore once successfully
      if (hasRestoredRef.current) {
        console.log('[PlayingContext] Already restored, skipping');
        return;
      }

      // Wait for player setup to complete
      if (playerSetupPromiseRef.current) {
        try {
          console.log('[PlayingContext] Waiting for player setup...');
          await playerSetupPromiseRef.current;
          console.log('[PlayingContext] Player setup complete');
        } catch (error) {
          console.warn('[PlayingContext] TrackPlayer setup failed:', error);
          return;
        }
      }

      isRestoringRef.current = true;
      
      try {
        const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
        const nativeQueue = await TrackPlayer.getQueue();
        console.log('[PlayingContext] Active track index:', activeTrackIndex, 'Native queue length:', nativeQueue.length);
        
        // Case 1: TrackPlayer has an active track (music playing in background)
        if (typeof activeTrackIndex === 'number') {
          const track = await TrackPlayer.getTrack(activeTrackIndex);
          console.log('[PlayingContext] Active track:', track?.id, track?.title);
          
          if (track && track.id) {
            // Check if we have persisted queue data
            if (persistedPlayback.queue.length > 0) {
              // Find the song in our persisted queue that matches the active track
              const matchingSong = persistedPlayback.queue.find(
                (song) => song.id === String(track.id)
              );
              
              console.log('[PlayingContext] Matching song found:', !!matchingSong);
              
              // Only restore if the playing track is from our app's queue
              if (matchingSong) {
                // Restore the full queue state from Redux
                queueRef.current = persistedPlayback.queue;
                originalQueueRef.current = persistedPlayback.originalQueue;
                
                // Find the current index in our queue
                const restoredIndex = persistedPlayback.queue.findIndex(
                  (song) => song.id === String(track.id)
                );
                
                // Use the found index, or fallback to persisted index with bounds check
                let indexToUse = restoredIndex >= 0 ? restoredIndex : persistedPlayback.currentIndex;
                // Ensure index is within bounds
                indexToUse = Math.max(0, Math.min(indexToUse, persistedPlayback.queue.length - 1));
                
                setCurrentIndex(indexToUse);
                setCurrentSong(matchingSong);
                setRepeatOn(persistedPlayback.repeatOn);
                setShuffleOn(persistedPlayback.shuffleOn);
                bumpQueue();
                
                hasRestoredRef.current = true;
                console.log('[PlayingContext] Restored queue with', queueRef.current.length, 'songs at index', indexToUse);
              } else {
                // Track is playing but not from our persisted queue - this is another app
                console.log('[PlayingContext] Track not in persisted queue, clearing saved state');
                dispatch(clearPlaybackState());
                hasRestoredRef.current = true;
              }
            } else {
              // No persisted queue but music is playing
              // This could mean: 1) Redux hasn't rehydrated yet, or 2) first time playing
              // Don't mark as restored yet so we can try again when Redux rehydrates
              console.log('[PlayingContext] No persisted queue yet, will retry when Redux rehydrates');
            }
          }
        } else {
          // Case 2: No active track (app was stopped/paused)
          if (persistedPlayback.queue.length > 0) {
            console.log('[PlayingContext] No active track, restoring persisted queue');
            // Restore the queue state so user can continue from where they left off
            queueRef.current = persistedPlayback.queue;
            originalQueueRef.current = persistedPlayback.originalQueue;
            
            // Ensure index is within bounds
            const indexToUse = Math.max(0, Math.min(persistedPlayback.currentIndex, persistedPlayback.queue.length - 1));
            
            setCurrentIndex(indexToUse);
            // Safe to access since indexToUse is guaranteed to be within bounds
            const restoredSong = persistedPlayback.queue[indexToUse];
            setCurrentSong(restoredSong || null);
            setRepeatOn(persistedPlayback.repeatOn);
            setShuffleOn(persistedPlayback.shuffleOn);
            bumpQueue();
            
            hasRestoredRef.current = true;
            console.log('[PlayingContext] Restored queue with', queueRef.current.length, 'songs at index', indexToUse);
          } else {
            // No active track and no persisted queue
            // Don't mark as restored in case Redux hasn't rehydrated yet
            console.log('[PlayingContext] No active track and no persisted queue - waiting for Redux rehydration');
          }
        }
        
        isRestoringRef.current = false;
      } catch (error) {
        isRestoringRef.current = false;
        console.warn('[PlayingContext] Could not restore playback state:', error);
      }
    };

    restorePlaybackState();
  }, [persistedPlayback, dispatch]);

  const scrobbleIfNeeded = async (song: Song | null) => {
    if (!song) return;
    if (lastScrobbledIdRef.current === song.id) return;
    if (!listenBrainzConfig?.token) return;

    const listenedAt = Math.floor(Date.now() / 1000);

    try {
      await listenbrainz.submitScrobble(
        listenBrainzConfig,
        {
          artist: song.artist,
          track: song.title,
          listenedAt
        },
      );

      lastScrobbledIdRef.current = song.id;
    } catch (err) {
      console.warn('ListenBrainz scrobble failed', err);
    }

    dispatch(
      incrementPlay({
        songId: song.id,
        albumId: song.albumId,
        artistId: song.artistId,
      })
    );
  };

  const loadAndPlay = async (song: Song) => {
    lastScrobbledIdRef.current = null;
    await TrackPlayer.reset();

    const url = (await getSongLocalUri(song.id)) ?? song.streamUrl;
    const cover = buildCover(song.cover, 'grid') || undefined;

    await TrackPlayer.add({
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: cover,
      url,
      duration: parseFloat(song.duration || '0'),
    });

    setCurrentSong(song);
    await TrackPlayer.play();
  };

  const appendNextIfNeeded = async (index: number) => {
    const next = queueRef.current[index + 1];
    if (!next) return;

    const nativeQueue = await TrackPlayer.getQueue();
    const alreadyQueued = nativeQueue.some(t => t.id === next.id);
    if (alreadyQueued) return;

    const url = (await getSongLocalUri(next.id)) ?? next.streamUrl;
    const cover = buildCover(next.cover, 'grid') || undefined;

    await TrackPlayer.add({
      id: next.id,
      title: next.title,
      artist: next.artist,
      artwork: cover,
      url,
      duration: parseFloat(next.duration || '0'),
    });
  };


  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged],
    async event => {
      if (!event.track) return;

      const prev = currentSong;
      if (prev) {
        await scrobbleIfNeeded(prev);
      }

      const trackId = event.track.id;
      const newIndex = queueRef.current.findIndex(s => s.id === trackId);
      if (newIndex === -1) return;

      setCurrentIndex(newIndex);
      setCurrentSong(queueRef.current[newIndex]);
      await appendNextIfNeeded(newIndex);
    }
  );

  useTrackPlayerEvents(
    [Event.RemoteNext, Event.RemotePrevious],
    async event => {
      if (event.type === Event.RemoteNext) await skipToNext();
      if (event.type === Event.RemotePrevious) await skipToPrevious();
    }
  );

  const playSong = async (song: Song) => {
    queueRef.current = [song];
    originalQueueRef.current = null;
    setShuffleOn(false);
    setCurrentIndex(0);
    bumpQueue();
    await loadAndPlay(song);
  };

  const playSongInCollection = async (
    selectedSong: Song,
    collection: Album | Playlist,
    shuffle = false
  ) => {
    let songs = [...collection.songs];
    let index = 0;

    if (shuffle) {
      originalQueueRef.current = songs;
      songs = shuffleArray(songs);
      // When shuffling, always start from the beginning of the shuffled array.
      // The selectedSong parameter is ignored to ensure true randomization.
      index = 0;
      setShuffleOn(true);
    } else {
      originalQueueRef.current = null;
      // When not shuffling, find the selected song's position
      index = songs.findIndex(s => s.id === selectedSong.id);
      setShuffleOn(false);
    }

    queueRef.current = songs;
    setCurrentIndex(index);
    bumpQueue();
    await loadAndPlay(songs[index]);
  };

  const addCollectionToQueue = (collection: Album | Playlist) => {
    const existingIds = new Set(queueRef.current.map(s => s.id));
    const toAdd = collection.songs.filter(s => !existingIds.has(s.id));
    if (!toAdd.length) return;
    queueRef.current = [...queueRef.current, ...toAdd];
    bumpQueue();
  };

  const shuffleCollectionToQueue = (collection: Album | Playlist) => {
    const existingIds = new Set(queueRef.current.map(s => s.id));
    const toAdd = shuffleArray(
      collection.songs.filter(s => !existingIds.has(s.id))
    );
    if (!toAdd.length) return;
    queueRef.current = [...queueRef.current, ...toAdd];
    bumpQueue();
  };

  const skipToNext = async () => {
    await scrobbleIfNeeded(currentSong);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= queueRef.current.length) {
      if (!repeatOn) return;
      setCurrentIndex(0);
      await loadAndPlay(queueRef.current[0]);
      return;
    }

    setCurrentIndex(nextIndex);
    await loadAndPlay(queueRef.current[nextIndex]);
  };

  const skipToPrevious = async () => {
    await scrobbleIfNeeded(currentSong);
    const prev = currentIndex - 1;
    if (prev < 0) return;
    setCurrentIndex(prev);
    await loadAndPlay(queueRef.current[prev]);
  };

  const skipTo = async (index: number) => {
    if (!queueRef.current[index]) return;
    setCurrentIndex(index);
    await loadAndPlay(queueRef.current[index]);
  };

  const pauseSong = async () => {
    await TrackPlayer.pause();
  };

  const resumeSong = async () => {
    await TrackPlayer.play();
  };

  const getQueue = () => [...queueRef.current];

  const moveTrack = (from: number, to: number) => {
    if (from === to) return;

    const q = [...queueRef.current];
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    queueRef.current = q;

    setCurrentIndex(prev => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });

    bumpQueue();
  };

  const addToQueue = (song: Song) => {
    if (queueRef.current.some(s => s.id === song.id)) return;
    queueRef.current = [...queueRef.current, song];
    bumpQueue();
  };

  const playNext = (song: Song) => {
    if (!currentSong) return;
    const q = queueRef.current.filter(s => s.id !== song.id);
    q.splice(currentIndex + 1, 0, song);
    queueRef.current = q;
    bumpQueue();
  };

  const toggleShuffle = async () => {
    if (!shuffleOn) {
      originalQueueRef.current = queueRef.current;
      const current = queueRef.current[currentIndex];
      const rest = queueRef.current.filter((_, i) => i !== currentIndex);
      queueRef.current = [current, ...shuffleArray(rest)];
      setCurrentIndex(0);
      setShuffleOn(true);
    } else if (originalQueueRef.current) {
      const original = originalQueueRef.current;
      const idx = original.findIndex(s => s.id === currentSong?.id);
      queueRef.current = original;
      setCurrentIndex(idx);
      setShuffleOn(false);
    }
    bumpQueue();
  };

  const toggleRepeat = () => {
    setRepeatOn(prev => !prev);
  };

  const resetQueue = async () => {
    await TrackPlayer.reset();
    queueRef.current = [];
    originalQueueRef.current = null;
    setCurrentIndex(0);
    setCurrentSong(null);
    setShuffleOn(false);
    setRepeatOn(false);
    bumpQueue();
  };

  return (
    <PlayingContext.Provider
      value={{
        currentSong,
        isPlaying,
        pauseSong,
        resumeSong,
        currentIndex,
        queueVersion,
        setCurrentSong,
        playSong,
        playSongInCollection,
        addCollectionToQueue,
        shuffleCollectionToQueue,
        skipToNext,
        skipToPrevious,
        getQueue,
        resetQueue,
        skipTo,
        toggleShuffle,
        repeatOn,
        toggleRepeat,
        shuffleOn,
        moveTrack,
        addToQueue,
        playNext,
      }}
    >
      {children}
    </PlayingContext.Provider>
  );
};