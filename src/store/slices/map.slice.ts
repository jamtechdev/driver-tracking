/**
 * Map Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Coordinate } from '@/api/routes.api';

interface MapState {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  routeShape: Coordinate[];
  stops: Array<{
    id: string;
    coordinate: Coordinate;
    name: string;
  }>;
  vehiclePosition: Coordinate | null;
  isMapReady: boolean;
  showRoute: boolean;
  showStops: boolean;
}

const initialState: MapState = {
  region: {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  routeShape: [],
  stops: [],
  vehiclePosition: null,
  isMapReady: false,
  showRoute: true,
  showStops: true,
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setRegion: (
      state,
      action: PayloadAction<{
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
      }>
    ) => {
      state.region = {
        ...state.region,
        ...action.payload,
      };
    },
    setRouteShape: (state, action: PayloadAction<Coordinate[]>) => {
      state.routeShape = action.payload;
    },
    setStops: (
      state,
      action: PayloadAction<
        Array<{
          id: string;
          coordinate: Coordinate;
          name: string;
        }>
      >
    ) => {
      state.stops = action.payload;
    },
    setVehiclePosition: (state, action: PayloadAction<Coordinate>) => {
      state.vehiclePosition = action.payload;
    },
    setMapReady: (state, action: PayloadAction<boolean>) => {
      state.isMapReady = action.payload;
    },
    toggleRouteVisibility: (state) => {
      state.showRoute = !state.showRoute;
    },
    toggleStopsVisibility: (state) => {
      state.showStops = !state.showStops;
    },
    resetMap: (state) => {
      state.routeShape = [];
      state.stops = [];
      state.vehiclePosition = null;
    },
  },
});

export const {
  setRegion,
  setRouteShape,
  setStops,
  setVehiclePosition,
  setMapReady,
  toggleRouteVisibility,
  toggleStopsVisibility,
  resetMap,
} = mapSlice.actions;

export default mapSlice.reducer;

