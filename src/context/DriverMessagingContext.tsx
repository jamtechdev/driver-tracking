/**
 * Driver Messaging Context - Separate from Supervisor Messages
 * Specifically for Driver role: Polls, Alerts, and TTS
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback
} from 'react';

import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { getIncomingMessages, type IncomingMessageItem } from '@/api/incomingMessages.api';
import { messagingService } from '@/services/messaging.service';

const POLL_INTERVAL_MS = 5000;

interface DriverMessagingContextType {
    activeAlert: IncomingMessageItem | null;
    dismissAlert: () => void;
}

const DriverMessagingContext = createContext<DriverMessagingContextType | null>(null);

export const DriverMessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const { vehicleId, isSupervisorMode, driver } = useAuth();

    const [activeAlert, setActiveAlert] = useState<IncomingMessageItem | null>(null);

    const lastMessageIdRef = useRef<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

    /**
     * Polling allowed condition
     */
    const shouldPoll =
        !isSupervisorMode &&
        driver?.role === 'driver' &&
        !!vehicleId &&
        vehicleId !== '110';
    // console.log('shouldPoll', shouldPoll);
    /**
     * Initialize TTS once
     */
    useEffect(() => {
        messagingService.initializeTTS();
    }, []);

    /**
     * Dismiss alert
     */
    const dismissAlert = useCallback(() => {
        messagingService.stop();
        setActiveAlert(null);
    }, []);

    /**
     * Auto close modal when TTS finishes
     */
    useEffect(() => {
        if (!activeAlert) return;

        const unsubscribe = messagingService.onFinish(() => {
            setActiveAlert(null);
        });

        return () => unsubscribe();
    }, [activeAlert]);

    /**
     * Poll messages
     */
    const pollDriverMessages = useCallback(async () => {

        if (!shouldPoll) return;

        try {


            const list = await getIncomingMessages(agencyID, vehicleId!);
            console.log('Driver message list----->>>>>>>>>', list);
            if (list.length > 0) {

                const latest = list[0];

                if (latest.messageID !== lastMessageIdRef.current) {

                    /**
                     * Avoid showing alert on first load
                     */
                    if (lastMessageIdRef.current !== null) {
                        setActiveAlert(latest);
                        messagingService.speak(latest.message);
                    }

                    lastMessageIdRef.current = latest.messageID;
                }

            } else {
                lastMessageIdRef.current = '';
            }

        } catch (e) {
            console.warn('[DriverMessaging] Error polling messages:', e);
        }

    }, [agencyID, vehicleId, shouldPoll]);

    /**
     * Start / Stop polling
     */
    useEffect(() => {


        if (!shouldPoll) {

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            return;
        }

        /**
         * Initial poll
         */
        pollDriverMessages();

        /**
         * Reset interval if exists
         */
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(
            pollDriverMessages,
            POLL_INTERVAL_MS
        );

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

    }, [shouldPoll, pollDriverMessages]);

    return (
        <DriverMessagingContext.Provider value={{ activeAlert, dismissAlert }}>
            {children}
        </DriverMessagingContext.Provider>
    );
};

export const useDriverMessaging = (): DriverMessagingContextType => {

    const ctx = useContext(DriverMessagingContext);

    if (!ctx) {
        throw new Error('useDriverMessaging must be used within DriverMessagingProvider');
    }

    return ctx;
};