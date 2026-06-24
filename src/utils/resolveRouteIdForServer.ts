import { getAssignment } from '@/api/position.api';
import { getManifestsForToday } from '@/api/manifests.api';
import { getPrimaryRouteIdFromManifestJson } from '@/utils/manifestMap';
import { isAssignedRouteId } from '@/utils/helpers';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

/** Route ID to send on selfupdate when clearing driver (keeps route, drops driver). */
export async function resolveRouteIdForServer(params: {
  vehicleId: string;
  selectedRouteId: string | null;
  selectedManifestId: number | null;
}): Promise<string> {
  const { vehicleId, selectedRouteId, selectedManifestId } = params;

  if (isAssignedRouteId(selectedRouteId)) {
    return String(selectedRouteId);
  }

  if (selectedManifestId != null) {
    try {
      const manifests = await getManifestsForToday();
      const match = manifests.find((m) => m.manifestID === selectedManifestId);
      const blockRouteId = getPrimaryRouteIdFromManifestJson(match?.manifestJson);
      if (isAssignedRouteId(blockRouteId)) {
        return String(blockRouteId);
      }
    } catch {
      // fall through
    }
  }

  try {
    const assignment = await getAssignment(vehicleId, String(PEAK_DEFAULT_PARAMS.agencyID));
    const fromAssignment = assignment.currentRouteID ?? assignment.assignment?.routeID;
    if (isAssignedRouteId(fromAssignment)) {
      return String(fromAssignment);
    }
  } catch {
    // fall through
  }

  return '0';
}
