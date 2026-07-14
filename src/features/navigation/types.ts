/**
 * Mapbox turn-by-turn navigation types.
 */

export interface NavigationCoordinate {
  latitude: number;
  longitude: number;
}

export interface NavigationStop extends NavigationCoordinate {
  id: string;
  longName: string;
  link?: number;
  tripID?: number;
  blockID?: number;
  sequenceIndex: number;
}

export interface MapboxRouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinate: NavigationCoordinate;
  name?: string;
  modifier?: string;
  type?: string;
}

export interface MapboxNavigationRoute {
  coordinates: NavigationCoordinate[];
  steps: MapboxRouteStep[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export type NavigationStatus =
  | 'idle'
  | 'preparing'
  | 'navigating'
  | 'rerouting'
  | 'arriving'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface NavigationProgress {
  tripProgress: number;
  legProgress: number;
  remainingDistanceMeters: number;
  legRemainingDistanceMeters: number;
  distanceToCurrentStopMeters: number;
  remainingStopsCount: number;
  remainingDurationSeconds: number;
  legRemainingDurationSeconds: number;
  etaTimestamp: number | null;
  legEtaTimestamp: number | null;
  currentInstruction: string;
  distanceToNextManeuverMeters: number;
  currentManeuverType?: string;
  currentManeuverModifier?: string;
  currentStepIndex: number;
  routePolylineIndex: number;
}

export interface TurnByTurnNavigationState {
  status: NavigationStatus;
  stops: NavigationStop[];
  currentStopIndex: number;
  route: MapboxNavigationRoute | null;
  progress: NavigationProgress | null;
  errorMessage: string | null;
  isOffline: boolean;
}
