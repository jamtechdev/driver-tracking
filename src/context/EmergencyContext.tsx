/**
 * Emergency Context - Silent alarm activated/deactivated state
 * Sends driver message API (controller=driver&action=message) for emergency and canned messages.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';
import { useDriverModel } from './DriverModelContext';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { sendDriverMessage } from '@/api/driverMessage.api';

const EMERGENCY_ACTIVATED = 'EMERGENCY MODE ACTIVATED';
const EMERGENCY_CLEARED = 'EMERGENCY MODE cleared';

interface EmergencyContextType {
  emergencyActivated: boolean;
  messageSent: boolean;
  activateEmergency: () => void;
  deactivateEmergency: (reason: string) => void;
  sendCannedMessage: (message: string) => void;
}

const EmergencyContext = createContext<EmergencyContextType | null>(null);

export const EmergencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [emergencyActivated, setEmergencyActivated] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const { vehicleId, driver } = useAuth();
  const { lastLocation } = useDriverModel();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  // Reset emergency state when driver or vehicle changes (e.g. on logout/login)
  useEffect(() => {
    if (!vehicleId || driver?.id === 'unassigned') {
      setEmergencyActivated(false);
      setMessageSent(false);
    }
  }, [vehicleId, driver?.id]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!vehicleId || driver?.id == 'unassigned') {
        Toast.show({
          type: 'error',
          text1: 'Emergency',
          text2: 'Please login to get the vehicle.',
        });
        throw new Error('Vehicle and driver required');
      }
      const lat = lastLocation?.latitude ?? 0;
      const lng = lastLocation?.longitude ?? 0;
      try {
        await sendDriverMessage({
          agencyID,
          vehicleID: vehicleId,
          driverID: driver?.id,
          lat,
          lng,
          message,
        });
      } catch (err) {
        if (__DEV__) console.warn('[EmergencyContext] sendDriverMessage failed', err);
        Toast.show({
          type: 'error',
          text1: 'Message failed',
          text2: 'Could not send to server. Try again.',
        });
        throw err;
      }
    },
    [agencyID, vehicleId, driver?.id, lastLocation?.latitude, lastLocation?.longitude]
  );

  const activateEmergency = useCallback(() => {
    setEmergencyActivated(true);
    setMessageSent(true);
    sendMessage(EMERGENCY_ACTIVATED).catch((err) => {
      console.log('Emergency activation failed', err);
      setEmergencyActivated(false);
      setMessageSent(false);
    });
  }, [sendMessage]);

  const deactivateEmergency = useCallback(
    (reason: string) => {
      setEmergencyActivated(false);
      setMessageSent(false);
      const message = reason?.trim() ? `${EMERGENCY_CLEARED} - ${reason}` : EMERGENCY_CLEARED;
      sendMessage(message).catch(() => { });
    },
    [sendMessage]
  );

  const sendCannedMessage = useCallback(
    (message: string) => {
      setMessageSent(true);
      sendMessage(message).
        then((res) => {
          console.log('Message sent successfully', res);
          setMessageSent(false);
          Toast.show({
            type: 'success',
            text1: 'Message sent successfully',

          });
        }).catch((err) => {
          console.log('Message failed', err);
          setMessageSent(false);
          Toast.show({
            type: 'error',
            text1: 'Message failed',
            text2: 'Could not send to server. Try again.',
          });
        });
    },
    [sendMessage]
  );

  return (
    <EmergencyContext.Provider
      value={{
        emergencyActivated,
        messageSent,
        activateEmergency,
        deactivateEmergency,
        sendCannedMessage,
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
