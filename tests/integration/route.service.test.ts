import { routeService } from '@/services/route.service';
import { routesApi } from '@/api/routes.api';

jest.mock('@/api/routes.api', () => ({
  routesApi: {
    getAvailableRoutes: jest.fn(),
    assignRoute: jest.fn(),
    getRouteDetails: jest.fn(),
  },
}));

const dispatch = jest.fn();

describe('route.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetchAvailableRoutes success', async () => {
    (routesApi.getAvailableRoutes as jest.Mock).mockResolvedValueOnce([]);
    const r = await routeService.fetchAvailableRoutes(dispatch);
    expect(r.success).toBe(true);
  });

  it('assignRoute wires route + assignment', async () => {
    (routesApi.assignRoute as jest.Mock).mockResolvedValueOnce({ routeId: 'r', driverId: 'd', assignedAt: 't' });
    (routesApi.getRouteDetails as jest.Mock).mockResolvedValueOnce({
      id: 'r',
      name: 'N',
      routeNumber: '1',
      startTime: '',
      endTime: '',
      stops: [],
      shape: [],
    });
    const r = await routeService.assignRoute('r', dispatch);
    expect(r.success).toBe(true);
  });
});
