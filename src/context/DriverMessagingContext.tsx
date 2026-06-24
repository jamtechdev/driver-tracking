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
    useCallback,
    useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { usePeakApiEnabled } from '@/hooks/usePeakApiEnabled';
import { getIncomingMessages, type IncomingMessageItem } from '@/api/incomingMessages.api';
import { messagingService } from '@/services/messaging.service';

const POLL_INTERVAL_MS = 5000;
const LAST_MSG_ID_KEY = '@driver_tracking:last_msg_id';

interface DriverMessagingContextType {
    activeAlert: IncomingMessageItem | null;
    dismissAlert: () => void;
}

const DriverMessagingContext = createContext<DriverMessagingContextType | null>(null);

function isValidVehicleId(vehicleId: string | null | undefined): vehicleId is string {
  return !!vehicleId && vehicleId !== '' && vehicleId !== '110' && vehicleId !== 'unassigned';
}

export const DriverMessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { vehicleId, isSupervisorMode, driver } = useAuth();
    const { agencyId } = useSession();
    const apiEnabled = usePeakApiEnabled();

    const [activeAlert, setActiveAlert] = useState<IncomingMessageItem | null>(null);

    const lastMessageIdRef = useRef<string | null>(null);
    const activeAlertRef = useRef<IncomingMessageItem | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const canPoll = useMemo(
      () =>
        apiEnabled &&
        !isSupervisorMode &&
        driver?.role === 'driver' &&
        isValidVehicleId(vehicleId) &&
        !!agencyId,
      [apiEnabled, isSupervisorMode, driver?.role, vehicleId, agencyId],
    );

    const markMessageSeen = useCallback((messageID: string) => {
        lastMessageIdRef.current = messageID;
        AsyncStorage.setItem(LAST_MSG_ID_KEY, messageID).catch(() => { });
    }, []);

    useEffect(() => {
        activeAlertRef.current = activeAlert;
    }, [activeAlert]);

    useEffect(() => {
        messagingService.initializeTTS();
        AsyncStorage.getItem(LAST_MSG_ID_KEY).then(val => {
            if (val) lastMessageIdRef.current = val;
            setIsInitialized(true);
        }).catch(() => {
            setIsInitialized(true);
        });
    }, []);

    const dismissAlert = useCallback(() => {
        if (dismissTimeoutRef.current) {
            clearTimeout(dismissTimeoutRef.current);
            dismissTimeoutRef.current = null;
        }
        messagingService.stop();
        const dismissedMessage = activeAlertRef.current;
        if (dismissedMessage?.messageID) {
            markMessageSeen(dismissedMessage.messageID);
        }
        setActiveAlert(null);
    }, [markMessageSeen]);

    useEffect(() => {
        if (!activeAlert) return;

        const unsubscribe = messagingService.onFinish(() => {
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

    const pollDriverMessages = useCallback(async () => {
        if (!canPoll || !isInitialized || !agencyId || !isValidVehicleId(vehicleId)) {
            return;
        }

        try {
            const list = await getIncomingMessages(agencyId, vehicleId);
            if (list.length === 0) return;

            const latest = list[0];

            if (latest.messageID !== lastMessageIdRef.current) {
                markMessageSeen(latest.messageID);
                setActiveAlert(latest);
                try {
                    await messagingService.speak(latest.message);
                } catch (error) {
                    console.warn('[DriverMessaging] TTS error:', error);
                }
            }
        } catch (e) {
            console.warn('[DriverMessaging] Error polling messages:', e);
        }
    }, [canPoll, isInitialized, agencyId, vehicleId, markMessageSeen]);

    useEffect(() => {
        if (!canPoll || !isInitialized) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        void pollDriverMessages();

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        intervalRef.current = setInterval(() => {
            void pollDriverMessages();
        }, POLL_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [canPoll, isInitialized, pollDriverMessages]);

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
