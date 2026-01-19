/**
 * Route Assignment Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Route, RouteAssignment } from '@/api/routes.api';

interface RouteState {
  availableRoutes: Route[];
  assignedRoute: Route | null;
  assignment: RouteAssignment | null;
  isLoading: boolean;
  error: string | null;
  lastSync: string | null;
}

const initialState: RouteState = {
  availableRoutes: [],
  assignedRoute: null,
  assignment: null,
  isLoading: false,
  error: null,
  lastSync: null,
};

const routeSlice = createSlice({
  name: 'route',
  initialState,
  reducers: {
    fetchRoutesStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    fetchRoutesSuccess: (state, action: PayloadAction<Route[]>) => {
      state.isLoading = false;
      state.availableRoutes = action.payload;
      state.error = null;
    },
    fetchRoutesFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    assignRoute: (state, action: PayloadAction<{ route: Route; assignment: RouteAssignment }>) => {
      state.assignedRoute = action.payload.route;
      state.assignment = action.payload.assignment;
    },
    clearAssignedRoute: (state) => {
      state.assignedRoute = null;
      state.assignment = null;
    },
    syncSuccess: (state) => {
      state.lastSync = new Date().toISOString();
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  fetchRoutesStart,
  fetchRoutesSuccess,
  fetchRoutesFailure,
  assignRoute,
  clearAssignedRoute,
  syncSuccess,
  clearError,
} = routeSlice.actions;

export default routeSlice.reducer;

