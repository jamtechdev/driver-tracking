import axios from 'axios';
import {
  getVehicleListUrl,
  getVehicleAssignBaseUrl,
  getVehicleAssignmentInfoUrl,
  API_CONFIG,
} from '@/config/api.config';

export interface Vehicle {
    vehicleID: string;
    vehicleNumber?: string;
    vehicleName?: string;
    driverID?: string;
    [key: string]: any;
}

export const getVehiclesByDriver = async (driverId: string): Promise<Vehicle[]> => {
    console.log('[VehicleAPI] Fetching vehicles for driver:', driverId);
    try {
        const url = `${getVehicleListUrl()}&driverID=${encodeURIComponent(driverId)}`;
        const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });

        // Peak Transit APIs often return { success: true, vehicle: [...] } or just [...]
        const data = response.data;
        let list: Vehicle[] = [];

        if (Array.isArray(data)) {
            list = data;
        } else if (data && Array.isArray(data.vehicle)) {
            list = data.vehicle;
        } else if (data && typeof data === 'object') {
            // Sometimes it might return a single object if only one exists
            if (data.vehicleID) list = [data];
        }

        // Double check filtering by driverID if the API didn't do it or returned more
        const filtered = list.filter(v => String(v.driverID) === String(driverId));
        console.log('[VehicleAPI] Filtered vehicles:', filtered);
        return filtered;
    } catch (error) {
        console.error('[VehicleAPI] Error fetching vehicles for driver:', driverId, error);
        return [];
    }
};

export const assignVehicle = async (params: {
    routeID: string;
    driverID: string;
    vehicleID: string;
    end: number;
}): Promise<{ success: boolean; message?: string }> => {
    try {
        const url = `${getVehicleAssignBaseUrl()}&routeID=${encodeURIComponent(params.routeID)}&driverID=${encodeURIComponent(params.driverID)}&vehicleID=${encodeURIComponent(params.vehicleID)}&end=${params.end}`;

        console.log('[VehicleAPI] Assigning vehicle with data:', params);
        console.log('[VehicleAPI] Request URL:', url);

        const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });
        console.log('[VehicleAPI] Response:', response);
        const data = response.data;
        if (data && (data.success === true || data.success === 'true' || data.result === 'success')) {
            return { success: true };
        }

        return {
            success: false,
            message: data?.errormsg || data?.message || 'Assignment failed'
        };
    } catch (error: any) {
        console.error('[VehicleAPI] Error assigning vehicle:', error?.response?.data ?? error?.message ?? error);
        return {
            success: false,
            message: error?.response?.data?.errormsg || error?.response?.data?.message || error?.message || 'Network error'
        };
    }
};

export const getVehicleAssignment = async (vehicleID: string): Promise<{ success: boolean; routeID?: string; message?: string }> => {
    try {
        const url = `${getVehicleAssignmentInfoUrl()}&vehicleID=${encodeURIComponent(vehicleID)}`;
        console.log('[VehicleAPI] Fetching assignment for vehicle:', vehicleID);
        console.log('[VehicleAPI] URL:', url);

        const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });
        const data = response.data;
        console.log('[VehicleAPI] Assignment data:', data);

        // Expecting { success: true, routeID: "..." } or similar
        // Based on the user's manual URL, it returns info about the assignment.
        if (data && (data.success === true || data.success === 'true' || data.result === 'success')) {
            return {
                success: true,
                routeID: data.routeID || data.routeId || data.assignment?.routeID || data.currentRouteID
            };
        }

        return {
            success: false,
            message: data?.errormsg || data?.message || 'Failed to fetch assignment info'
        };
    } catch (error: any) {
        console.error('[VehicleAPI] Error fetching vehicle assignment:', error);
        return {
            success: false,
            message: error.message || 'Network error'
        };
    }
};

export const getAllVehicles = async (): Promise<any[]> => {
    try {
        const vehicleListUrl = getVehicleListUrl();
        console.log('[VehicleAPI] Fetching all vehicles from:', vehicleListUrl);
        const response = await axios.get(vehicleListUrl, { timeout: API_CONFIG.TIMEOUT });
        // console.log('[VehicleAPI] Fetching all vehicles from:', VEHICLE_LIST_URL);
        // const response = await axios.get(VEHICLE_LIST_URL, { timeout: API_CONFIG.TIMEOUT });
        const data = response?.data;

        if (data == null) {
            console.warn('[VehicleAPI] Empty response from vehicle list endpoint');
            return [];
        }

        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (Array.isArray(data.vehicle)) {
            list = data.vehicle;
        } else if (data.vehicle && typeof data.vehicle === 'object') {
            list = [data.vehicle];
        }

        console.log(`[VehicleAPI] Fetched ${list.length} vehicles`);
        return list;
    } catch (error: any) {
        console.error('[VehicleAPI] Error fetching all vehicles:', error?.response?.data ?? error?.message ?? error);
        return [];
    }
};
