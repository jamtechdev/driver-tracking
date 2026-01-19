/**
 * Messaging Type Definitions
 */

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

