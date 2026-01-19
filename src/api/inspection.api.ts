/**
 * Pre/Post-trip Inspection API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';

export interface InspectionItem {
  id: string;
  name: string;
  category: string;
  required: boolean;
  status: 'pass' | 'fail' | 'na';
  notes?: string;
}

export interface InspectionForm {
  type: 'pre-trip' | 'post-trip';
  routeId: string;
  vehicleId: string;
  items: InspectionItem[];
  timestamp: string;
  driverSignature?: string;
}

export const inspectionApi = {
  /**
   * Get pre-trip inspection form
   */
  getPreTripForm: async (): Promise<InspectionForm> => {
    const response = await apiClient.get<InspectionForm>(
      API_ENDPOINTS.INSPECTIONS.PRE_TRIP
    );
    return response.data;
  },

  /**
   * Get post-trip inspection form
   */
  getPostTripForm: async (): Promise<InspectionForm> => {
    const response = await apiClient.get<InspectionForm>(
      API_ENDPOINTS.INSPECTIONS.POST_TRIP
    );
    return response.data;
  },

  /**
   * Submit inspection form
   */
  submitInspection: async (form: InspectionForm): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.INSPECTIONS.SUBMIT, form);
  },
};

