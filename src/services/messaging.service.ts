/**
 * Messaging Service
 * Handles messaging and TTS functionality
 * Placeholder - to be implemented in Week 7
 */

import Tts from 'react-native-tts';

export const messagingService = {
  /**
   * Initialize TTS
   */
  initializeTTS: async () => {
    try {
      await Tts.setDefaultLanguage('en-US');
      await Tts.setDefaultRate(0.5);
      await Tts.setDefaultPitch(1.0);
    } catch (error) {
      console.error('TTS initialization error:', error);
    }
  },

  /**
   * Speak text
   */
  speak: (text: string) => {
    Tts.speak(text);
  },

  /**
   * Stop speaking
   */
  stop: () => {
    Tts.stop();
  },
};

