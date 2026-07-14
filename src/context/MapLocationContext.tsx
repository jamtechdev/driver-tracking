import React, { createContext, useContext, useMemo } from 'react';
import type { GeolocationResponse } from '../services/location.service';
import { useDriverModel } from './DriverModelContext';

interface MapLocationContextType {
  location: GeolocationResponse | null;
  error: string | null;
  heading: number;
}

const MapLocationContext = createContext<MapLocationContextType | null>(null);

/**
 * Map UI reads the same GPS fix as DriverModel telemetry (single watch, no stale duplicate).
 */
export const MapLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lastLocation, locationError, isAcquiringSat } = useDriverModel();

  const location = useMemo<GeolocationResponse | null>(() => {
    if (!lastLocation) return null;
    return {
      latitude: lastLocation.latitude,
      longitude: lastLocation.longitude,
      accuracy: lastLocation.accuracy,
      heading: lastLocation.heading,
      speed: lastLocation.speed,
      altitude: lastLocation.altitude,
      timestamp: lastLocation.timestamp,
      receivedAt: lastLocation.receivedAt ?? Date.now(),
    };
  }, [lastLocation]);

  const heading = lastLocation?.heading ?? 0;
  const error =
    locationError ?? (isAcquiringSat ? 'Acquiring GPS signal…' : null);

  return (
    <MapLocationContext.Provider value={{ location, error, heading }}>
      {children}
    </MapLocationContext.Provider>
  );
};

export const useMapLocation = () => {
  const context = useContext(MapLocationContext);
  if (!context) {
    throw new Error('useMapLocation must be used within a MapLocationProvider');
  }
  return context;
};
