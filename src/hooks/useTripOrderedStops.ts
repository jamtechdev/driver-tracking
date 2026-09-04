/**
 * Load ordered stops for Mapbox turn-by-turn from Peak stoptimes.
 *
 * Spec:
 * 1. Call stoptimes&action=list&agencyID=...&tripID=<assignedTripId>
 * 2. Sort rows by `sequence` ascending
 * 3. Extract stopIDs in that order → Mapbox navigation stop list
 *
 * Prefer the assigned tripID (block / schedule). Only if missing, discover a
 * tripID by overlapping route.routeStops against the agency stopTimes list,
 * then re-fetch with &tripID= for the authoritative ordered list.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  extractOrderedStopIdsFromStopTimes,
  getAgencyStopTimes,
  getStopTimesForTrip,
  resolveTripIdFromRouteStopIds,
} from '@/api/stopTimes.api';
import type { StopData } from '@/context/DriverDataContext';
import { orderStopsByRouteStopIds } from '@/features/navigation/navigationStopUtils';

export function useTripOrderedStops(params: {
  agencyID: string | null | undefined;
  /** Stop IDs from route.routeStops — used only to discover tripID when none assigned. */
  routeStopIds?: Array<string | number> | null;
  /**
   * Trip you are assigned to (block manifest or schedule nextStop.tripID).
   * Appended as &tripID= on the stoptimes list call.
   */
  assignedTripId?: string | number | null;
  allStops: StopData[];
}): {
  tripId: string | null;
  tripOrderedStopIds: Array<string | number>;
  tripOrderedStops: StopData[];
  isLoading: boolean;
} {
  const {
    agencyID,
    routeStopIds = null,
    assignedTripId = null,
    allStops,
  } = params;

  const [tripId, setTripId] = useState<string | null>(null);
  const [tripOrderedStopIds, setTripOrderedStopIds] = useState<Array<string | number>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const routeStopIdsKey = useMemo(
    () => (routeStopIds ?? []).map(String).join(','),
    [routeStopIds],
  );

  useEffect(() => {
    let cancelled = false;

    const explicitTrip =
      assignedTripId != null && String(assignedTripId).trim() !== ''
        ? String(assignedTripId)
        : null;

    if (!agencyID) {
      setTripId(null);
      setTripOrderedStopIds([]);
      setIsLoading(false);
      return;
    }

    const hasRouteStops = (routeStopIds ?? []).some((id) => {
      const key = String(id);
      return key && key !== '0';
    });

    if (!explicitTrip && !hasRouteStops) {
      setTripId(null);
      setTripOrderedStopIds([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void (async () => {
      try {
        let resolvedTripId = explicitTrip;

        // No assigned trip → discover from agency list + route stop overlap, then
        // always re-fetch with &tripID= so sequence order is authoritative.
        if (!resolvedTripId) {
          const agencyRows = await getAgencyStopTimes(agencyID);
          resolvedTripId = resolveTripIdFromRouteStopIds(routeStopIds, agencyRows);
          if (!resolvedTripId) {
            if (!cancelled) {
              setTripId(null);
              setTripOrderedStopIds([]);
            }
            return;
          }
        }

        const rows = await getStopTimesForTrip(agencyID, resolvedTripId);
        if (cancelled) return;

        const orderedIds = extractOrderedStopIdsFromStopTimes(rows);
        if (__DEV__) {
          console.log('[StopTimes→Mapbox]', {
            source: explicitTrip ? 'assignedTripId&tripID=' : 'discovered then &tripID=',
            tripId: resolvedTripId,
            stopCount: orderedIds.length,
            orderedStopIDs: orderedIds,
          });
        }
        setTripId(resolvedTripId);
        setTripOrderedStopIds(orderedIds);
      } catch (e) {
        console.warn('[useTripOrderedStops] Failed to load stopTimes:', e);
        if (!cancelled) {
          setTripId(null);
          setTripOrderedStopIds([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agencyID, assignedTripId, routeStopIdsKey]);

  const tripOrderedStops = useMemo(
    () => orderStopsByRouteStopIds(tripOrderedStopIds, allStops),
    [tripOrderedStopIds, allStops],
  );

  return {
    tripId,
    tripOrderedStopIds,
    tripOrderedStops,
    isLoading,
  };
}
