import { isAssignedRouteId } from '@/utils/helpers';

/** Stable vehicleID for the device GPS marker when no vehicle is assigned yet. */
export const TABLET_DEVICE_VEHICLE_ID = '__tablet_device__';

export type MapVehicleInfoContent = {
  vehicleId: string;
  routeLabel: string;
};

/** Vehicle ID + route label for the map info callout. */
export function formatMapVehicleInfo(vehicle: Record<string, unknown>): MapVehicleInfoContent {
  const vehicleId = String(
    vehicle.vehicleName ?? vehicle.vehicleID ?? vehicle.vehicleId ?? '—',
  );

  const routeShort = vehicle.routeShortName ?? vehicle.routeName;
  const routeId = vehicle.routeID ?? vehicle.routeId;

  let routeLabel = 'Out of Service';
  if (routeShort != null && String(routeShort).trim() !== '') {
    routeLabel = String(routeShort).trim();
  } else if (isAssignedRouteId(routeId)) {
    routeLabel = String(routeId);
  }

  return { vehicleId, routeLabel };
}

/** Map marker / info payload for the signed-in tablet (own vehicle). */
export function buildOwnMapVehicle(params: {
  vehicleId: string;
  vehicleName: string | null;
  routeId: string | null;
  routeShortName: string;
}): Record<string, unknown> {
  return {
    vehicleID: params.vehicleId,
    vehicleName: params.vehicleName ?? params.vehicleId,
    routeID: params.routeId ?? '0',
    routeShortName: params.routeShortName,
  };
}

export function isOwnTabletMapVehicle(
  vehicle: Record<string, unknown> | null | undefined,
  assignedVehicleId: string | null | undefined,
): boolean {
  if (!vehicle) return false;
  const selectedId = String(vehicle.vehicleID ?? '');
  if (assignedVehicleId != null && selectedId === String(assignedVehicleId)) {
    return true;
  }
  return selectedId === TABLET_DEVICE_VEHICLE_ID;
}
