/**
 * Types for iOS DirectionModel parity (PT Driver).
 */

export interface RouteLink {
  position: number;
  latitude: number;
  longitude: number;
  bearing: number;
  distanceMiles: number;
}

/** Schedule row as used by direction engine (maps API longName → stopName). */
export interface DirectionScheduleItem {
  blockID: string;
  link: number;
  calculatedArrivalTime: number;
  stopName: string;
  longName: string;
  unscheduled: boolean;
  tripID: number;
}

export interface ExpectedLink {
  link: number;
  calculatedArrivalTime: number;
  stopName: string;
  blockID: string;
}

export interface DirectionResult {
  atLink: number;
  nextStop: DirectionScheduleItem | null;
  nextScheduledStop: DirectionScheduleItem | null;
  minsLate: number;
  secondsToNextStop: number;
  expectedLink: number;
  expectedBlockID: string | null;
}

export interface RouteSchedulePayload {
  linkAverages: number[];
  totalRouteTime: number;
  schedule: DirectionScheduleItem[];
}
