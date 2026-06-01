import { isAssignedRouteId } from '@/utils/helpers';

export type MapVehicleInfoContent = {
  vehicleId: string;
  routeLabel: string;
};

/** Vehicle ID + route label for the map info callout. */
export function formatMapVehicleInfo(vehicle: Record<string, unknown>): MapVehicleInfoContent {
  const vehicleId = String(
    vehicle.vehicleID ?? vehicle.vehicleNumber ?? vehicle.vehicleName ?? '—',
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
