/**
 * Mounts native Mapbox Navigation once per session with frozen route props.
 * Parent re-renders (stop names, HUD, etc.) must not touch the native map.
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
  onArrive,
  onRouteProgressChange,
  onError,
  onCancel,
}: StableMapboxNavigationSessionProps) {
  const stableOnArrive = useStableHandler(onArrive);
  const stableOnProgress = useStableHandler(onRouteProgressChange);
  const stableOnError = useStableHandler(onError);
  const stableOnCancel = useStableHandler(onCancel);

  return (
    <MapboxNavigation
      style={styles.navigation}
      startOrigin={session.startOrigin}
      destination={session.destination}
      waypoints={session.waypoints}
      distanceUnit="metric"
      language="en"
      mute={false}
      showCancelButton={false}
      shouldSimulateRoute={false}
      hideStatusView={false}
      onArrive={stableOnArrive}
      onRouteProgressChange={stableOnProgress}
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
  (previous, next) => previous.session === next.session,
);

const styles = StyleSheet.create({
  navigation: {
    flex: 1,
  },
});
