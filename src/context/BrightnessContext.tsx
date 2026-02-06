/**
 * Brightness Context - Slider visibility and brightness value
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const BRIGHTNESS_KEY = '@driver_tracking:brightness';

interface BrightnessContextType {
  brightnessVisible: boolean;
  setBrightnessVisible: (visible: boolean) => void;
  brightness: number;
  setBrightness: (value: number) => void;
  brightnessSupported: boolean | null;
}

const BrightnessContext = createContext<BrightnessContextType | null>(null);

export const BrightnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brightnessVisible, setBrightnessVisible] = useState(false);
  const [brightness, setBrightnessState] = useState(100);
  const [brightnessSupported, setBrightnessSupported] = useState<boolean | null>(null);
  const hasShownUnsupportedToast = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { deviceService } = await import('../services/device.service');
        const deviceBrightness = await deviceService.getBrightness();
        setBrightnessState(deviceBrightness);
        setBrightnessSupported(true);
        // Apply stored/current brightness to the device on app load
        await deviceService.setBrightness(deviceBrightness);
      } catch {
        const stored = await AsyncStorage.getItem(BRIGHTNESS_KEY);
        if (stored != null) {
          const val = parseInt(stored, 10);
          if (!isNaN(val) && val >= 0 && val <= 100) {
            setBrightnessState(val);
            const { deviceService } = await import('../services/device.service');
            const ok = await deviceService.setBrightness(val);
            setBrightnessSupported(ok);
          }
        }
      }
    };
    load();
  }, []);

  const setBrightness = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    setBrightnessState(clamped);
    AsyncStorage.setItem(BRIGHTNESS_KEY, String(clamped));
    import('../services/device.service').then(({ deviceService }) => {
      deviceService.setBrightness(clamped).then((ok) => {
        if (ok) {
          setBrightnessSupported(true);
        } else {
          setBrightnessSupported(false);
          if (!hasShownUnsupportedToast.current) {
            hasShownUnsupportedToast.current = true;
            Toast.show({
              type: 'error',
              text1: 'Brightness',
              text2: 'Could not change screen brightness. Rebuild the app (e.g. run again from Xcode/Android Studio) and try again.',
              visibilityTime: 5000,
            });
          }
        }
      });
    });
  }, []);

  return (
    <BrightnessContext.Provider
      value={{
        brightnessVisible,
        setBrightnessVisible,
        brightness,
        setBrightness,
        brightnessSupported,
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
