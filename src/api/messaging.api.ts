/**
 * Messaging API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';

export interface Message {
  id: string;
  type: 'driver' | 'dispatcher' | 'system';
  content: string;
  timestamp: string;
  read: boolean;
}

export interface CannedMessage {
  id: string;
  text: string;
  category?: string;
}

export interface SendMessageRequest {
  message: string;
  recipientId?: string;
  type?: 'driver' | 'dispatcher';
}

export const messagingApi = {
  /**
   * Send a message
   */
  sendMessage: async (request: SendMessageRequest): Promise<Message> => {
    const response = await apiClient.post<Message>(
      API_ENDPOINTS.MESSAGING.SEND,
      request
    );
    return response.data;
  },

  /**
   * Get received messages
   */
  getMessages: async (): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>(API_ENDPOINTS.MESSAGING.RECEIVE);
    return response.data;
  },

  /**
   * Get canned messages
   */
  getCannedMessages: async (): Promise<CannedMessage[]> => {
    const response = await apiClient.get<CannedMessage[]>(
      API_ENDPOINTS.MESSAGING.CANNED
    );
    return response.data;
  },

  /**
   * Mark message as read
   */
  markAsRead: async (messageId: string): Promise<void> => {
    await apiClient.post(API_ENDPOINTS.MESSAGING.MARK_READ(messageId));
  },
};

