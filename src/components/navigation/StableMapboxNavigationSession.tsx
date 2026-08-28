/**
 * Mounts native Mapbox Navigation once for the trip.
 * Per-leg TBT rematches in-place; full overview route line is drawn once and frozen.
 */

import React, { useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapboxNavigation from '@pawan-pk/react-native-mapbox-navigation';
import type { NativeRouteProgress } from '@/hooks/useMapboxTurnByTurnNavigation';
import type { FrozenMapboxNativeSession } from '@/features/navigation/mapboxNativeRoute';

export interface StableMapboxNavigationSessionProps {
  session: FrozenMapboxNativeSession;
  onArrive: () => void;
  onRouteProgressChange: (progress: NativeRouteProgress) => void;
  onLocationChange?: (location: { latitude: number; longitude: number }) => void;
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

function guidanceRouteKey(session: FrozenMapboxNativeSession): string {
  const dest = `${session.destination.latitude},${session.destination.longitude}`;
  const coords = session.routeCoordinates
    ?.map((c) => `${c.latitude},${c.longitude},${c.separatesLegs ? 1 : 0}`)
    .join(';');
  return `${session.startOrigin.latitude},${session.startOrigin.longitude}|${dest}|${coords ?? ''}`;
}

function StableMapboxNavigationSessionComponent({
  session,
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
    onLocationChange ?? ((_: { latitude: number; longitude: number }) => undefined),
  );
  const stableOnOffRoute = useStableHandler(onOffRoute ?? ((_: boolean) => undefined));
  const stableOnError = useStableHandler(onError);
  const stableOnCancel = useStableHandler(onCancel);

  // Freeze the full-trip overview line on first mount — never redraw stop-by-stop.
  const overviewRef = useRef(session.overviewRouteCoordinates);
  if (!overviewRef.current && session.overviewRouteCoordinates?.length) {
    overviewRef.current = session.overviewRouteCoordinates;
  }

  return (
    <MapboxNavigation
      style={styles.navigation}
      startOrigin={session.startOrigin}
      destination={session.destination}
      waypoints={session.waypoints}
      routeCoordinates={session.routeCoordinates}
      {...({
        overviewRouteCoordinates: overviewRef.current,
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
          stableOnLocation({
            latitude: location.latitude,
            longitude: location.longitude,
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

export const StableMapboxNavigationSession = React.memo(
  StableMapboxNavigationSessionComponent,
  (previous, next) => guidanceRouteKey(previous.session) === guidanceRouteKey(next.session),
);

const styles = StyleSheet.create({
  navigation: {
    flex: 1,
  },
});
