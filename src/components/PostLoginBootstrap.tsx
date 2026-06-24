/**
 * Runs driver-data, assignment, MDT, and vehicle telemetry APIs after login
 * (interactive or restored session).
 */

import { useEffect, useRef } from 'react';
import { usePeakApiEnabled } from '@/hooks/usePeakApiEnabled';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { useDriverData } from '@/context/DriverDataContext';
import { useDriverModel } from '@/context/DriverModelContext';
import { getManifestsForToday } from '@/api/manifests.api';

export function PostLoginBootstrap(): null {
  const apiEnabled = usePeakApiEnabled();
  const { isReady, isLoggedIn, agencyId, bootstrapKey } = useSession();
  const { refetch } = useDriverData();
  const {
    runPostLoginAuthBootstrap,
    syncAssignmentNow,
    isAssignmentBootstrapDone,
  } = useAuth();
  const { runPostLoginTelemetry } = useDriverModel();
  const handledDataBootstrapKeyRef = useRef(0);
  const handledTelemetryBootstrapKeyRef = useRef(0);

  const canBootstrap =
    apiEnabled && isReady && isLoggedIn && !!agencyId && bootstrapKey > 0;

  useEffect(() => {
    if (!canBootstrap) {
      return;
    }
    if (handledDataBootstrapKeyRef.current === bootstrapKey) {
      return;
    }
    handledDataBootstrapKeyRef.current = bootstrapKey;

    void (async () => {
      try {
        if (__DEV__) {
          console.log('[PostLoginBootstrap] data phase for agency', agencyId);
        }

        await refetch();
        await runPostLoginAuthBootstrap();
        syncAssignmentNow();

        try {
          await getManifestsForToday();
        } catch (e) {
          console.warn('[PostLoginBootstrap] manifest refresh failed:', e);
        }

        if (__DEV__) {
          console.log('[PostLoginBootstrap] data phase completed for agency', agencyId);
        }
      } catch (e) {
        console.warn('[PostLoginBootstrap] data phase failed:', e);
      }
    })();
  }, [
    canBootstrap,
    agencyId,
    bootstrapKey,
    refetch,
    runPostLoginAuthBootstrap,
    syncAssignmentNow,
  ]);

  useEffect(() => {
    if (!canBootstrap || !isAssignmentBootstrapDone) {
      return;
    }
    if (handledTelemetryBootstrapKeyRef.current === bootstrapKey) {
      return;
    }
    handledTelemetryBootstrapKeyRef.current = bootstrapKey;

    void (async () => {
      try {
        if (__DEV__) {
          console.log('[PostLoginBootstrap] telemetry phase for agency', agencyId);
        }

        await runPostLoginTelemetry();

        if (__DEV__) {
          console.log('[PostLoginBootstrap] telemetry phase completed for agency', agencyId);
        }
      } catch (e) {
        console.warn('[PostLoginBootstrap] telemetry phase failed:', e);
      }
    })();
  }, [
    canBootstrap,
    agencyId,
    bootstrapKey,
    isAssignmentBootstrapDone,
    runPostLoginTelemetry,
  ]);

  return null;
}

export default PostLoginBootstrap;
