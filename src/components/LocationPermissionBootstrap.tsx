/**
 * Requests location permission after splash / session bootstrap when the app UI is visible.
 */

import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { requestInitialAppLocationPermissions } from '@/utils/permissions';

interface LocationPermissionBootstrapProps {
  enabled: boolean;
}

export function LocationPermissionBootstrap({
  enabled,
}: LocationPermissionBootstrapProps): null {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || requestedRef.current) {
      return;
    }

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      requestedRef.current = true;
      void requestInitialAppLocationPermissions().catch((err) => {
        console.warn('[LocationPermissionBootstrap] failed:', err);
      });
    });

    return () => {
      interactionTask.cancel();
    };
  }, [enabled]);

  return null;
}

export default LocationPermissionBootstrap;
