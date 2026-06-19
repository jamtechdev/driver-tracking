/**
 * DriverData Context
 *
 * Fetches and stores the Peak Transit driver data API response:
 * https://api.peaktransit.com/v5/index.php/?app_id=DR&key=...&controller=driver&action=data&agencyID=121
 *
 * Provides: agency, vehicles, routes, drivers, messages, stops, beacons, geofences
 * Fetch happens on mount. Call `refetch()` to refresh manually.
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from 'react';
import { getDriverData } from '@/api/driverData.api';
import type {
    DriverDataResponse,
    DriverDataRoute,
    DriverDataVehicle,
    DriverDataDriver,
    DriverDataMessage,
} from '@/api/driverData.api';
import { parseGeofences, type GeofenceData } from '@/utils/geofence';
import { setAgencyDrivers } from '@/utils/driverLookup';
import { setAgencyRoutes } from '@/utils/routeLookup';
import { setAgencyVehicles } from '@/utils/vehicleLookup';

// ─── Fine-grained types matching the API response ────────────────────────────

export interface AgencyData {
    agencyID: string;
    agencyName: string;
    latitude?: string;
    longitude?: string;
    dispatchEmail?: string;
    dispatchPhone?: string;
    tEarly?: string;
    tOnTime?: string;
    tWarn?: string;
    messages?: string;
    supervisorCode?: string;
    nearFullAPC?: string;
    fullAPC?: string;
    hasFares?: number;
    fareText?: string;
    fareCategory?: FareCategory[];
    [key: string]: unknown;
}

export interface FareItem {
    fareID: string;
    title: string;
    description?: string;
    price: number;
    currencyType?: string;
}

export interface FareCategory {
    fareCategoryID: number;
    title: string;
    description?: string;
    fare?: FareItem[];
}

export interface StopData {
    stopID: number;
    lat: number;
    lng: number;
    longName: string;
    [key: string]: unknown;
}

// Re-export from the API module for convenience
export type { DriverDataRoute, DriverDataVehicle, DriverDataDriver, DriverDataMessage };

// ─── Context shape ────────────────────────────────────────────────────────────

export interface DriverDataContextType {
    /** Raw full API response */
    rawData: DriverDataResponse | null;
    /** Agency info */
    agency: AgencyData | null;
    /** Vehicle list */
    vehicles: DriverDataVehicle[];
    /** Route list */
    routes: DriverDataRoute[];
    /** Driver list */
    drivers: DriverDataDriver[];
    /** Canned message list */
    messages: DriverDataMessage[];
    /** Stop list */
    stops: StopData[];
    /** Agency geofences (from driver data API) */
    geofences: GeofenceData[];
    /** Fare categories from agency data */
    fareCategories: FareCategory[];
    /** Loading state */
    isLoading: boolean;
    /** Error message (null if no error) */
    error: string | null;
    /** Manually re-fetch data from the API */
    refetch: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const DriverDataContext = createContext<DriverDataContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const DriverDataProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [rawData, setRawData] = useState<DriverDataResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true); // true until first fetch completes
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getDriverData();
            console.log('[DriverDataContext] Fetched:', data);
            setRawData(data);
            // if (__DEV__) {
            //     console.log('[DriverDataContext] Fetched:', {
            //         agency: data?.agency?.agencyName,
            //         vehicles: (data?.vehicle ?? []).length,
            //         routes: (data?.route ?? []).length,
            //         drivers: (data?.driver ?? []).length,
            //         messages: (data?.messages ?? []).length,
            //         stops: (data?.stop ?? []).length,
            //     });
            // }
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : 'Failed to load driver data';
            setError(msg);
            if (__DEV__) {
                console.warn('[DriverDataContext] Fetch error:', err);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch on mount and every 4 hours
    useEffect(() => {
        fetchData();
        const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
        const interval = setInterval(fetchData, FOUR_HOURS_MS);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Memoize derived slices — only change reference when rawData changes
    const agency = useMemo(
        () => (rawData?.agency as AgencyData | undefined) ?? null,
        [rawData]
    );
    const vehicles = useMemo<DriverDataVehicle[]>(
        () => (Array.isArray(rawData?.vehicle) ? (rawData!.vehicle as DriverDataVehicle[]) : []),
        [rawData]
    );
    const routes = useMemo<DriverDataRoute[]>(
        () => (Array.isArray(rawData?.route) ? (rawData!.route as DriverDataRoute[]) : []),
        [rawData]
    );
    const drivers = useMemo<DriverDataDriver[]>(
        () => (Array.isArray(rawData?.driver) ? (rawData!.driver as DriverDataDriver[]) : []),
        [rawData]
    );

    useEffect(() => {
        setAgencyDrivers(drivers);
    }, [drivers]);

    useEffect(() => {
        setAgencyRoutes(routes);
    }, [routes]);

    useEffect(() => {
        setAgencyVehicles(vehicles);
    }, [vehicles]);

    const messages = useMemo<DriverDataMessage[]>(
        () => (Array.isArray(rawData?.messages) ? (rawData!.messages as DriverDataMessage[]) : []),
        [rawData]
    );
    const stops = useMemo<StopData[]>(
        () => (Array.isArray(rawData?.stop) ? (rawData!.stop as StopData[]) : []),
        [rawData]
    );
    const geofences = useMemo<GeofenceData[]>(
        () => parseGeofences(rawData?.geofences),
        [rawData]
    );
    const fareCategories = useMemo<FareCategory[]>(
        () => {
            const agency = rawData?.agency as AgencyData | undefined;
            return Array.isArray(agency?.fareCategory) ? agency!.fareCategory! : [];
        },
        [rawData]
    );

    // Memoize the context value so consumers only re-render when something actually changes
    const value = useMemo<DriverDataContextType>(
        () => ({
            rawData,
            agency,
            vehicles,
            routes,
            drivers,
            messages,
            stops,
            geofences,
            fareCategories,
            isLoading,
            error,
            refetch: fetchData,
        }),
        [rawData, agency, vehicles, routes, drivers, messages, stops, geofences, fareCategories, isLoading, error, fetchData]
    );

    return (
        <DriverDataContext.Provider value={value}>
            {children}
        </DriverDataContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDriverData(): DriverDataContextType {
    const ctx = useContext(DriverDataContext);
    if (!ctx) {
        throw new Error('useDriverData must be used within DriverDataProvider');
    }
    return ctx;
}
