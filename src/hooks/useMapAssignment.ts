import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getManifestAssignmentsForToday,
  getManifestsForToday,
  type BlockManifest,
  type ManifestAssignment,
} from '@/api/manifests.api';
import { isAssignedRouteId } from '@/utils/helpers';
import {
  getPrimaryRouteIdFromManifestJson,
  getRouteIdsFromManifestJson,
  getAssignedTripIdFromManifestJson,
} from '@/utils/manifestMap';

export interface MapAssignmentContext {
  /** Route ID used for map polylines, stops, colors, and peer filtering. */
  effectiveRouteId: string | null;
  /** True when a route or block manifest resolves to a displayable route. */
  hasMapAssignment: boolean;
  /** Vehicle IDs assigned to the same block manifest today. */
  blockPeerVehicleIds: Set<string>;
  /** All route IDs referenced by the active block manifest. */
  blockRouteIds: string[];
  /** Assigned trip id from the active block (manifest trip `id`), when available. */
  assignedTripId: string | null;
}

const EMPTY_CONTEXT: MapAssignmentContext = {
  effectiveRouteId: null,
  hasMapAssignment: false,
  blockPeerVehicleIds: new Set(),
  blockRouteIds: [],
  assignedTripId: null,
};

/**
 * Resolves map display assignment from route ID or block manifest.
 * Block assignments store selectedRouteId as null but manifestJson contains trip routeIDs.
 */
export function useMapAssignment(): MapAssignmentContext {
  const { selectedRouteId, selectedManifestId } = useAuth();
  const [manifests, setManifests] = useState<BlockManifest[]>([]);
  const [manifestAssignments, setManifestAssignments] = useState<ManifestAssignment[]>([]);

  useEffect(() => {
    if (!selectedManifestId) {
      setManifests([]);
      setManifestAssignments([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [allManifests, assignments] = await Promise.all([
          getManifestsForToday(),
          getManifestAssignmentsForToday(),
        ]);
        if (!cancelled) {
          setManifests(allManifests);
          setManifestAssignments(assignments);
        }
      } catch (e) {
        console.warn('[useMapAssignment] Failed to load manifest data:', e);
        if (!cancelled) {
          setManifests([]);
          setManifestAssignments([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedManifestId]);

  return useMemo(() => {
    const manifest = selectedManifestId
      ? manifests.find((m) => m.manifestID === selectedManifestId)
      : undefined;

    const blockRouteIds = manifest
      ? getRouteIdsFromManifestJson(manifest.manifestJson)
      : [];
    const manifestRouteId = manifest
      ? getPrimaryRouteIdFromManifestJson(manifest.manifestJson)
      : null;

    // Route selection wins for map display; block still supplies tripID for stopTimes.
    const effectiveRouteId = isAssignedRouteId(selectedRouteId)
      ? String(selectedRouteId)
      : manifestRouteId;

    if (!isAssignedRouteId(effectiveRouteId) && !selectedManifestId) {
      return EMPTY_CONTEXT;
    }

    const assignedTripId = manifest
      ? getAssignedTripIdFromManifestJson(manifest.manifestJson, {
          routeId: effectiveRouteId,
        })
      : null;

    const blockPeerVehicleIds = new Set(
      manifestAssignments
        .filter((a) => a.manifestID === selectedManifestId && !a.disabled)
        .map((a) => String(a.vehicleID)),
    );

    return {
      effectiveRouteId: isAssignedRouteId(effectiveRouteId) ? String(effectiveRouteId) : null,
      hasMapAssignment: isAssignedRouteId(effectiveRouteId),
      blockPeerVehicleIds,
      blockRouteIds,
      assignedTripId,
    };
  }, [selectedRouteId, selectedManifestId, manifests, manifestAssignments]);
}
