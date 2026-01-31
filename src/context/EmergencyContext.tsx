/**
 * Emergency Context - Silent alarm activated/deactivated state
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface EmergencyContextType {
  emergencyActivated: boolean;
  messageSent: boolean;
  activateEmergency: () => void;
  deactivateEmergency: (reason: string) => void;
}

const EmergencyContext = createContext<EmergencyContextType | null>(null);

export const EmergencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [emergencyActivated, setEmergencyActivated] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const activateEmergency = useCallback(() => {
    setEmergencyActivated(true);
    setMessageSent(true);
    // TODO: Send silent emergency alert to backend
  }, []);

  const deactivateEmergency = useCallback((reason: string) => {
    setEmergencyActivated(false);
    setMessageSent(false);
    // TODO: Send deactivation reason to backend
  }, []);

  return (
    <EmergencyContext.Provider
      value={{
        emergencyActivated,
        messageSent,
        activateEmergency,
        deactivateEmergency,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = (): EmergencyContextType => {
  const ctx = useContext(EmergencyContext);
  if (!ctx) throw new Error('useEmergency must be used within EmergencyProvider');
  return ctx;
};
