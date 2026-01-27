import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Song } from '@/types';

export interface PlaybackState {
  queue: Song[];
  originalQueue: Song[] | null;
  currentIndex: number;
  repeatOn: boolean;
  shuffleOn: boolean;
  lastSavedAt: number;
}

const initialState: PlaybackState = {
  queue: [],
  originalQueue: null,
  currentIndex: 0,
  repeatOn: false,
  shuffleOn: false,
  lastSavedAt: 0,
};

const playbackSlice = createSlice({
  name: 'playback',
  initialState,
  reducers: {
    setQueue: (state, action: PayloadAction<Song[]>) => {
      state.queue = action.payload;
      state.lastSavedAt = Date.now();
    },
    setOriginalQueue: (state, action: PayloadAction<Song[] | null>) => {
      state.originalQueue = action.payload;
      state.lastSavedAt = Date.now();
    },
    setCurrentIndex: (state, action: PayloadAction<number>) => {
      state.currentIndex = action.payload;
      state.lastSavedAt = Date.now();
    },
    setRepeatOn: (state, action: PayloadAction<boolean>) => {
      state.repeatOn = action.payload;
      state.lastSavedAt = Date.now();
    },
    setShuffleOn: (state, action: PayloadAction<boolean>) => {
      state.shuffleOn = action.payload;
      state.lastSavedAt = Date.now();
    },
    updatePlaybackState: (
      state,
      action: PayloadAction<{
        queue?: Song[];
        originalQueue?: Song[] | null;
        currentIndex?: number;
        repeatOn?: boolean;
        shuffleOn?: boolean;
      }>
    ) => {
      if (action.payload.queue !== undefined) {
        state.queue = action.payload.queue;
      }
      if (action.payload.originalQueue !== undefined) {
        state.originalQueue = action.payload.originalQueue;
      }
      if (action.payload.currentIndex !== undefined) {
        state.currentIndex = action.payload.currentIndex;
      }
      if (action.payload.repeatOn !== undefined) {
        state.repeatOn = action.payload.repeatOn;
      }
      if (action.payload.shuffleOn !== undefined) {
        state.shuffleOn = action.payload.shuffleOn;
      }
      state.lastSavedAt = Date.now();
    },
    clearPlaybackState: (state) => {
      state.queue = [];
      state.originalQueue = null;
      state.currentIndex = 0;
      state.repeatOn = false;
      state.shuffleOn = false;
      state.lastSavedAt = Date.now();
    },
  },
});

export const {
  setQueue,
  setOriginalQueue,
  setCurrentIndex,
  setRepeatOn,
  setShuffleOn,
  updatePlaybackState,
  clearPlaybackState,
} = playbackSlice.actions;

export default playbackSlice.reducer;
