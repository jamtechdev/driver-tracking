/**
 * Passenger & Fare Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PassengerTally, FareType } from '@/api/passenger.api';

interface PassengerState {
  currentCount: number;
  tallies: PassengerTally[];
  fareTypes: FareType[];
  selectedFareType: FareType | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PassengerState = {
  currentCount: 0,
  tallies: [],
  fareTypes: [],
  selectedFareType: null,
  isLoading: false,
  error: null,
};

const passengerSlice = createSlice({
  name: 'passenger',
  initialState,
  reducers: {
    incrementPassenger: (state) => {
      state.currentCount += 1;
    },
    decrementPassenger: (state) => {
      if (state.currentCount > 0) {
        state.currentCount -= 1;
      }
    },
    setPassengerCount: (state, action: PayloadAction<number>) => {
      state.currentCount = Math.max(0, action.payload);
    },
    addTally: (state, action: PayloadAction<PassengerTally>) => {
      state.tallies.push(action.payload);
    },
    setFareTypes: (state, action: PayloadAction<FareType[]>) => {
      state.fareTypes = action.payload;
    },
    selectFareType: (state, action: PayloadAction<FareType | null>) => {
      state.selectedFareType = action.payload;
    },
    resetPassengerCount: (state) => {
      state.currentCount = 0;
      state.selectedFareType = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearTallies: (state) => {
      state.tallies = [];
      state.currentCount = 0;
    },
  },
});

export const {
  incrementPassenger,
  decrementPassenger,
  setPassengerCount,
  addTally,
  setFareTypes,
  selectFareType,
  resetPassengerCount,
  setLoading,
  setError,
  clearTallies,
} = passengerSlice.actions;

export default passengerSlice.reducer;

