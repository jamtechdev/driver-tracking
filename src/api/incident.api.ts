import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';

export interface IncidentReportParams {
    agencyID: string;
    driverID: string;
    subject: string;
    content: string;
    images: string[];
}

export const reportIncident = async (params: IncidentReportParams): Promise<{ success: boolean; message?: string }> => {
    try {
        const url = `${PEAK_BASE_URL}&controller=Driver&action=incident&agencyID=${params.agencyID}&driverID=${params.driverID}`;

        const formData = new FormData();
        formData.append('subject', params.subject);
        formData.append('content', params.content);

        params.images.forEach((uri, index) => {
            const fileName = `image${index}.jpeg`;
            const type = 'image/jpeg';

            formData.append(`image${index}`, {
                uri,
                name: fileName,
                type,
            } as any);
        });

        console.log('[IncidentAPI] Reporting incident to:', url);
        console.log('[IncidentAPI] Form Data:', formData);


        const response = await axios.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: API_CONFIG.TIMEOUT,
        });

        console.log('[IncidentAPI] Response:', response.data);

        if (response.data && (response.data.success === true || response.data.success === 'true' || response.data.result === 'success')) {
            return { success: true };
        }

        return {
            success: false,
            message: response.data?.errormsg || response.data?.message || 'Failed to report incident',
        };
    } catch (error: any) {
        console.error('[IncidentAPI] Error reporting incident:', error);
        const errorMessage = error.response?.data?.errormsg || error.response?.data?.message || error.message || 'Network error';
        return {
            success: false,
            message: errorMessage,
        };
    }
};
