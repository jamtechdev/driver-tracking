/**
 * Brightness Context - Slider visibility and brightness value
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRIGHTNESS_KEY = '@driver_tracking:brightness';

interface BrightnessContextType {
  brightnessVisible: boolean;
  setBrightnessVisible: (visible: boolean) => void;
  brightness: number;
  setBrightness: (value: number) => void;
}

const BrightnessContext = createContext<BrightnessContextType | null>(null);

export const BrightnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brightnessVisible, setBrightnessVisible] = useState(false);
  const [brightness, setBrightnessState] = useState(100);

  useEffect(() => {
    const load = async () => {
      try {
        const { deviceService } = await import('../services/device.service');
        const deviceBrightness = await deviceService.getBrightness();
        setBrightnessState(deviceBrightness);
      } catch {
        const stored = await AsyncStorage.getItem(BRIGHTNESS_KEY);
        if (stored != null) {
          const val = parseInt(stored, 10);
          if (!isNaN(val) && val >= 0 && val <= 100) setBrightnessState(val);
        }
      }
    };
    load();
  }, []);

  const setBrightness = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setBrightnessState(clamped);
    AsyncStorage.setItem(BRIGHTNESS_KEY, String(clamped));
    // Call device service for native brightness (when implemented)
    import('../services/device.service').then(({ deviceService }) => {
      deviceService.setBrightness(clamped);
    });
  }, []);

  return (
    <BrightnessContext.Provider
      value={{
        brightnessVisible,
        setBrightnessVisible,
        brightness,
        setBrightness,
      }}
    >
      {children}
    </BrightnessContext.Provider>
  );
};

export const useBrightness = (): BrightnessContextType => {
  const ctx = useContext(BrightnessContext);
  if (!ctx) throw new Error('useBrightness must be used within BrightnessProvider');
  return ctx;
};
