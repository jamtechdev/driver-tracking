import { useCallback, useMemo, useRef } from 'react';

type MarkerPressEvent = {
  nativeEvent?: {
    id?: string;
    identifier?: string;
  };
};

/**
 * Reliable vehicle marker taps: MapView.onMarkerPress + deduped Marker.onPress.
 * Custom marker views often miss the first tap when the marker remounts each blink tick.
 */
export function useMapVehicleMarkerPress(
  vehicles: Record<string, unknown>[],
  onVehiclePress: (vehicle: Record<string, unknown>) => void,
) {
  const vehicleById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const v of vehicles) {
      map.set(String(v.vehicleID), v);
    }
    return map;
  }, [vehicles]);

  const lastPressRef = useRef<{ id: string; at: number } | null>(null);

  const openVehicle = useCallback(
    (vehicle: Record<string, unknown>) => {
      const id = String(vehicle.vehicleID);
      const now = Date.now();
      const last = lastPressRef.current;
      if (last?.id === id && now - last.at < 350) {
        return;
      }
      lastPressRef.current = { id, at: now };
      onVehiclePress(vehicle);
    },
    [onVehiclePress],
  );

  const onMapMarkerPress = useCallback(
    (event: MarkerPressEvent) => {
      const rawId = event.nativeEvent?.id ?? event.nativeEvent?.identifier;
      if (rawId == null) return;
      const vehicle = vehicleById.get(String(rawId));
      if (vehicle) {
        openVehicle(vehicle);
      }
    },
    [vehicleById, openVehicle],
  );

  const onVehicleMarkerPress = useCallback(
    (vehicle: Record<string, unknown>) => {
      openVehicle(vehicle);
    },
    [openVehicle],
  );

  return { onMapMarkerPress, onVehicleMarkerPress };
}
