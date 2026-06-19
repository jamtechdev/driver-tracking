import {
  shouldApplyOutOfServiceRouteFromPoll,
  getRouteIdFromAssignmentResult,
  decideBlockManifestSync,
  ASSIGNMENT_ROUTE_STICKY_MS,
} from '@/utils/assignmentSync';
import type { ManifestAssignment } from '@/api/manifests.api';
import { getMdtRouteIdForVehicleUpdate } from '@/utils/resolveOutboundRouteId';

describe('assignment route sync', () => {
  it('does not apply OOS route during sticky window after server assignment', () => {
    const now = Date.now();
    const result = { hasAssignment: false } as const;
    expect(
      shouldApplyOutOfServiceRouteFromPoll(result, now - 1000, now - 1000),
    ).toBe(false);
  });

  it('applies OOS route when server confirms empty after sticky window', () => {
    const now = Date.now();
    const result = { hasAssignment: false } as const;
    expect(
      shouldApplyOutOfServiceRouteFromPoll(
        result,
        now - ASSIGNMENT_ROUTE_STICKY_MS - 1000,
        now - ASSIGNMENT_ROUTE_STICKY_MS - 1000,
      ),
    ).toBe(true);
  });

  it('prefers tablet route then sticky assignment for vehicle update', () => {
    expect(
      getMdtRouteIdForVehicleUpdate({
        selectedRouteId: '42',
        serviceStatus: 'in_service',
        routeOverride: false,
        assignment: { routeID: 99 },
        stickyAssignmentRouteId: '99',
        currentRouteIdFromApi: '99',
      }),
    ).toBe('42');
  });

  it('holds sticky assignment route when local is briefly OOS', () => {
    expect(
      getMdtRouteIdForVehicleUpdate({
        selectedRouteId: null,
        serviceStatus: 'out_of_service',
        routeOverride: false,
        assignment: null,
        stickyAssignmentRouteId: '77',
        currentRouteIdFromApi: null,
      }),
    ).toBe('77');
  });

  it('sends -1 for manual tablet OOS override', () => {
    expect(
      getMdtRouteIdForVehicleUpdate({
        selectedRouteId: null,
        serviceStatus: 'out_of_service',
        routeOverride: true,
        assignment: { routeID: 77 },
        stickyAssignmentRouteId: '77',
        currentRouteIdFromApi: '77',
      }),
    ).toBe(-1);
  });

  it('reads route from assignment API currentRouteID', () => {
    expect(
      getRouteIdFromAssignmentResult(
        { hasAssignment: true, currentRouteID: 12 },
        { routeID: 99 },
      ),
    ).toBe('12');
  });

  it('clears local block when server manifest assignment is removed', () => {
    expect(decideBlockManifestSync(18866, [])).toEqual({
      action: 'clear_block',
      manifestId: null,
    });
  });

  it('applies server block when admin assigns a different manifest', () => {
    const server: ManifestAssignment[] = [
      { manifestID: 42, disabled: false } as ManifestAssignment,
    ];
    expect(decideBlockManifestSync(18866, server)).toEqual({
      action: 'apply_block',
      manifestId: 42,
    });
  });

  it('does nothing when local and server block manifest match', () => {
    const server: ManifestAssignment[] = [
      { manifestID: 18866, disabled: false } as ManifestAssignment,
    ];
    expect(decideBlockManifestSync(18866, server)).toEqual({
      action: 'none',
      manifestId: null,
    });
  });

  it('ignores disabled server manifest assignments', () => {
    const server: ManifestAssignment[] = [
      { manifestID: 18866, disabled: true } as ManifestAssignment,
    ];
    expect(decideBlockManifestSync(18866, server)).toEqual({
      action: 'clear_block',
      manifestId: null,
    });
  });
});
