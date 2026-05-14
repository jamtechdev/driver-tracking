/**
 * Emergency Context - Silent alarm activated/deactivated state
 * Sends driver message API (controller=driver&action=message) for emergency and canned messages.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useAuth } from './AuthContext';
import { useDriverModel } from './DriverModelContext';
import { useDriverData } from './DriverDataContext';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { sendDriverMessage } from '@/api/driverMessage.api';
import { vehicles2Alert } from '@/api/position.api';

const EMERGENCY_ACTIVATED = 'EMERGENCY MODE: ACTIVATED FROM MDT';
const EMERGENCY_CLEARED = 'EMERGENCY MODE: DEACTIVATED';

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
  const { lastLocation, serverAlert } = useDriverModel();
  const { vehicles, isLoading: dataLoading } = useDriverData();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  // Sync emergency state from API on app launch / vehicle change
  useEffect(() => {
    if (dataLoading || !vehicleId) return;
    const match = vehicles.find((v) => String(v.vehicleID) === String(vehicleId));
    if (match) {
      setEmergencyActivated(String(match.alert) === '1');
    }
  }, [dataLoading, vehicleId, vehicles]);

  // Sync emergency state from live vehicle update responses
  useEffect(() => {
    if (serverAlert === null) return;
    if (serverAlert === 1) setEmergencyActivated(true);
    if (serverAlert === 0) setEmergencyActivated(false);
  }, [serverAlert]);

  const sendMessage = useCallback(
    async (message: string) => {
      // Use provided ID or fallback to '0' for unassigned states
      const effectiveVehicleId = vehicleId || '0';
      const effectiveDriverId = (driver?.id && driver.id !== 'unassigned') ? driver.id : '0';

      const lat = lastLocation?.latitude ?? 0;
      const lng = lastLocation?.longitude ?? 0;
      try {
        await sendDriverMessage({
          agencyID,
          vehicleID: effectiveVehicleId,
          driverID: effectiveDriverId,
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

  const sendAlert = useCallback((alert: 0 | 1) => {
    const effectiveVehicleId = vehicleId || '0';
    vehicles2Alert({ agencyID, vehicleID: effectiveVehicleId, alert }).catch(
      (err) => __DEV__ && console.warn('[EmergencyContext] vehicles2Alert failed', err)
    );
  }, [agencyID, vehicleId]);

  const activateEmergency = useCallback(() => {
    setEmergencyActivated(true);
    setMessageSent(true);
    sendAlert(1);
    sendMessage(EMERGENCY_ACTIVATED)
      .then((res) => {
        console.log('Emergency activated successfully', res);
        Toast.show({
          type: 'success',
          text1: 'Emergency Activated'
        });
      }).catch((err) => {
        console.log('Emergency activation failed', err);
        setEmergencyActivated(false);
        setMessageSent(false);
      });
  }, [sendMessage, sendAlert]);

  const deactivateEmergency = useCallback(
    (reason: string) => {
      setEmergencyActivated(false);
      setMessageSent(false);
      sendAlert(0);
      const message = reason?.trim() ? `${EMERGENCY_CLEARED} - Reason: ${reason}` : EMERGENCY_CLEARED;
      sendMessage(message)
        .then(() => {
          console.log('Emergency cleared successfully');
          Toast.show({
            type: 'success',
            text1: 'Emergency Cleared'
          });
        }).catch(() => { });
    },
    [sendMessage, sendAlert]
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
