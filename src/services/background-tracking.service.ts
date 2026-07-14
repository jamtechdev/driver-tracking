/**
 * Background GPS task (react-native-geolocation-service + background-actions).
 * Sends MDT heartbeat only — vehicle updates stay in DriverModelContext.
 */

import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';
import { Platform } from 'react-native';
import { mdtUpdate, speedMpsToMph, type MdtUpdateParams } from '@/api/position.api';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { deviceService } from './device.service';
import { notificationService } from './notification.service';
import { APP_CONSTANTS } from '@/utils/constants';
import { GEOLOCATION_WATCH_OPTIONS, type GeolocationResponse } from './location.service';

const MDT_INTERVAL_MS = 10000;
const HORIZ_ACCUR_UPPER_LIMIT = APP_CONSTANTS.LOCATION_ACCURACY_THRESHOLD ?? 50;

export interface BackgroundTrackingData {
  agencyID: string;
  vehicleID: string;
  driverID: string;
  routeID: string;
  mdtUuid: string;
  minsLate: number;
}

export type BackgroundLocationPayload = GeolocationResponse;

class BackgroundTrackingService {
  private static instance: BackgroundTrackingService;
  private currentData: BackgroundTrackingData | null = null;
  private lastMdtSendTime = 0;
  private watchId: number | null = null;
  private isRunning = false;
  private onLocationUpdate: ((loc: BackgroundLocationPayload) => void) | null = null;

  private constructor() {}

  public static getInstance(): BackgroundTrackingService {
    if (!BackgroundTrackingService.instance) {
      BackgroundTrackingService.instance = new BackgroundTrackingService();
    }
    return BackgroundTrackingService.instance;
  }

  public isTracking(): boolean {
    return this.isRunning;
  }

  public getCurrentData(): BackgroundTrackingData | null {
    return this.currentData;
  }

  public setLocationUpdateHandler(handler: ((loc: BackgroundLocationPayload) => void) | null): void {
    this.onLocationUpdate = handler;
  }

  public updateTrackingData(partial: Partial<BackgroundTrackingData>): void {
    if (!this.currentData) return;
    this.currentData = { ...this.currentData, ...partial };
  }

  public async start(data: BackgroundTrackingData): Promise<boolean> {
    if (this.isRunning) {
      this.updateTrackingData(data);
      return true;
    }

    if (Platform.OS === 'ios') {
      try {
        const auth = await Geolocation.requestAuthorization('always');
        if (auth !== 'granted' && auth !== 'restricted') {
          console.warn('[BackgroundTrackingService] iOS location authorization:', auth);
          return false;
        }
      } catch (e) {
        console.warn('[BackgroundTrackingService] iOS authorization failed:', e);
        return false;
      }
    }

    this.currentData = { ...data };
    this.isRunning = true;
    this.lastMdtSendTime = 0;

    const options = {
      taskName: 'DriverTracking',
      taskTitle: 'GPS Tracking Active',
      taskDesc: 'Broadcasting location to server',
      taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
      },
      color: '#000000',
      linkingURI: 'drivertracking://',
      parameters: {
        delay: 1000,
      },
    };

    try {
      await BackgroundService.start(this.trackingTask.bind(this), options);
      console.log('[BackgroundTrackingService] Service started');
      return true;
    } catch (error) {
      console.error('[BackgroundTrackingService] Failed to start:', error);
      this.isRunning = false;
      this.currentData = null;
      await notificationService.stopTrackingIndicator().catch(() => {});
      return false;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    try {
      await BackgroundService.stop();
    } catch (e) {
      console.warn('[BackgroundTrackingService] stop error:', e);
    }

    await notificationService.stopTrackingIndicator().catch(() => {});

    this.isRunning = false;
    this.currentData = null;
    console.log('[BackgroundTrackingService] Service stopped');
  }

  private async trackingTask(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.watchId = Geolocation.watchPosition(
        async (position) => {
          await this.handleLocationUpdate(position);
        },
        (error) => {
          console.warn('[BackgroundTrackingService] Location error:', error);
        },
        GEOLOCATION_WATCH_OPTIONS,
      );

      const keepAlive = async () => {
        while (BackgroundService.isRunning()) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        resolve();
      };
      keepAlive();
    });
  }

  private async handleLocationUpdate(position: Geolocation.GeoPosition): Promise<void> {
    if (!this.currentData) return;

    const { accuracy } = position.coords;
    const receivedAt = Date.now();

    this.onLocationUpdate?.({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy,
      heading: position.coords.heading ?? undefined,
      speed: position.coords.speed ?? undefined,
      altitude: position.coords.altitude ?? undefined,
      timestamp: position.timestamp,
      receivedAt,
    });

    // Still send MDT with live coords even if accuracy is soft (emulator / GPX)
    if (accuracy > HORIZ_ACCUR_UPPER_LIMIT * 4) {
      return;
    }

    const now = Date.now();
    if (now - this.lastMdtSendTime >= MDT_INTERVAL_MS - 500) {
      await this.sendMdtUpdate(position);
      this.lastMdtSendTime = now;
    }
  }

  private async sendMdtUpdate(position: Geolocation.GeoPosition): Promise<void> {
    if (!this.currentData) return;

    try {
      const brightness = await deviceService.getBrightness();
      const netState = await NetInfo.fetch();
      const powerState = await DeviceInfo.getPowerState();
      const deviceName = await DeviceInfo.getDeviceName();
      const deviceSerial = DeviceInfo.getUniqueIdSync();

      const params: MdtUpdateParams = {
        agencyID: this.currentData.agencyID,
        vehicleID: this.currentData.vehicleID,
        vehicleAssignmentUpdated: 0,
        driverID: this.currentData.driverID,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: Math.round(speedMpsToMph(position.coords.speed)),
        horizontalAccuracy: position.coords.accuracy,
        verticalAccuracy: 0,
        osVersion: DeviceInfo.getSystemVersion(),
        thermalState: 0,
        batteryLevel: Math.round((powerState.batteryLevel ?? 1) * 100),
        batteryState: powerState.batteryState === 'charging' ? 2 : 1,
        d: 1,
        screenBrightness: brightness,
        connectionType: netState.type,
        ssid: (netState.details as { ssid?: string })?.ssid || '',
        mdtUUID: this.currentData.mdtUuid,
        deviceSerial,
        deviceName,
        appVersion: DeviceInfo.getVersion(),
        updating: false,
        isLocationServiceOn: 1,
        locationAuthStatus: 'always',
      };

      const resp: { vehicleID?: string | number } = await mdtUpdate(params);
      if (resp?.vehicleID && String(resp.vehicleID) !== '0') {
        this.currentData.vehicleID = String(resp.vehicleID);
      }
    } catch (error) {
      console.warn('[BackgroundTrackingService] MDT update failed:', error);
    }
  }
}

export const backgroundTrackingService = BackgroundTrackingService.getInstance();
