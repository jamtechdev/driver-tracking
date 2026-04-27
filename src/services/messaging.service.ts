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
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage('en-US');
      await Tts.setDefaultRate(0.5);
      await Tts.setDefaultPitch(1.0);

      // Ignore errors if already initialized
    } catch (error: any) {
      if (error.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
      console.warn('TTS initialization warning:', error);
    }
  },

  /**
   * Speak text
   */
  speak: (text: string) => {
    Tts.stop();
    Tts.speak(text);
  },

  /**
   * Stop speaking
   */
  stop: () => {
    Tts.stop();
  },

  /**
   * Register a callback for when TTS finishes
   */
  onFinish: (callback: () => void) => {
    const subscription = Tts.addListener('tts-finish', (event) => {
      callback();
    });
    return () => subscription.remove();
  },

  /**
   * Register a callback for TTS errors
   */
  onError: (callback: (error: any) => void) => {
    const subscription = Tts.addListener('tts-error', (event) => {
      callback(event);
    });
    return () => subscription.remove();
  }
};
