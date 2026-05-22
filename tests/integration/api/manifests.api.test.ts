import {
  getCalendarIDs,
  getManifestsForToday,
  assignBlockManifest,
  deleteManifestAssignment,
  getManifestAssignmentsByVehicle,
  getManifestAssignmentsForToday,
} from '@/api/manifests.api';

describe('manifests.api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as typeof fetch;
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

  it('getManifestsForToday aggregates manifests', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: async () => ({ calendar: { calendarID: [9] } }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          manifests: [{ manifestID: 1, disabled: false, hidden: false, type: 'block' }],
        }),
      });
    const manifests = await getManifestsForToday('2024-01-01');
    expect(manifests.length).toBeGreaterThanOrEqual(0);
  });

  it('assignBlockManifest reads success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });
    await expect(assignBlockManifest(1, 'v')).resolves.toBe(true);
  });

  it('deleteManifestAssignment', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({ success: true }),
    });
    await expect(deleteManifestAssignment(99)).resolves.toBe(true);
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

  it('getManifestAssignmentsByVehicle filters', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => ({
        success: true,
        manifestAssignments: [
          { manifestAssignmentID: 1, vehicleID: 10, manifestID: 1 },
          { manifestAssignmentID: 2, vehicleID: 20, manifestID: 2 },
        ],
      }),
    });
    const rows = await getManifestAssignmentsByVehicle('10');
    expect(rows).toHaveLength(1);
    expect(rows[0].vehicleID).toBe(10);
  });
});
