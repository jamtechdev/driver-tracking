/**
 * Device Service
 * Handles device controls (brightness, volume, battery, etc.)
 */

export const deviceService = {
  /**
   * Check if device is charging/plugged in
   */
  isCharging: async (): Promise<boolean> => {
    try {
      const DeviceBattery = require('react-native-device-battery').default;
      return await DeviceBattery.isCharging();
    } catch {
      return true; // Assume plugged in if detection unavailable (tablet use case)
    }
  },

  /**
   * Add listener for battery/charging state changes
   */
  addBatteryListener: (callback: (state: { level: number; charging: boolean }) => void): (() => void) => {
    try {
      const DeviceBattery = require('react-native-device-battery').default;
      const subscription = DeviceBattery.addListener(callback);
      return () => subscription?.remove?.();
    } catch {
      return () => { };
    }
  },

  /**
   * Set screen brightness (0-100). Returns true if the native call succeeded.
   */
  setBrightness: async (value: number): Promise<boolean> => {
    try {
      const Brightness = require('react-native-brightness-control').default;
      const normalized = Math.max(0, Math.min(100, value)) / 100;
      await Brightness.setBrightness(normalized);
      return true;
    } catch (error) {
      if (__DEV__ && error instanceof Error) {
        console.warn('[device.service] setBrightness failed:', error.message);
      }
      return false;
    }
  },

  /**
   * Get current brightness (0-100)
   */
  getBrightness: async (): Promise<number> => {
    try {
      const Brightness = require('react-native-brightness-control').default;
      const value = await Brightness.getBrightness();
      return Math.round(value * 100);
    } catch {
      return 100;
    }
  },
  /**
   * Get current volume (0-100)
   */
  getVolume: async (): Promise<number> => {
    try {
      const { VolumeManager } = require('react-native-volume-manager');
      const { volume } = await VolumeManager.getVolume();
      return Math.round(volume * 100);
    } catch {
      return 50;
    }
  },

  /**
   * Add listener for volume changes
   */
  addVolumeListener: (callback: (volume: number) => void): (() => void) => {
    try {
      const { VolumeManager } = require('react-native-volume-manager');
      const subscription = VolumeManager.addVolumeListener((result: { volume: number }) => {
        callback(Math.round(result.volume * 100));
      });
      return () => subscription?.remove?.();
    } catch {
      return () => { };
    }
  },
};

