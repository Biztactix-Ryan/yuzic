import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from '@react-native-async-storage/async-storage';

import serversReducer from './slices/serversSlice';
import lidarrReducer from './slices/lidarrSlice';
import settingsReducer from './slices/settingsSlice';
import downloadsReducer from './slices/downloadsSlice';
import listenbrainzReducer from './slices/listenbrainzSlice';
import statsReducer from './slices/statsSlice';
import playbackReducer from './slices/playbackSlice';

const serversPersistConfig = { key: 'servers', storage };
const lidarrPersistConfig = { key: 'lidarr', storage };
const settingsPersistConfig = { key: 'settings', storage };
const downloadsPersistConfig = { key: 'downloads', storage };
const listenbrainzPersistConfig = { key: 'listenbrainz', storage };
const statsPersistConfig = { key: 'stats', storage };
const playbackPersistConfig = { key: 'playback', storage };

export const rootReducer = combineReducers({
    servers: serversReducer,
    lidarr: lidarrReducer,
    settings: settingsReducer,
    downloads: downloadsReducer,
    listenbrainz: listenbrainzReducer,
    stats: statsReducer,
    playback: playbackReducer
});

const persistedReducer = combineReducers({
    servers: persistReducer(serversPersistConfig, serversReducer),
    lidarr: persistReducer(lidarrPersistConfig, lidarrReducer),
    settings: persistReducer(settingsPersistConfig, settingsReducer),
    downloads: persistReducer(downloadsPersistConfig, downloadsReducer),
    listenbrainz: persistReducer(listenbrainzPersistConfig, listenbrainzReducer),
    stats: persistReducer(statsPersistConfig, statsReducer),
    playback: persistReducer(playbackPersistConfig, playbackReducer)
});

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            immutableCheck: false,
            serializableCheck: false,
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;