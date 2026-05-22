import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/storage';

describe('storage helpers (integration with AsyncStorage mock)', () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });

  it('round-trips JSON values', async () => {
    const ok = await setStorageItem('prefs', { theme: 'dark' });
    expect(ok).toBe(true);

    const read = await getStorageItem<{ theme: string }>('prefs');
    expect(read).toEqual({ theme: 'dark' });
  });

  it('removeStorageItem clears a key', async () => {
    await setStorageItem('tmp', { a: 1 });
    await removeStorageItem('tmp');
    const read = await getStorageItem('tmp');
    expect(read).toBeNull();
  });
});
