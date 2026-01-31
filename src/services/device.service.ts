/**
 * Device Service
 * Handles device controls (brightness, volume, etc.)
 */

export const deviceService = {
  /**
   * Set screen brightness (0-100)
   */
  setBrightness: async (value: number) => {
    try {
      const Brightness = require('react-native-brightness-control').default;
      const normalized = Math.max(0, Math.min(100, value)) / 100;
      await Brightness.setBrightness(normalized);
    } catch (error) {
      // Native module may not be linked yet
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
};

