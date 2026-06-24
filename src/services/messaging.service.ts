/**
 * Messaging Service
 * Handles messaging and TTS functionality
 */

import { Platform } from 'react-native';
import Tts from 'react-native-tts';
import { APP_CONSTANTS } from '@/utils/constants';

let ttsInitPromise: Promise<void> | null = null;

async function selectIOSVoice(): Promise<void> {
  const voices = await Tts.voices();
  const englishVoices = voices.filter(
    (voice) => voice.language?.toLowerCase().startsWith('en') && !voice.notInstalled
  );
  const preferred =
    englishVoices.find(
      (voice) => /samantha/i.test(voice.name) || /samantha/i.test(voice.id)
    ) ??
    englishVoices.find((voice) => voice.quality >= 300) ??
    englishVoices[0];

  if (preferred) {
    await Tts.setDefaultVoice(preferred.id);
  }
}

export const messagingService = {
  /**
   * Initialize TTS (idempotent; safe to call before first speak).
   */
  initializeTTS: async () => {
    if (!ttsInitPromise) {
      ttsInitPromise = (async () => {
        try {
          await Tts.getInitStatus();

          try {
            await Tts.setDefaultLanguage('en-US');
          } catch {
            // Fall back to the system default language.
          }

          if (Platform.OS === 'ios') {
            try {
              await Tts.setIgnoreSilentSwitch('ignore');
            } catch {
              // Non-fatal: continue with default silent-switch behavior.
            }
            try {
              await selectIOSVoice();
            } catch (error) {
              console.warn('TTS voice selection warning:', error);
            }
            // iOS native setDefaultRate uses an unsupported BOOL* arg; rate is set per utterance in speak().
          } else {
            await Tts.setDefaultRate(APP_CONSTANTS.TTS_RATE);
          }

          await Tts.setDefaultPitch(APP_CONSTANTS.TTS_PITCH);
        } catch (error: any) {
          ttsInitPromise = null;
          if (error.code === 'no_engine') {
            Tts.requestInstallEngine();
          }
          console.warn('TTS initialization warning:', error);
          throw error;
        }
      })();
    }
    return ttsInitPromise;
  },

  /**
   * Speak text (waits for TTS engine so the first message after launch is heard).
   */
  speak: async (text: string) => {
    try {
      await messagingService.initializeTTS();
    } catch {
      // Continue with system defaults if initialization partially failed.
    }
    Tts.stop();
    if (Platform.OS === 'ios') {
      Tts.speak(text, { rate: APP_CONSTANTS.TTS_RATE });
    } else {
      Tts.speak(text);
    }
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
    const subscription = Tts.addListener('tts-finish', () => {
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
  },
};
