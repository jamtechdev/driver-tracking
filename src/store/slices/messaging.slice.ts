/**
 * Messaging Redux Slice
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Message, CannedMessage } from '@/api/messaging.api';

interface MessagingState {
  messages: Message[];
  cannedMessages: CannedMessage[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isTTSEnabled: boolean;
}

const initialState: MessagingState = {
  messages: [],
  cannedMessages: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  isTTSEnabled: true,
};

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
      state.unreadCount = action.payload.filter((msg) => !msg.read).length;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.unshift(action.payload);
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const message = state.messages.find((msg) => msg.id === action.payload);
      if (message && !message.read) {
        message.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    setCannedMessages: (state, action: PayloadAction<CannedMessage[]>) => {
      state.cannedMessages = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    toggleTTS: (state) => {
      state.isTTSEnabled = !state.isTTSEnabled;
    },
    clearMessages: (state) => {
      state.messages = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  setMessages,
  addMessage,
  markAsRead,
  setCannedMessages,
  setLoading,
  setError,
  toggleTTS,
  clearMessages,
} = messagingSlice.actions;

export default messagingSlice.reducer;

