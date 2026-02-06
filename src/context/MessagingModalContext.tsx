/**
 * Messaging Modal Context - Open Send Message modal from anywhere
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface MessagingModalContextType {
  visible: boolean;
  open: () => void;
  close: () => void;
}

const MessagingModalContext = createContext<MessagingModalContextType | null>(null);

export const MessagingModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  return (
    <MessagingModalContext.Provider value={{ visible, open, close }}>
      {children}
    </MessagingModalContext.Provider>
  );
};

export const useMessagingModal = (): MessagingModalContextType => {
  const ctx = useContext(MessagingModalContext);
  if (!ctx) throw new Error('useMessagingModal must be used within MessagingModalProvider');
  return ctx;
};
