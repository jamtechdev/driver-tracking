// /**
//  * MDT API - Device status reporting
//  */

// import axios from 'axios';
// import DeviceInfo from 'react-native-device-info';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { PEAK_BASE_URL } from '@/config/env';
// import { API_CONFIG } from '@/config/api.config';

// const MDT_ID_KEY = '@driver_tracking:mdt_id';

// export interface MdtStatusParams {
//     agencyID: string;
//     vehicleID: string;
//     driverID: string;
// }

// /**
//  * Report MDT status after login correctly.
//  * Matches the URL format provided:
//  * https://api.peaktransit.com/v5/index.php/?app_id=DR&key=...&controller=mdt&action=update&agencyID=...&vehicleID=...&driverID=...&osVersion=...&thermalState=0&batteryLevel=...&batteryState=...&d=1&screenBrightness=...&connectionType=WiFi&ssid=MyNetwork&mdtUUID=...&deviceSerial=...&deviceName=...&appVersionUpdater=1.0&updating=1&d=1
//  */
// export const reportMdtStatusAfterLogin = async (params: MdtStatusParams) => {
//     try {
//         const mdtUUID = (await AsyncStorage.getItem(MDT_ID_KEY)) || '';
//         const deviceSerial = DeviceInfo.getUniqueIdSync();
//         const systemVersion = DeviceInfo.getSystemVersion();
//         const batteryLevelPercent = Math.round((await DeviceInfo.getBatteryLevel()) * 100);
//         const isCharging = await DeviceInfo.isBatteryCharging();
//         // 1 = unplugged, 2 = charging (based on user's hint batteryLevel=80&batteryState=2)
//         const batteryState = isCharging ? 2 : 1;
//         const deviceName = DeviceInfo.getDeviceNameSync();

//         const data: Record<string, string | number> = {
//             controller: 'mdt',
//             action: 'update',
//             agencyID: params.agencyID,
//             vehicleID: params.vehicleID,
//             driverID: params.driverID,
//             osVersion: systemVersion,
//             thermalState: 0,
//             batteryLevel: batteryLevelPercent,
//             batteryState: batteryState,
//             d: 1,
//             screenBrightness: 0.5, // Default as in user's example
//             connectionType: 'WiFi', // Default as in user's example
//             ssid: 'MyNetwork', // Default as in user's example
//             mdtUUID: mdtUUID,
//             deviceSerial: deviceSerial,
//             deviceName: deviceName,
//             appVersionUpdater: '1.0',
//             updating: 1,
//         };

//         console.log('[MDT API] Logging data before sending to api:', data);

//         const searchParams = Object.entries(data)
//             .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
//             .join('&');

//         // Adding &d=1 at the end and the beginning as in user's URL?
//         // User URL: ...&updating=1&d=1
//         // The PEAK_BASE_URL already contains app_id and key.

//         const url = `${PEAK_BASE_URL}&${searchParams}&d=1`;

//         console.log('[MDT API] Full Request URL:', url);

//         const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });
//         console.log('[MDT API] Response status:', response.status);

//         return response.data;
//     } catch (error) {
//         console.error('[MDT API] Error reporting status:', error);
//         throw error;
//     }
// };





import axios from 'axios';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';
import NetInfo from '@react-native-community/netinfo';

const MDT_ID_KEY = '@driver_tracking:mdt_id';

export interface MdtStatusParams {
    agencyID: string;
    vehicleID: string;
    driverID: string;
    screenBrightness?: number;
}

/**
 * Report MDT status after login correctly.
 * Matches the URL format provided:
 * https://api.peaktransit.com/v5/index.php/?app_id=DR&key=...&controller=mdt&action=update&agencyID=...&vehicleID=...&driverID=...&osVersion=...&thermalState=0&batteryLevel=...&batteryState=...&d=1&screenBrightness=...&connectionType=WiFi&ssid=MyNetwork&mdtUUID=...&deviceSerial=...&deviceName=...&appVersionUpdater=1.0&updating=1&d=1
 */
export const reportMdtStatusAfterLogin = async (params: MdtStatusParams) => {
    try {
        const mdtUUID = (await AsyncStorage.getItem(MDT_ID_KEY))?.replace('BPT-', '') || '';
        const deviceSerial = DeviceInfo.getUniqueIdSync();
        const systemVersion = DeviceInfo.getSystemVersion();
        const batteryLevelPercent = Math.round((await DeviceInfo.getBatteryLevel()) * 100);
        const isCharging = await DeviceInfo.isBatteryCharging();
        const batteryState = isCharging ? 2 : 1;
        const deviceName = DeviceInfo.getDeviceNameSync();

        const netInfoState = await NetInfo.fetch();
        const connectionType = String(netInfoState.type);

        let ssid = 'N/A';
        if (netInfoState.type === 'wifi' && netInfoState.details && 'ssid' in netInfoState.details) {
            ssid = (netInfoState.details as any).ssid || 'MyNetwork';
        }

        const data: Record<string, string | number> = {
            controller: 'mdt',
            action: 'update',
            agencyID: params.agencyID,
            vehicleID: params.vehicleID,
            driverID: params.driverID,
            osVersion: systemVersion,
            thermalState: 0,
            batteryLevel: batteryLevelPercent,
            batteryState: batteryState,
            d: 1,
            screenBrightness: params.screenBrightness / 100 ?? 0,
            connectionType: connectionType,
            ssid: ssid,
            mdtUUID: mdtUUID,
            deviceSerial: deviceSerial,
            deviceName: deviceName,
            appVersionUpdater: '1.0',
            updating: 1,
        };

        console.log('[MDT API] Logging data before sending to API:', data);
        const searchParams = Object.entries(data)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');

        // Adding &d=1 at the end and the beginning as in user's URL
        const url = `${PEAK_BASE_URL}&${searchParams}&d=1`;

        console.log('[MDT API] Full Request URL:', url);

        const response = await axios.get(url, { timeout: API_CONFIG.TIMEOUT });
        console.log('[MDT API] Response status:', response);

        return response.data;
    } catch (error) {
        console.error('[MDT API] Error reporting status:', error);
        throw error;
    }
};