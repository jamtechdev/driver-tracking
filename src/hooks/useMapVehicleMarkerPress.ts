import { useCallback, useMemo, useRef } from 'react';
import { isStopMarkerId } from '@/config/mapMarkers';
import { parseVehicleLatLng } from '@/utils/helpers';

type MarkerPressEvent = {
  nativeEvent?: {
    id?: string;
    identifier?: string;
    coordinate?: { latitude: number; longitude: number };
  };
};

const COORD_MATCH_EPS = 0.00015;

function findVehicleNearCoordinate(
  vehicles: Record<string, unknown>[],
  ownVehicle: Record<string, unknown> | null | undefined,
  deviceLocation: { latitude: number; longitude: number } | null | undefined,
  coordinate: { latitude: number; longitude: number },
): Record<string, unknown> | null {
  const candidates: Record<string, unknown>[] = [...vehicles];
  if (ownVehicle) {
    candidates.push(ownVehicle);
  }

  for (const vehicle of candidates) {
    const parsed = parseVehicleLatLng(vehicle);
    if (
      parsed &&
      Math.abs(parsed.lat - coordinate.latitude) < COORD_MATCH_EPS &&
      Math.abs(parsed.lng - coordinate.longitude) < COORD_MATCH_EPS
    ) {
      return vehicle;
    }
  }

  if (
    ownVehicle &&
    deviceLocation &&
    Math.abs(deviceLocation.latitude - coordinate.latitude) < COORD_MATCH_EPS &&
    Math.abs(deviceLocation.longitude - coordinate.longitude) < COORD_MATCH_EPS
  ) {
    return ownVehicle;
  }

  return null;
}

type UseMapVehicleMarkerPressOptions = {
  onStopMarkerPress?: () => void;
};

/**
 * Vehicle marker taps only — stop markers are ignored (they use native callouts).
 */
export function useMapVehicleMarkerPress(
  vehicles: Record<string, unknown>[],
  onVehiclePress: (vehicle: Record<string, unknown>) => void,
  ownVehicle?: Record<string, unknown> | null,
  deviceLocation?: { latitude: number; longitude: number } | null,
  options?: UseMapVehicleMarkerPressOptions,
) {
  const { onStopMarkerPress } = options ?? {};

  const vehicleById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const v of vehicles) {
      map.set(String(v.vehicleID), v);
    }
    if (ownVehicle?.vehicleID != null) {
      map.set(String(ownVehicle.vehicleID), ownVehicle);
    }
    return map;
  }, [vehicles, ownVehicle]);

  const lastPressRef = useRef<{ id: string; at: number } | null>(null);

  const openVehicle = useCallback(
    (vehicle: Record<string, unknown>) => {
      const id = String(vehicle.vehicleID);
      const now = Date.now();
      const last = lastPressRef.current;
      if (last?.id === id && now - last.at < 80) {
        return;
      }
      lastPressRef.current = { id, at: now };
      onVehiclePress(vehicle);
    },
    [onVehiclePress],
  );

  const onMapMarkerPress = useCallback(
    (event: MarkerPressEvent) => {
      const native = event.nativeEvent;
      const rawId = native?.identifier ?? native?.id;

      if (isStopMarkerId(rawId != null ? String(rawId) : null)) {
        onStopMarkerPress?.();
        return;
      }

      if (rawId != null) {
        const byId = vehicleById.get(String(rawId));
        if (byId) {
          openVehicle(byId);
          return;
        }
      }

      const coordinate = native?.coordinate;
      if (coordinate) {
        const byCoord = findVehicleNearCoordinate(
          vehicles,
          ownVehicle,
          deviceLocation,
          coordinate,
        );
        if (byCoord) {
          openVehicle(byCoord);
        }
      }
    },
    [vehicleById, openVehicle, vehicles, ownVehicle, deviceLocation, onStopMarkerPress],
  );

  const onVehicleMarkerPress = useCallback(
    (vehicle: Record<string, unknown>) => {
      openVehicle(vehicle);
    },
    [openVehicle],
  );

  return { onMapMarkerPress, onVehicleMarkerPress };
}
