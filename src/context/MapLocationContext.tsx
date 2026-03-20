import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { locationService, type GeolocationResponse } from '../services/location.service';
import { requestLocationPermission } from '../utils/permissions';

interface MapLocationContextType {
    location: GeolocationResponse | null;
    error: string | null;
    heading: number;
}

const MapLocationContext = createContext<MapLocationContextType | null>(null);

export const MapLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<GeolocationResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [heading, setHeading] = useState(0);
    const watchIdRef = useRef<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        const startTracking = async () => {
            const granted = await requestLocationPermission();
            if (!granted) {
                if (isMounted) setError('Location permission denied');
                return;
            }

            // Proactive initial fix
            try {
                const initial = await locationService.getCurrentLocation();
                if (isMounted) {
                    setLocation(initial);
                    if (initial.heading !== undefined) setHeading(initial.heading);
                }
            } catch (err: any) {
                if (isMounted) console.log('[MapLocation] Initial fix failed:', err.message);
            }

            // Start watching for real-time updates
            const watchId = locationService.watchPosition(
                (pos) => {
                    if (isMounted) {
                        setLocation(pos);
                        if (pos.heading !== undefined) setHeading(pos.heading);
                        setError(null);
                    }
                },
                (err) => {
                    if (isMounted) setError(err.message || 'Location watch failed');
                }
            );

            if (watchId !== -1) {
                watchIdRef.current = watchId;
            }
        };

        startTracking();

        return () => {
            isMounted = false;
            if (watchIdRef.current !== null) {
                locationService.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, []);

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
