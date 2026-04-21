import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIME_FORMAT_KEY = '@driver_tracking:time_format';

interface SettingsModalContextType {
  visible: boolean;
  anchorY: number | null;
  open: (anchorY?: number) => void;
  close: () => void;
  use24HourClock: boolean;
  setUse24HourClock: (use24Hour: boolean) => void;
}

const SettingsModalContext = createContext<SettingsModalContextType | null>(null);

export const SettingsModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [anchorY, setAnchorY] = useState<number | null>(null);
  const [use24HourClock, setUse24HourClockState] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const storedFormat = await AsyncStorage.getItem(TIME_FORMAT_KEY);
        setUse24HourClockState(storedFormat === '24h');
      } catch {
        // ignore
      }
    })();
  }, []);

  const setUse24HourClock = useCallback(async (value: boolean) => {
    setUse24HourClockState(value);
    try {
      await AsyncStorage.setItem(TIME_FORMAT_KEY, value ? '24h' : '12h');
    } catch {
      // ignore
    }
  }, []);

  const open = useCallback((y?: number) => {
    setAnchorY(y ?? null);
    setVisible(true);
  }, []);
  const close = useCallback(() => setVisible(false), []);

  const value = useMemo(() => ({
    visible,
    anchorY,
    open,
    close,
    use24HourClock,
    setUse24HourClock
  }), [visible, anchorY, open, close, use24HourClock, setUse24HourClock]);

  return (
    <SettingsModalContext.Provider value={value}>
      {children}
    </SettingsModalContext.Provider>
  );
};

export const useSettingsModal = (): SettingsModalContextType => {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) throw new Error('useSettingsModal must be used within SettingsModalProvider');
  return ctx;
};
