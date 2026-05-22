import apiClient from '../../../src/api/client';
import { routesApi } from '@/api/routes.api';
import { messagingApi } from '@/api/messaging.api';
import { inspectionApi } from '@/api/inspection.api';
import { passengerApi } from '@/api/passenger.api';

jest.mock('../../../src/api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  setAuthTokens: jest.fn(() => Promise.resolve()),
  clearAuthTokens: jest.fn(() => Promise.resolve()),
}));

const getMock = apiClient.get as jest.Mock;
const postMock = apiClient.post as jest.Mock;

describe('apiClient-backed APIs', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  describe('routesApi', () => {
    it('getAvailableRoutes', async () => {
      getMock.mockResolvedValueOnce({ data: [{ id: '1' }] });
      const rows = await routesApi.getAvailableRoutes();
      expect(rows).toEqual([{ id: '1' }]);
    });

    it('assignRoute', async () => {
      postMock.mockResolvedValueOnce({ data: { routeId: 'r', driverId: 'd', assignedAt: 't' } });
      const a = await routesApi.assignRoute('r');
      expect(a.routeId).toBe('r');
    });
  });

  describe('messagingApi', () => {
    it('sendMessage and getMessages', async () => {
      postMock.mockResolvedValueOnce({
        data: { id: '1', type: 'driver', content: 'x', timestamp: 't', read: false },
      });
      const m = await messagingApi.sendMessage({ message: 'x' });
      expect(m.id).toBe('1');

      getMock.mockResolvedValueOnce({ data: [] });
      await expect(messagingApi.getMessages()).resolves.toEqual([]);
    });
  });

  describe('inspectionApi', () => {
    it('getPreTripForm', async () => {
      const form = {
        type: 'pre-trip' as const,
        routeId: 'r',
        vehicleId: 'v',
        items: [],
        timestamp: '',
      };
      getMock.mockResolvedValueOnce({ data: form });
      await expect(inspectionApi.getPreTripForm()).resolves.toEqual(form);
    });
  });

  describe('passengerApi (apiClient paths)', () => {
    it('syncPassengerData posts', async () => {
      postMock.mockResolvedValueOnce({ data: {} });
      await passengerApi.syncPassengerData({ routeId: 'r', tallies: [] });
      expect(postMock).toHaveBeenCalled();
    });
  });
});
