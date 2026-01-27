import { RootState } from '@/utils/redux/store';
import { PlaybackState } from '@/utils/redux/slices/playbackSlice';

export const selectPlaybackState = (state: RootState): PlaybackState =>
  state.playback;

export const selectQueue = (state: RootState) => state.playback.queue;

export const selectOriginalQueue = (state: RootState) =>
  state.playback.originalQueue;

export const selectCurrentIndex = (state: RootState) =>
  state.playback.currentIndex;

export const selectRepeatOn = (state: RootState) => state.playback.repeatOn;

export const selectShuffleOn = (state: RootState) => state.playback.shuffleOn;

export const selectLastSavedAt = (state: RootState) =>
  state.playback.lastSavedAt;
