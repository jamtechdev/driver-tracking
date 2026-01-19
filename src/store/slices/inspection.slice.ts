/**
 * Inspection Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { InspectionForm, InspectionItem } from '@/api/inspection.api';

interface InspectionState {
  preTripForm: InspectionForm | null;
  postTripForm: InspectionForm | null;
  currentForm: InspectionForm | null;
  isLoading: boolean;
  error: string | null;
  isSubmitted: boolean;
}

const initialState: InspectionState = {
  preTripForm: null,
  postTripForm: null,
  currentForm: null,
  isLoading: false,
  error: null,
  isSubmitted: false,
};

const inspectionSlice = createSlice({
  name: 'inspection',
  initialState,
  reducers: {
    setPreTripForm: (state, action: PayloadAction<InspectionForm>) => {
      state.preTripForm = action.payload;
      state.currentForm = action.payload;
    },
    setPostTripForm: (state, action: PayloadAction<InspectionForm>) => {
      state.postTripForm = action.payload;
      state.currentForm = action.payload;
    },
    updateInspectionItem: (
      state,
      action: PayloadAction<{ itemId: string; updates: Partial<InspectionItem> }>
    ) => {
      if (state.currentForm) {
        const item = state.currentForm.items.find(
          (item) => item.id === action.payload.itemId
        );
        if (item) {
          Object.assign(item, action.payload.updates);
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSubmitted: (state, action: PayloadAction<boolean>) => {
      state.isSubmitted = action.payload;
    },
    resetInspection: (state) => {
      state.currentForm = null;
      state.isSubmitted = false;
      state.error = null;
    },
  },
});

export const {
  setPreTripForm,
  setPostTripForm,
  updateInspectionItem,
  setLoading,
  setError,
  setSubmitted,
  resetInspection,
} = inspectionSlice.actions;

export default inspectionSlice.reducer;

