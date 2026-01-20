/**
 * Redux Store Configuration
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth.slice';
import routeReducer from './slices/route.slice';
import passengerReducer from './slices/passenger.slice';
import messagingReducer from './slices/messaging.slice';
import settingsReducer from './slices/settings.slice';
import inspectionReducer from './slices/inspection.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    route: routeReducer,
    passenger: passengerReducer,
    messaging: messagingReducer,
    settings: settingsReducer,
    inspection: inspectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

