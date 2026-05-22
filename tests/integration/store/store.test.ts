import { store } from '@/store';

describe('Redux store', () => {
  it('combines all registered reducers', () => {
    const s = store.getState();
    expect(s).toHaveProperty('auth');
    expect(s).toHaveProperty('route');
    expect(s).toHaveProperty('passenger');
    expect(s).toHaveProperty('messaging');
    expect(s).toHaveProperty('settings');
    expect(s).toHaveProperty('inspection');
  });
});
