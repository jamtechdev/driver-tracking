/**
 * Schedule API - Peak Transit routefordriver
 * GET .../controller=schedule&action=routefordriver&routeID=...&agencyID=...
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';

export interface ScheduleStop {
    blockID: number;
    calculatedArrivalTime: number;
    departureTime: number;
    link: number;
    unscheduled: number;
    longName: string;
    tripID: number;
    [key: string]: unknown;
}

export interface RouteScheduleResponse {
    schedule?: ScheduleStop[];
    [key: string]: unknown;
}

export const getRouteSchedule = async (
    agencyID: string,
    routeID: string
): Promise<RouteScheduleResponse> => {
    const url = `${PEAK_BASE_URL}&controller=schedule&action=routefordriver&routeID=${encodeURIComponent(routeID)}&agencyID=${encodeURIComponent(agencyID)}`;

    const response = await axios.get<RouteScheduleResponse>(url, {
        timeout: 30000,
    });
    console.log('schedule response ===>>>>>', response.data);
    return response.data;
};
