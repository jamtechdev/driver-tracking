import { authApi } from '@/api/auth.api';
import apiClient, { setAuthTokens } from '../../src/api/client';

jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  setAuthTokens: jest.fn(() => Promise.resolve()),
  clearAuthTokens: jest.fn(() => Promise.resolve()),
}));

const mockedPost = apiClient.post as jest.Mock;
const mockedGet = apiClient.get as jest.Mock;
const mockedSetAuthTokens = setAuthTokens as jest.Mock;

describe('authApi (integration with mocked HTTP client)', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedGet.mockReset();
    mockedSetAuthTokens.mockClear();
  });

  it('login persists tokens from the response', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        token: 'access',
        refreshToken: 'refresh',
        user: { id: '1', name: 'Test', role: 'driver' as const },
      },
    });

    const result = await authApi.login({ username: 'u', password: 'p' });

    expect(mockedPost).toHaveBeenCalled();
    expect(mockedSetAuthTokens).toHaveBeenCalledWith('access', 'refresh');
    expect(result.token).toBe('access');
  });

  it('verifySession returns false when the request fails', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network'));

    await expect(authApi.verifySession()).resolves.toBe(false);
  });
});
