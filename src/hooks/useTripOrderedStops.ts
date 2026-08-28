/**
 * Load ordered stops for Mapbox from stoptimes API (dynamic tripID).
 * tripID is resolved from stoptimes by matching the route's stopIDs — not from schedule.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  extractOrderedStopIdsFromStopTimes,
  getAgencyStopTimes,
  getStopTimesForTrip,
  resolveTripIdFromRouteStopIds,
  type StopTimeRow,
} from '@/api/stopTimes.api';
import type { StopData } from '@/context/DriverDataContext';
import { orderStopsByRouteStopIds } from '@/features/navigation/navigationStopUtils';

export function useTripOrderedStops(params: {
  agencyID: string | null | undefined;
  /** Stop IDs from route.routeStops — used to discover tripID in stoptimes. */
  routeStopIds?: Array<string | number> | null;
  /** Optional block-assigned trip; otherwise tripID comes from stoptimes match. */
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
        let rows: StopTimeRow[] = [];

        if (resolvedTripId) {
          rows = await getStopTimesForTrip(agencyID, resolvedTripId);
        } else {
          const agencyRows = await getAgencyStopTimes(agencyID);
          resolvedTripId = resolveTripIdFromRouteStopIds(routeStopIds, agencyRows);
          if (!resolvedTripId) {
            if (!cancelled) {
              setTripId(null);
              setTripOrderedStopIds([]);
            }
            return;
          }
          rows = agencyRows.filter((row) => String(row.tripID) === resolvedTripId);
          // Prefer a filtered trip request when cache overlap is thin.
          if (rows.length === 0) {
            rows = await getStopTimesForTrip(agencyID, resolvedTripId);
          }
        }

        if (cancelled) return;

        const orderedIds = extractOrderedStopIdsFromStopTimes(rows);
        if (__DEV__) {
          console.log('[StopTimes→Mapbox]', {
            source: explicitTrip ? 'assignedTripId' : 'stoptimes↔routeStops match',
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
