/**
 * Pin Entry Modal Context - Show PIN entry as overlay instead of navigating to a new screen
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Driver } from '../data/drivers';

export interface PinEntryOpenOptions {
  onSuccess?: () => void;
}

interface PinEntryModalContextType {
  visible: boolean;
  driver: Driver | null;
  open: (driver: Driver, options?: PinEntryOpenOptions) => void;
  close: () => void;
  onSuccessRef: React.MutableRefObject<(() => void) | null>;
}

const PinEntryModalContext = createContext<PinEntryModalContextType | null>(null);

export const PinEntryModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const onSuccessRef = useRef<(() => void) | null>(null);

  const open = useCallback((d: Driver, options?: PinEntryOpenOptions) => {
    setDriver(d);
    onSuccessRef.current = options?.onSuccess ?? null;
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setDriver(null);
    onSuccessRef.current = null;
  }, []);

  return (
    <PinEntryModalContext.Provider value={{ visible, driver, open, close, onSuccessRef }}>
      {children}
    </PinEntryModalContext.Provider>
  );
};

export function usePinEntryModal(): PinEntryModalContextType {
  const ctx = useContext(PinEntryModalContext);
  if (!ctx) {
    throw new Error('usePinEntryModal must be used within PinEntryModalProvider');
  }
  return ctx;
}
