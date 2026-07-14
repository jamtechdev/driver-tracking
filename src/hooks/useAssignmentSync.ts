/**
 * Polls server assignment — mirrors iOS DriverModel updateAssignment (10s).
 * MDT/vehicle driverID come from selectedDriver state only, not from this hook at send time.
 */

import { useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { ManifestAssignment } from '@/api/manifests.api';
import type { Driver } from '@/data/drivers';
import { DRIVERS } from '@/data/drivers';
import { getAssignment, type AssignmentResponse, type VehicleAssignmentPayload } from '@/api/position.api';
import { getManifestAssignmentsByVehicle, getManifestsForToday } from '@/api/manifests.api';
import { getPrimaryRouteIdFromManifestJson } from '@/utils/manifestMap';
import { isAssignedRouteId } from '@/utils/helpers';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import {
  parseAssignmentDriverId,
  resolveVehicleAssignmentSources,
} from '@/utils/assignmentDriverId';
import { selectDriverFromAssignmentIos } from '@/services/driverAssignment.service';
import {
  decideBlockManifestSync,
  getRouteIdFromAssignmentResult,
  hasServerAssignment,
  shouldApplyOutOfServiceRouteFromPoll,
  shouldKeepLocalRouteDuringPoll,
  shouldUnassignDriverFromPoll,
} from '@/utils/assignmentSync';
import { pickRouteIdFromAssignmentPoll } from '@/utils/resolveOutboundRouteId';

const POLL_INTERVAL_MS = 10000;
const POLL_INTERVAL_UNASSIGNED_MS = 3000;
const ROUTE_GRACE_SECONDS = 60;
/** Ignore transient empty assignment API responses right after adopting a dashboard driver. */
const ADOPT_UNASSIGN_GRACE_MS = 45000;

const unassignedDriver = DRIVERS.find((d) => d.role === 'unassigned') || DRIVERS[0];

export interface AssignmentSyncHandlers {
  peakApiEnabled: boolean;
  vehicleId: string | null;
  isSupervisorMode: boolean;
  driver: Driver | null;
  setDriver: (driver: Driver) => void;
  applyRouteFromServer: (
    label: string,
    routeId: string | null,
    manifestId: number | null,
    serviceStatus: 'in_service' | 'out_of_service',
  ) => void;
  driverOverrideRef: MutableRefObject<boolean>;
  routeOverrideRef: MutableRefObject<boolean>;
  routeLastSelectedRef: MutableRefObject<number>;
  assignmentRef: MutableRefObject<VehicleAssignmentPayload | null>;
  manualUnassignActiveRef: MutableRefObject<boolean>;
  manualUnassignBlockedDriverIdRef: MutableRefObject<string | null>;
  assignmentBootstrapDone: boolean;
  /** iOS selectDriverID(-2): sync selectedDriver + MDT ref before slow route work. */
  adoptDriverFromAssignment?: (
    driver: Driver,
    assignment: VehicleAssignmentPayload,
  ) => void;
  /** iOS selectVehicleID → updateAssignment immediately. */
  registerAssignmentSync?: (run: (() => void) | null) => void;
  /** Register fn to clear adopt grace (call on tablet manual unassign). */
  registerAdoptGraceClear?: (clear: (() => void) | null) => void;
  /** Raw assignment API response (telemetry refs, sticky route). */
  onAssignmentApiResponse?: (result: AssignmentResponse) => void;
  /** Timestamp ref: last poll with hasAssignment=1 (sticky route window). */
  lastServerAssignmentAtRef: MutableRefObject<number>;
  /** Local block manifest — compared to server on each poll. */
  selectedManifestIdRef: MutableRefObject<number | null>;
  selectedManifestId: number | null;
  selectedRouteIdRef: MutableRefObject<string | null>;
  serviceStatusRef: MutableRefObject<'in_service' | 'out_of_service'>;
}

function parseAssignmentId(raw: unknown): string | null {
  return parseAssignmentDriverId(raw);
}

function isAssignmentLocked(assignment: VehicleAssignmentPayload): boolean {
  const locked = assignment.locked;
  return locked === true || locked === 1 || locked === '1';
}

function shouldHoldStaleServerDriver(
  manualUnassignActive: boolean,
  localDriver: Driver | null,
  assignedDriverId: string,
  blockedDriverId: string | null,
): boolean {
  if (!manualUnassignActive || !blockedDriverId) return false;
  if (localDriver?.role !== 'unassigned') return false;
  return assignedDriverId.trim() === blockedDriverId.trim();
}

async function resolveRouteLabel(routeId: string): Promise<string> {
  const { findRouteLabelById, lookupRouteLabelById } = await import('@/utils/routeLookup');
  const cached = findRouteLabelById(routeId);
  if (cached) return cached;
  const lookedUp = await lookupRouteLabelById(routeId);
  return lookedUp || routeId;
}

async function applyBlockManifestFromServer(
  manifestId: number,
  applyRouteFromServer: AssignmentSyncHandlers['applyRouteFromServer'],
): Promise<void> {
  const allManifests = await getManifestsForToday();
  const match = allManifests.find((m) => m.manifestID === manifestId);
  const blockRouteId = getPrimaryRouteIdFromManifestJson(match?.manifestJson);
  applyRouteFromServer(
    match?.name || `Block ${manifestId}`,
    isAssignedRouteId(blockRouteId) ? blockRouteId : null,
    manifestId,
    'in_service',
  );
}

async function clearBlockManifestFromServer(
  result: AssignmentResponse,
  assignment: VehicleAssignmentPayload | null | undefined,
  applyRouteFromServer: AssignmentSyncHandlers['applyRouteFromServer'],
): Promise<void> {
  const routeId = getRouteIdFromAssignmentResult(result, assignment ?? null);
  if (routeId != null && isAssignedRouteId(routeId)) {
    const label = await resolveRouteLabel(routeId);
    applyRouteFromServer(label, routeId, null, 'in_service');
    return;
  }
  applyRouteFromServer('Out of Service', null, null, 'out_of_service');
}

export function useAssignmentSync(handlers: AssignmentSyncHandlers): void {
  const {
    peakApiEnabled,
    vehicleId,
    isSupervisorMode,
    driver,
    setDriver,
    applyRouteFromServer,
    driverOverrideRef,
    routeOverrideRef,
    routeLastSelectedRef,
    assignmentRef,
    manualUnassignActiveRef,
    manualUnassignBlockedDriverIdRef,
    assignmentBootstrapDone,
    adoptDriverFromAssignment,
    registerAssignmentSync,
    registerAdoptGraceClear,
    onAssignmentApiResponse,
    lastServerAssignmentAtRef,
    selectedManifestIdRef,
    selectedManifestId,
    selectedRouteIdRef,
    serviceStatusRef,
  } = handlers;

  const inFlightRef = useRef(false);
  const applyAssignmentRef = useRef<() => Promise<void>>(async () => {});
  const lastAdoptedAtRef = useRef(0);
  const lastRouteAdoptedAtRef = useRef(0);

  const applyAssignment = useCallback(async () => {
    if (!peakApiEnabled) return;
    if (!vehicleId || vehicleId === '110' || isSupervisorMode) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const result: AssignmentResponse = await getAssignment(
        vehicleId,
        String(PEAK_DEFAULT_PARAMS.agencyID),
      );
      onAssignmentApiResponse?.(result);
      const serverHasAssignment = hasServerAssignment(result);
      if (serverHasAssignment) {
        lastServerAssignmentAtRef.current = Date.now();
      }

      const {
        assignedDriverId,
        assignment,
        hasAssignment,
      } = await resolveVehicleAssignmentSources(vehicleId, result);

      if (assignment) {
        assignmentRef.current = assignment;
      } else if (
        !serverHasAssignment &&
        shouldApplyOutOfServiceRouteFromPoll(
          result,
          lastRouteAdoptedAtRef.current,
          lastServerAssignmentAtRef.current,
        ) &&
        !assignedDriverId
      ) {
        assignmentRef.current = null;
      }

      if (assignment && isAssignmentLocked(assignment)) {
        manualUnassignActiveRef.current = false;
        manualUnassignBlockedDriverIdRef.current = null;
        driverOverrideRef.current = false;
        if (
          !isAssignedRouteId(selectedRouteIdRef.current) ||
          serviceStatusRef.current !== 'in_service'
        ) {
          routeOverrideRef.current = false;
        }
      }

      const currentRouteId = result.currentRouteID != null
        ? String(result.currentRouteID)
        : null;

      // iOS updateAssignment: driver + route from assignment before other work
      if (!driverOverrideRef.current) {
        if (hasAssignment && assignedDriverId) {
          const holdStale = shouldHoldStaleServerDriver(
            manualUnassignActiveRef.current,
            driver,
            assignedDriverId,
            manualUnassignBlockedDriverIdRef.current,
          );
          if (!holdStale) {
            manualUnassignActiveRef.current = false;
            manualUnassignBlockedDriverIdRef.current = null;
            const assignmentForDriver = assignment ?? { driverID: assignedDriverId };
            const resolved = await selectDriverFromAssignmentIos({
              vehicleId,
              currentDriver: driver,
              assignment: assignmentForDriver,
            });
            if (resolved) {
              lastAdoptedAtRef.current = Date.now();
              adoptDriverFromAssignment?.(resolved, assignmentForDriver);
              setDriver(resolved);
            }
          }
        } else if (
          shouldUnassignDriverFromPoll(result, driver) &&
          !assignedDriverId &&
          Date.now() - lastAdoptedAtRef.current > ADOPT_UNASSIGN_GRACE_MS
        ) {
          manualUnassignActiveRef.current = false;
          manualUnassignBlockedDriverIdRef.current = null;
          setDriver(unassignedDriver);
        }
      }

      const serverManifestAssignments: ManifestAssignment[] =
        await getManifestAssignmentsByVehicle(vehicleId);
      const blockSync = decideBlockManifestSync(
        selectedManifestIdRef.current,
        serverManifestAssignments,
      );

      if (blockSync.action === 'apply_block' && blockSync.manifestId != null) {
        routeOverrideRef.current = false;
        await applyBlockManifestFromServer(blockSync.manifestId, applyRouteFromServer);
        lastRouteAdoptedAtRef.current = Date.now();
      } else if (blockSync.action === 'clear_block') {
        routeOverrideRef.current = false;
        await clearBlockManifestFromServer(result, assignment, applyRouteFromServer);
        lastRouteAdoptedAtRef.current = Date.now();
      } else if (!routeOverrideRef.current) {
        // iOS updateAssignment: route from assignment immediately when hasAssignment=1
        if (serverHasAssignment && assignment) {
          const assignedRouteId = parseAssignmentId(assignment.routeID);
          const routeIdFromServer = pickRouteIdFromAssignmentPoll(
            assignedRouteId,
            currentRouteId,
            getRouteIdFromAssignmentResult(result, assignment),
          );
          const routeIdToApply = shouldKeepLocalRouteDuringPoll(
            selectedRouteIdRef.current,
            serviceStatusRef.current,
            routeIdFromServer,
          )
            ? selectedRouteIdRef.current
            : routeIdFromServer;

          if (routeIdToApply) {
            const label = await resolveRouteLabel(routeIdToApply);
            applyRouteFromServer(label, routeIdToApply, null, 'in_service');
            lastRouteAdoptedAtRef.current = Date.now();
          } else {
            const active = serverManifestAssignments.find((a) => !a.disabled);
            if (active) {
              await applyBlockManifestFromServer(active.manifestID, applyRouteFromServer);
              lastRouteAdoptedAtRef.current = Date.now();
            }
          }
        } else if (
          shouldApplyOutOfServiceRouteFromPoll(
            result,
            lastRouteAdoptedAtRef.current,
            lastServerAssignmentAtRef.current,
          )
        ) {
          const now = Date.now() / 1000;
          if (routeLastSelectedRef.current + ROUTE_GRACE_SECONDS < now) {
            if (isAssignedRouteId(currentRouteId)) {
              const label = await resolveRouteLabel(currentRouteId!);
              applyRouteFromServer(label, currentRouteId, null, 'in_service');
            } else {
              applyRouteFromServer('Out of Service', null, null, 'out_of_service');
            }
          }
        }
      }
    } catch (e) {
      console.warn('[useAssignmentSync] Poll failed:', e);
    } finally {
      inFlightRef.current = false;
    }
  }, [
    peakApiEnabled,
    vehicleId,
    isSupervisorMode,
    driver,
    setDriver,
    applyRouteFromServer,
    driverOverrideRef,
    routeOverrideRef,
    routeLastSelectedRef,
    assignmentRef,
    manualUnassignActiveRef,
    manualUnassignBlockedDriverIdRef,
    adoptDriverFromAssignment,
    onAssignmentApiResponse,
    lastServerAssignmentAtRef,
    selectedManifestIdRef,
    selectedRouteIdRef,
    serviceStatusRef,
  ]);

  applyAssignmentRef.current = applyAssignment;

  useEffect(() => {
    registerAssignmentSync?.(() => applyAssignmentRef.current());
    return () => registerAssignmentSync?.(null);
  }, [registerAssignmentSync]);

  useEffect(() => {
    registerAdoptGraceClear?.(() => {
      lastAdoptedAtRef.current = 0;
      lastRouteAdoptedAtRef.current = 0;
    });
    return () => registerAdoptGraceClear?.(null);
  }, [registerAdoptGraceClear]);

  const pollMs =
    driver?.role === 'unassigned' || selectedManifestId != null
      ? POLL_INTERVAL_UNASSIGNED_MS
      : POLL_INTERVAL_MS;

  useEffect(() => {
    if (!peakApiEnabled) return;
    if (!assignmentBootstrapDone) return;
    if (!vehicleId || vehicleId === '110' || isSupervisorMode) return;

    const run = () => applyAssignmentRef.current();
    run();
    const id = setInterval(run, pollMs);
    return () => clearInterval(id);
  }, [vehicleId, isSupervisorMode, assignmentBootstrapDone, pollMs, selectedManifestId]);
}
