/**
 * GPS/Location Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface LocationState {
  currentLocation: Coordinate | null;
  isTracking: boolean;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  lastUpdate: string | null;
  error: string | null;
  isBackgroundMode: boolean;
}

const initialState: LocationState = {
  currentLocation: null,
  isTracking: false,
  accuracy: null,
  heading: null,
  speed: null,
  lastUpdate: null,
  error: null,
  isBackgroundMode: false,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation: (state, action: PayloadAction<Coordinate>) => {
      state.currentLocation = action.payload;
      state.lastUpdate = new Date().toISOString();
    },
    setLocationDetails: (
      state,
      action: PayloadAction<{
        coordinate: Coordinate;
        accuracy: number;
        heading?: number;
        speed?: number;
      }>
    ) => {
      state.currentLocation = action.payload.coordinate;
      state.accuracy = action.payload.accuracy;
      state.heading = action.payload.heading ?? null;
      state.speed = action.payload.speed ?? null;
      state.lastUpdate = new Date().toISOString();
    },
    startTracking: (state) => {
      state.isTracking = true;
      state.error = null;
    },
    stopTracking: (state) => {
      state.isTracking = false;
    },
    setBackgroundMode: (state, action: PayloadAction<boolean>) => {
      state.isBackgroundMode = action.payload;
    },
    setLocationError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isTracking = false;
    },
    clearLocationError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLocation,
  setLocationDetails,
  startTracking,
  stopTracking,
  setBackgroundMode,
  setLocationError,
  clearLocationError,
} = locationSlice.actions;

export default locationSlice.reducer;

