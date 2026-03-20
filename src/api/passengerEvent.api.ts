/**
 * Passenger Event API
 * Endpoint: ...controller=vehicle&action=passengerEvent
 * Called when a driver submits embarking/disembarking counts at a stop.
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';

export interface PassengerEventParams {
    agencyID: string;
    vehicleID: string;
    /** Unix timestamp in seconds */
    eventTimestamp: number;
    /** 'DPC' = Driver Passenger Count */
    eventSource?: string;
    /** Net passenger count change (embarking or disembarking count) */
    eventCount: number;
    lat: number;
    lng: number;
    course: number;
    speed: number;
    /** The selected fare category title, e.g. "Adult" */
    eventFare: string;
}

export const postPassengerEvent = async (params: PassengerEventParams): Promise<unknown> => {
    const payload: Record<string, string | number> = {
        controller: 'vehicle',
        action: 'passengerEvent',
        agencyID: params.agencyID,
        vehicleID: params.vehicleID,
        eventTimestamp: params.eventTimestamp,
        eventSource: params.eventSource ?? 'DPC',
        eventCount: params.eventCount,
        lat: params.lat,
        lng: params.lng,
        course: params.course,
        speed: params.speed,
        eventFare: params.eventFare,
    };

    console.log('[PassengerEvent API] Payload before sending:', payload);

    const queryString = Object.entries(payload)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');

    const url = `${PEAK_BASE_URL}&${queryString}`;
    console.log('[PassengerEvent API] Full URL:', url);

    const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });
    console.log('[PassengerEvent API] Response:', response.data);
    return response.data;
};
