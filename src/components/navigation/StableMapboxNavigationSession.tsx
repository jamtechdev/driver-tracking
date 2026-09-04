/**
 * Mounts native Mapbox Navigation once for the trip.
 * Session props are locked on first mount — stop advances must NOT remount the map
 * (that caused the flash/re-render after every arrival).
 */

import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapboxNavigation from '@pawan-pk/react-native-mapbox-navigation';
import type { NativeRouteProgress } from '@/hooks/useMapboxTurnByTurnNavigation';
import type { FrozenMapboxNativeSession } from '@/features/navigation/mapboxNativeRoute';
import { MAPBOX_CONFIG } from '@/config/mapbox.config';

export interface StableMapboxNavigationSessionProps {
  session: FrozenMapboxNativeSession;
  /** MapScreen polyline color — forwarded to native overview line. */
  routeColor?: string;
  onArrive: () => void;
  onRouteProgressChange: (progress: NativeRouteProgress) => void;
  onLocationChange?: (location: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    accuracy?: number;
  }) => void;
  onOffRoute?: (offRoute: boolean) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

function useStableHandler<T extends (...args: never[]) => void>(handler: T): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useMemo(
    () =>
      ((...args: Parameters<T>) => {
        handlerRef.current(...args);
      }) as T,
    [],
  );
}

function StableMapboxNavigationSessionComponent({
  session,
  routeColor: _routeColor,
  onArrive,
  onRouteProgressChange,
  onLocationChange,
  onOffRoute,
  onError,
  onCancel,
}: StableMapboxNavigationSessionProps) {
  const stableOnArrive = useStableHandler(onArrive);
  const stableOnProgress = useStableHandler(onRouteProgressChange);
  const stableOnLocation = useStableHandler(
    onLocationChange ??
      ((_: {
        latitude: number;
        longitude: number;
        heading?: number;
        speed?: number;
        accuracy?: number;
      }) => undefined),
  );
  const stableOnOffRoute = useStableHandler(onOffRoute ?? ((_: boolean) => undefined));
  const stableOnError = useStableHandler(onError);
  const stableOnCancel = useStableHandler(onCancel);

  // Lock the full-trip route on first mount — ignore later rematch prop churn.
  const lockedSessionRef = useRef(session);
  const overviewRef = useRef(session.overviewRouteCoordinates);
  if (!overviewRef.current && session.overviewRouteCoordinates?.length) {
    overviewRef.current = session.overviewRouteCoordinates;
  }
  const locked = lockedSessionRef.current;
  // Always use Google-nav light blue for the Mapbox overlay (not agency purple).
  const navLineColor = MAPBOX_CONFIG.ROUTE_LINE_COLOR;

  return (
    <MapboxNavigation
      style={styles.navigation}
      startOrigin={locked.startOrigin}
      destination={{
        latitude: locked.destination.latitude,
        longitude: locked.destination.longitude,
        title: locked.destination.title || `Stop ${locked.waypoints.length + 1}`,
      }}
      waypoints={locked.waypoints.map((wp, index) => ({
        ...wp,
        name: wp.name?.trim() || `Stop ${index + 1}`,
        separatesLegs: wp.separatesLegs !== false,
      }))}
      routeCoordinates={locked.routeCoordinates}
      {...({
        overviewRouteCoordinates: overviewRef.current ?? locked.overviewRouteCoordinates,
        routeColor: navLineColor,
      } as Record<string, unknown>)}
      distanceUnit="imperial"
      language="en"
      mute={true}
      showCancelButton={false}
      shouldSimulateRoute={false}
      hideStatusView={false}
      onArrive={stableOnArrive}
      onRouteProgressChange={stableOnProgress}
      onLocationChange={(location) => {
        if (
          location &&
          Number.isFinite(location.latitude) &&
          Number.isFinite(location.longitude)
        ) {
          const heading =
            typeof (location as { heading?: number }).heading === 'number'
              ? (location as { heading?: number }).heading
              : undefined;
          const accuracy =
            typeof (location as { accuracy?: number }).accuracy === 'number'
              ? (location as { accuracy?: number }).accuracy
              : undefined;
          const speed =
            typeof (location as { speed?: number }).speed === 'number'
              ? (location as { speed?: number }).speed
              : undefined;
          stableOnLocation({
            latitude: location.latitude,
            longitude: location.longitude,
            heading,
            speed,
            accuracy,
          });
        }
      }}
      onOffRoute={(event) => {
        stableOnOffRoute(Boolean(event?.offRoute));
      }}
      onError={(error) => {
        const message =
          error.message ??
          (error as { error?: string }).error ??
          'Mapbox navigation failed to start.';
        stableOnError(message);
      }}
      onCancelNavigation={stableOnCancel}
    />
  );
}

/** Always reuse the mounted native view for the lifetime of this component instance. */
export const StableMapboxNavigationSession = React.memo(
  StableMapboxNavigationSessionComponent,
  () => true,
);

const styles = StyleSheet.create({
  navigation: {
    flex: 1,
  },
});
