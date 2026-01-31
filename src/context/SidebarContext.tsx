/**
 * Sidebar Context - Open/close sidebar drawer from anywhere
 */

import React, { createContext, useContext } from 'react';

interface SidebarContextType {
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export const SidebarProvider = SidebarContext.Provider;

export const useSidebar = (): SidebarContextType => {
  const ctx = useContext(SidebarContext);
  if (!ctx) return { open: () => {}, close: () => {} };
  return ctx;
};
