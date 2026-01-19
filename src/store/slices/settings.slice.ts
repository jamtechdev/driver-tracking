/**
 * Settings Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
  brightness: number;
  volume: number;
  timeFormat: '12h' | '24h';
  silentAlarmEnabled: boolean;
  gpsIndicatorVisible: boolean;
  vehicleAssignment: {
    vehicleId: string;
    vehicleNumber: string;
  } | null;
}

const initialState: SettingsState = {
  brightness: 100,
  volume: 50,
  timeFormat: '12h',
  silentAlarmEnabled: false,
  gpsIndicatorVisible: true,
  vehicleAssignment: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setBrightness: (state, action: PayloadAction<number>) => {
      state.brightness = Math.max(0, Math.min(100, action.payload));
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(100, action.payload));
    },
    setTimeFormat: (state, action: PayloadAction<'12h' | '24h'>) => {
      state.timeFormat = action.payload;
    },
    setSilentAlarm: (state, action: PayloadAction<boolean>) => {
      state.silentAlarmEnabled = action.payload;
    },
    setGPSIndicator: (state, action: PayloadAction<boolean>) => {
      state.gpsIndicatorVisible = action.payload;
    },
    setVehicleAssignment: (
      state,
      action: PayloadAction<{
        vehicleId: string;
        vehicleNumber: string;
      } | null>
    ) => {
      state.vehicleAssignment = action.payload;
    },
    resetSettings: (state) => {
      state.brightness = 100;
      state.volume = 50;
      state.timeFormat = '12h';
      state.silentAlarmEnabled = false;
    },
  },
});

export const {
  setBrightness,
  setVolume,
  setTimeFormat,
  setSilentAlarm,
  setGPSIndicator,
  setVehicleAssignment,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;

