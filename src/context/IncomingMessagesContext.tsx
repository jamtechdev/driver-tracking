/**
 * Incoming Messages Context - Polls getMessages API every 5 seconds
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { getIncomingMessages, type IncomingMessageItem } from '@/api/incomingMessages.api';

const POLL_INTERVAL_MS = 5000;

interface IncomingMessagesContextType {
  messages: IncomingMessageItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const IncomingMessagesContext = createContext<IncomingMessagesContextType | null>(null);

export const IncomingMessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vehicleId, isSupervisorMode } = useAuth();
  const [messages, setMessages] = useState<IncomingMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  const fetchMessages = useCallback(async () => {
    // For normal drivers, we need a vehicleId. 
    // For supervisors, we want all messages for the agency.
    if (!isSupervisorMode && (!vehicleId || vehicleId === '')) return;

    setLoading(true);
    setError(null);
    try {
      const vId = isSupervisorMode ? null : vehicleId;
      const list = await getIncomingMessages(agencyID, vId);
      setMessages(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [agencyID, vehicleId, isSupervisorMode]);

  useEffect(() => {
    if (!isSupervisorMode && (!vehicleId || vehicleId === '')) {
      setMessages([]);
      setError(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchMessages();

    intervalRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [vehicleId, isSupervisorMode, fetchMessages]);

  const value: IncomingMessagesContextType = {
    messages,
    loading,
    error,
    refetch: fetchMessages,
  };

  return (
    <IncomingMessagesContext.Provider value={value}>
      {children}
    </IncomingMessagesContext.Provider>
  );
};

export const useIncomingMessages = (): IncomingMessagesContextType => {
  const ctx = useContext(IncomingMessagesContext);
  if (!ctx) throw new Error('useIncomingMessages must be used within IncomingMessagesProvider');
  return ctx;
};
