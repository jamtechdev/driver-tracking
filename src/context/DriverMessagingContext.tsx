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
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { getIncomingMessages, type IncomingMessageItem } from '@/api/incomingMessages.api';
import { messagingService } from '@/services/messaging.service';
import { Platform } from 'react-native';

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
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstPollRef = useRef(true);
    const [isInitialized, setIsInitialized] = useState(false);

    const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);
    const LAST_MSG_ID_KEY = '@driver_tracking:last_msg_id';

    /**
     * Polling allowed condition
     */
    const shouldPoll =
        !isSupervisorMode &&
        driver?.role === 'driver'
    // !!vehicleId &&
    // vehicleId !== '110';
    // console.log('shouldPoll', shouldPoll);
    /**
     * Initialize TTS and seen message ID
     */
    useEffect(() => {
        messagingService.initializeTTS();
        AsyncStorage.getItem(LAST_MSG_ID_KEY).then(val => {
            if (val) lastMessageIdRef.current = val;
            setIsInitialized(true);
        }).catch(() => {
            setIsInitialized(true);
        });
    }, []);

    /**
     * Reset suppression flag when vehicle context changes
     */
    useEffect(() => {
        isFirstPollRef.current = true;
    }, [vehicleId]);

    /**
     * Dismiss alert
     */
    const dismissAlert = useCallback(() => {
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
        if (Platform.OS === 'android') {
            messagingService.stop();
        }
        setActiveAlert(null);
    }, [dismissTimeoutRef]);

    /**
     * Auto close modal when TTS finishes
     */
    useEffect(() => {
        if (!activeAlert) return;

        const unsubscribe = messagingService.onFinish(() => {
            // TTS finished, remain visible for 4 seconds then auto-dismiss
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = setTimeout(() => {
                setActiveAlert(null);
                dismissTimeoutRef.current = null;
            }, 4000);
        });

        return () => {
            unsubscribe();
            if (dismissTimeoutRef.current) {
                clearTimeout(dismissTimeoutRef.current);
                dismissTimeoutRef.current = null;
            }
        };
    }, [activeAlert]);

    /**
     * Poll messages
     */
    const pollDriverMessages = useCallback(async () => {
        if (!isInitialized) return;
        // if (!shouldPoll) return;

        try {


            const list = await getIncomingMessages(agencyID, vehicleId!);
            console.log('Driver message list----->>>>>>>>>', list);
            if (list.length > 0) {

                const latest = list[0];

                if (latest.messageID !== lastMessageIdRef.current) {
                    /**
                     * Only trigger the alert if this is NOT the very first poll
                     * of this session or vehicle context. This ensures that 
                     * messages already in the inbox at start-time/login are suppressed.
                     */
                    if (!isFirstPollRef.current) {
                        setActiveAlert(latest);
                        messagingService.speak(latest.message);
                    }

                    lastMessageIdRef.current = latest.messageID;
                    AsyncStorage.setItem(LAST_MSG_ID_KEY, latest.messageID).catch(() => { });
                }

                // Regardless of whether it's a new message, once we've processed the list
                // the first time, subsequent changes are considered "new arrivals".
                isFirstPollRef.current = false;

            }

        } catch (e) {
            console.warn('[DriverMessaging] Error polling messages:', e);
        }

    }, [agencyID, vehicleId, shouldPoll]);

    /**
     * Start / Stop polling
     */
    useEffect(() => {


        // if (!shouldPoll) {

        //     if (intervalRef.current) {
        //         clearInterval(intervalRef.current);
        //         intervalRef.current = null;
        //     }

        //     return;
        // }

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