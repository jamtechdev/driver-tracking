/**
 * Route Assignment API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';

export interface Route {
  id: string;
  name: string;
  routeNumber: string;
  startTime: string;
  endTime: string;
  stops: Stop[];
  shape: Coordinate[];
}

export interface Stop {
  id: string;
  name: string;
  sequence: number;
  coordinates: Coordinate;
  scheduledTime: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteAssignment {
  routeId: string;
  driverId: string;
  vehicleId?: string;
  assignedAt: string;
}

export const routesApi = {
  /**
   * Get all available routes
   */
  getAvailableRoutes: async (): Promise<Route[]> => {
    const response = await apiClient.get<Route[]>(API_ENDPOINTS.ROUTES.AVAILABLE);
    return response.data;
  },

  /**
   * Get all routes
   */
  getAllRoutes: async (): Promise<Route[]> => {
    const response = await apiClient.get<Route[]>(API_ENDPOINTS.ROUTES.LIST);
    return response.data;
  },

  /**
   * Get route details
   */
  getRouteDetails: async (routeId: string): Promise<Route> => {
    const response = await apiClient.get<Route>(API_ENDPOINTS.ROUTES.DETAILS(routeId));
    return response.data;
  },

  /**
   * Assign route to driver (self-dispatch)
   */
  assignRoute: async (routeId: string): Promise<RouteAssignment> => {
    const response = await apiClient.post<RouteAssignment>(
      API_ENDPOINTS.ROUTES.ASSIGN,
      { routeId }
    );
    return response.data;
  },

  /**
   * Sync route data with backend
   */
  syncRoutes: async (): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.ROUTES.SYNC);
  },
};

