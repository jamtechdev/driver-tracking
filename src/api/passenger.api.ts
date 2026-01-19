/**
 * Passenger & Fare API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';

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
    await apiClient.post(API_ENDPOINTS.PASSENGERS.TALLY, tally);
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
};

