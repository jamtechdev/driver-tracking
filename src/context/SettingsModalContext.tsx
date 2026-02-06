/**
 * Settings Modal Context - Open Settings modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SettingsModalContextType {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const SettingsModalContext = createContext<SettingsModalContextType | null>(null);

export const SettingsModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <SettingsModalContext.Provider value={{ visible, open, close }}>
      {children}
    </SettingsModalContext.Provider>
  );
};

export const useSettingsModal = (): SettingsModalContextType => {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) throw new Error('useSettingsModal must be used within SettingsModalProvider');
  return ctx;
};
