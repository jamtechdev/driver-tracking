import { messagingService } from '@/services/messaging.service';

describe('messaging.service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializeTTS resolves', async () => {
    await expect(messagingService.initializeTTS()).resolves.toBeUndefined();
  });

  it('speak and stop call TTS', () => {
    messagingService.speak('hello');
    messagingService.stop();
    const Tts = require('react-native-tts');
    expect(Tts.speak).toHaveBeenCalled();
    expect(Tts.stop).toHaveBeenCalled();
  });

  it('onFinish returns unsubscribe', () => {
    const unsub = messagingService.onFinish(jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
  });
});
