/**
 * Checklist Modal Context - Open Pre-Trip Checklist modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChecklistModalContextType {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const ChecklistModalContext = createContext<ChecklistModalContextType | null>(null);

export const ChecklistModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <ChecklistModalContext.Provider value={{ visible, open, close }}>
      {children}
    </ChecklistModalContext.Provider>
  );
};

export const useChecklistModal = (): ChecklistModalContextType => {
  const ctx = useContext(ChecklistModalContext);
  if (!ctx) throw new Error('useChecklistModal must be used within ChecklistModalProvider');
  return ctx;
};
