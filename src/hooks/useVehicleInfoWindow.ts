import { useCallback, useEffect, useRef, useState } from 'react';
import { MAPS_CONFIG } from '@/config/maps.config';

const DISMISS_MS = MAPS_CONFIG.VEHICLE_INFO_WINDOW_DISMISS_MS ?? 10000;

/**
 * Vehicle info popup state — React overlay only (no native Map Callout).
 * Dismisses exactly once after DISMISS_MS unless the user taps close.
 */
export function useVehicleInfoWindow() {
  const [selectedVehicle, setSelectedVehicle] = useState<Record<string, unknown> | null>(
    null,
  );
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissVehicleInfo = useCallback(() => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setSelectedVehicle(null);
  }, []);

  const showVehicleInfo = useCallback((vehicle: Record<string, unknown>) => {
    if (dismissTimerRef.current != null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    setSelectedVehicle(vehicle);

    dismissTimerRef.current = setTimeout(() => {
      dismissTimerRef.current = null;
      setSelectedVehicle(null);
    }, DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (dismissTimerRef.current != null) {
        clearTimeout(dismissTimerRef.current);
      }
    },
    [],
  );

  const isVehicleSelected = useCallback(
    (vehicleId: string | number) =>
      selectedVehicle != null && String(selectedVehicle.vehicleID) === String(vehicleId),
    [selectedVehicle],
  );

  return {
    selectedVehicle,
    showVehicleInfo,
    dismissVehicleInfo,
    isVehicleInfoVisible: selectedVehicle != null,
    isVehicleSelected,
    dismissMs: DISMISS_MS,
  };
}
