/**
 * Driver Modal Context - Open Select Driver modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface DriverModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DriverModalContext = createContext<DriverModalContextType | null>(null);

export const DriverModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <DriverModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </DriverModalContext.Provider>
  );
};

export const useDriverModal = (): DriverModalContextType => {
  const ctx = useContext(DriverModalContext);
  if (!ctx) return { isOpen: false, open: () => {}, close: () => {} };
  return ctx;
};
