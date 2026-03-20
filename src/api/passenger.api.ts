/**
 * Passenger & Fare API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';
import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';

export interface PassengerTally {
  routeId: string;
  stopId: string;
  passengersOn: number;
  passengersOff: number;
  fareType: string;
  fareAmount: number;
  timestamp: string;
}

export interface FareType {
  id: string;
  name: string;
  amount: number;
}

export interface PassengerSyncData {
  routeId: string;
  tallies: PassengerTally[];
}

export const passengerApi = {
  /**
   * Submit passenger/fare tally
   */
  submitTally: async (tally: PassengerTally): Promise<void> => {
    const url = API_ENDPOINTS.PASSENGERS.TALLY;
    console.log('[PassengerAPI] Submitting tally:', url, tally);
    try {
      const response = await apiClient.post(API_ENDPOINTS.PASSENGERS.TALLY, tally);
      console.log('[PassengerAPI] Passenger tally submitted:', response.data);
    } catch (error) {
      console.error('[PassengerAPI] Error submitting tally:', error);
    }
  },

  /**
   * Sync passenger data with backend
   */
  syncPassengerData: async (data: PassengerSyncData): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.PASSENGERS.SYNC, data);
  },

  /**
   * Get passenger history
   */
  getHistory: async (routeId: string, date?: string): Promise<PassengerTally[]> => {
    const params = date ? { routeId, date } : { routeId };
    const response = await apiClient.get<PassengerTally[]>(
      API_ENDPOINTS.PASSENGERS.HISTORY,
      { params }
    );
    return response.data;
  },

  /**
   * Update passenger count using the direct Peak Transit API
   */
  updateCount: async (params: { agencyID: string; vehicleID: string; count_in?: number; count_out?: number }): Promise<void> => {
    try {
      let url = `${PEAK_BASE_URL}&controller=driver&action=updatecount&agencyID=${params.agencyID}&vehicleID=${params.vehicleID}`;

      if (params.count_in !== undefined) {
        url += `&count_in=${params.count_in}`;
      }
      if (params.count_out !== undefined) {
        url += `&count_out=${params.count_out}`;
      }

      console.log('[PassengerAPI] Updating count:', url);
      const response = await axios.get(url);
      console.log('[PassengerAPI] Update count response:', response.data);
    } catch (error) {
      console.error('[PassengerAPI] Error updating count:', error);
      throw error;
    }
  },
};
