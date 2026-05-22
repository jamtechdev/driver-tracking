import { authService } from '@/services/auth.service';
import { authApi } from '@/api/auth.api';

jest.mock('@/api/auth.api', () => ({
  authApi: {
    login: jest.fn(),
    loginWithPin: jest.fn(),
    supervisorLogin: jest.fn(),
    logout: jest.fn(() => Promise.resolve()),
  },
}));

const dispatch = jest.fn();

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('login dispatches success path', async () => {
    (authApi.login as jest.Mock).mockResolvedValueOnce({
      token: 't',
      refreshToken: 'r',
      user: { id: '1', name: 'D', role: 'driver' },
    });
    const r = await authService.login({ username: 'u', password: 'p' }, dispatch);
    expect(r.success).toBe(true);
    expect(dispatch).toHaveBeenCalled();
  });

  it('login dispatches failure path', async () => {
    (authApi.login as jest.Mock).mockRejectedValueOnce({ message: 'bad' });
    const r = await authService.login({ username: 'u', password: 'p' }, dispatch);
    expect(r.success).toBe(false);
  });
});
