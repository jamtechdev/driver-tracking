/**
 * Map Modal Context - Open Map modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MapModalContextType {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const MapModalContext = createContext<MapModalContextType | null>(null);

export const MapModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <MapModalContext.Provider value={{ visible, open, close }}>
      {children}
    </MapModalContext.Provider>
  );
};

export const useMapModal = (): MapModalContextType => {
  const ctx = useContext(MapModalContext);
  if (!ctx) throw new Error('useMapModal must be used within MapModalProvider');
  return ctx;
};
