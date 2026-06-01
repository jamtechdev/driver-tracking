import {
  getCalendarIDs,
  getManifestsForToday,
  assignBlockManifest,
  assignBlockToVehicle,
  deleteManifestAssignment,
  getManifestAssignmentsByVehicle,
  getManifestAssignmentsForToday,
  releaseVehicleForOutOfService,
} from '@/api/manifests.api';
import { selfUpdateAssignment, selfUpdateDelete } from '@/api/position.api';

jest.mock('@/api/position.api', () => ({
  selfUpdateAssignment: jest.fn(() => Promise.resolve({ success: true })),
  selfUpdateDelete: jest.fn(() => Promise.resolve({ success: true })),
}));

describe('manifests.api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('getCalendarIDs parses calendar ids', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ calendar: { calendarID: [1, 2] } }),
    });
    await expect(getCalendarIDs('2024-01-01')).resolves.toEqual([1, 2]);
  });

  it('getManifestsForToday aggregates block manifests', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ calendar: { calendarID: [9] } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifests: [
            { manifestID: 1, disabled: false, hidden: false, type: 'block' },
            { manifestID: 2, disabled: false, hidden: false, type: 'route' },
          ],
        }),
      });
    const manifests = await getManifestsForToday('2024-01-01');
    expect(manifests).toHaveLength(1);
    expect(manifests[0].type).toBe('block');
  });

  it('assignBlockManifest includes driverID and reads success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });
    const result = await assignBlockManifest(1, '163149', 2660);
    expect(result.success).toBe(true);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('driverID=2660');
  });

  it('assignBlockManifest surfaces server errormsg', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: false,
        errormsg: 'manifestID must belong to a valid block',
      }),
    });
    const result = await assignBlockManifest(1, 'v', 1);
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('valid block');
  });

  it('assignBlockToVehicle syncs route', async () => {
    const block = {
      manifestID: 18866,
      agencyID: 121,
      name: 'Weekend Service',
      type: 'block',
      manifest: '',
      manifestJson: JSON.stringify([{ type: 'trip', routeID: 12937 }]),
      hidden: false,
      calendarID: 1,
      updated: 0,
      disabled: false,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => ({ success: true }) })
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: { manifestAssignmentID: [99] },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: [
            {
              manifestAssignmentID: 99,
              manifestID: 18866,
              vehicleID: 10,
              driverID: 1,
              disabled: false,
            },
          ],
        }),
      });

    const result = await assignBlockToVehicle({
      block,
      vehicleID: '10',
      driverID: 1,
    });

    expect(result.success).toBe(true);
    expect(result.routeID).toBe('12937');
    expect(selfUpdateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleID: '10', routeID: '12937', driverID: 1 }),
    );
  });

  it('releaseVehicleForOutOfService clears blocks and route', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: { manifestAssignmentID: [55] },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: [
            {
              manifestAssignmentID: 55,
              manifestID: 1,
              vehicleID: 10,
              disabled: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ json: async () => ({ success: true }) });

    const result = await releaseVehicleForOutOfService({
      vehicleID: '10',
      driverID: 1,
    });

    expect(result.success).toBe(true);
    expect(selfUpdateDelete).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleID: '10', driverID: 1 }),
    );
    expect(selfUpdateAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleID: '10', routeID: 0, driverID: 1 }),
    );
  });

  it('deleteManifestAssignment', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });
    await expect(deleteManifestAssignment(99)).resolves.toBe(true);
  });

  it('getManifestAssignmentsByVehicle uses between + list', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: { manifestAssignmentID: [1, 2] },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: [
            { manifestAssignmentID: 1, vehicleID: 10, manifestID: 1, disabled: false },
          ],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifestAssignments: [
            { manifestAssignmentID: 2, vehicleID: 20, manifestID: 2, disabled: false },
          ],
        }),
      });

    const rows = await getManifestAssignmentsByVehicle('10', '2024-01-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].vehicleID).toBe(10);
  });

  it('getManifestAssignmentsForToday returns all assignments', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        manifestAssignments: [
          { manifestAssignmentID: 1, vehicleID: 10, manifestID: 1 },
          { manifestAssignmentID: 2, vehicleID: 20, manifestID: 2 },
        ],
      }),
    });
    const rows = await getManifestAssignmentsForToday('2024-01-01');
    expect(rows).toHaveLength(2);
  });
});
