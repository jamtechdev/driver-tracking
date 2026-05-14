import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';
import { AppState, Platform } from 'react-native';
import { mdtUpdate, vehicleUpdate, speedMpsToMph, type MdtUpdateParams, type VehicleUpdateParams } from '@/api/position.api';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { deviceService } from './device.service';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

export interface BackgroundTrackingData {
  agencyID: string;
  vehicleID: string;
  driverID: string;
  routeID: string;
  mdtUuid: string;
  minsLate: number;
}

class BackgroundTrackingService {
  private static instance: BackgroundTrackingService;
  private currentData: BackgroundTrackingData | null = null;
  private lastMdtSendTime = 0;
  private lastVehicleSendTime = 0;
  private watchId: number | null = null;
  private isRunning = false;

  private constructor() { }

  public static getInstance(): BackgroundTrackingService {
    if (!BackgroundTrackingService.instance) {
      BackgroundTrackingService.instance = new BackgroundTrackingService();
    }
    return BackgroundTrackingService.instance;
  }

  /**
   * Check if the background tracking service is running
   */
  public isTracking(): boolean {
    return this.isRunning;
  }

  /**
   * Get the current tracking data
   */
  public getCurrentData(): BackgroundTrackingData | null {
    return this.currentData;
  }

  /**
   * Start the background tracking service
   */
  public async start(data: BackgroundTrackingData) {
    if (this.isRunning) return;
    this.currentData = data;
    this.isRunning = true;

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
        delay: 5000,
      },
    };

    try {
      await BackgroundService.start(this.trackingTask.bind(this), options);
      console.log('[BackgroundTrackingService] Service started');
    } catch (error) {
      console.error('[BackgroundTrackingService] Failed to start:', error);
      this.isRunning = false;
    }
  }

  /**
   * Stop the background tracking service
   */
  public async stop() {
    if (!this.isRunning) return;

    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    await BackgroundService.stop();
    this.isRunning = false;
    console.log('[BackgroundTrackingService] Service stopped');
  }

  /**
   * The actual task that runs in the background
   */
  private async trackingTask() {
    return new Promise<void>(async (resolve) => {
      this.watchId = Geolocation.watchPosition(
        async (position) => {
          await this.handleLocationUpdate(position);
        },
        (error) => {
          console.warn('[BackgroundTrackingService] Location error:', error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 5000,
          fastestInterval: 2000,
          showsBackgroundLocationIndicator: true,
          forceRequestLocation: true,
        }
      );

      // Keep the task alive
      while (BackgroundService.isRunning()) {
        await new Promise(r => setTimeout(r, 1000));
      }
      resolve();
    });
  }

  /**
   * Handle incoming location updates and decide which APIs to call
   */
  private async handleLocationUpdate(position: Geolocation.GeoPosition) {
    if (!this.currentData) return;

    const now = Date.now();
    const { latitude, longitude, accuracy, heading, speed } = position.coords;

    // 1. Vehicle Update (Throttled 5s)
    if (now - this.lastVehicleSendTime >= 5000) {
      await this.sendVehicleUpdate(position);
      this.lastVehicleSendTime = now;
    }

    // 2. MDT Heartbeat (Throttled 10s)
    if (now - this.lastMdtSendTime >= 10000) {
      await this.sendMdtUpdate(position);
      this.lastMdtSendTime = now;
    }
  }

  /**
   * Call the Vehicle Update API
   */
  private async sendVehicleUpdate(position: Geolocation.GeoPosition) {
    if (!this.currentData) return;

    try {
      const batteryLevel = await deviceService.getBrightness(); // Wait, deviceService has setBrightness/getBrightness but also isCharging
      // Actually let's use a more direct way if deviceService is for brightness
      const powerState = await DeviceInfo.getPowerState();

      const params: VehicleUpdateParams = {
        agencyID: this.currentData.agencyID,
        vehicleID: this.currentData.vehicleID,
        routeID: this.currentData.routeID,
        driverID: this.currentData.driverID,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        course: position.coords.heading != null ? Math.round(position.coords.heading) : 0,
        speed: Math.round(speedMpsToMph(position.coords.speed)),
        batteryLevel: Math.round((powerState.batteryLevel ?? 1) * 100),
        batteryState: powerState.batteryState === 'charging' ? 2 : 1,
        source: 'MDT',
        d: 1,
        minsLate: this.currentData.minsLate,
      };

      console.log('[BackgroundTrackingService] Sending Vehicle Update:', params);
      const resp: any = await vehicleUpdate(params);
      if (resp && typeof resp.minsLate !== 'undefined') {
        this.currentData.minsLate = Number(resp.minsLate);
      }
    } catch (error) {
      console.warn('[BackgroundTrackingService] Vehicle update failed:', error);
    }
  }

  /**
   * Call the MDT Heartbeat Update API
   */
  private async sendMdtUpdate(position: Geolocation.GeoPosition) {
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
        ssid: (netState.details as any)?.ssid || '',
        mdtUUID: this.currentData.mdtUuid,
        deviceSerial: deviceSerial,
        deviceName: deviceName,
        appVersion: DeviceInfo.getVersion(),
        updating: false,
        isLocationServiceOn: 1,
        locationAuthStatus: 'always',
      };

      console.log('[BackgroundTrackingService] Sending MDT Update:', params);
      const resp: any = await mdtUpdate(params);
      if (resp && resp.vehicleID) {
        this.currentData.vehicleID = String(resp.vehicleID);
      }
    } catch (error) {
      console.warn('[BackgroundTrackingService] MDT update failed:', error);
    }
  }
}

export const backgroundTrackingService = BackgroundTrackingService.getInstance();
