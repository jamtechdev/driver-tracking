/**
 * Route Type Definitions
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Stop {
  id: string;
  name: string;
  sequence: number;
  coordinates: Coordinate;
  scheduledTime: string;
}

export interface Route {
  id: string;
  name: string;
  routeNumber: string;
  startTime: string;
  endTime: string;
  stops: Stop[];
  shape: Coordinate[];
}

