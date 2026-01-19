/**
 * Location Type Definitions
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface LocationData {
  coordinate: Coordinate;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

