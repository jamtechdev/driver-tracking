/**
 * Build ordered navigation stops from backend schedule.
 */

import type { ScheduleStop } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';
import { calculateDistance } from '@/utils/helpers';
import { toStopNameText } from '@/utils/stopDisplayName';
import type { NavigationCoordinate, NavigationStop } from './types';

export function normalizeLatLng(
  lat: number,
  lng: number,
): { latitude: number; longitude: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let latitude = lat;
  let longitude = lng;

  if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
    latitude = lng;
    longitude = lat;
  } else if (Math.abs(latitude) > 45 && Math.abs(longitude) <= 45) {
    latitude = lng;
    longitude = lat;
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return null;
  return { latitude, longitude };
}

export function scheduleStopsMatch(
  a: { link?: number; blockID?: number; tripID?: number },
  b: { link?: number; blockID?: number; tripID?: number },
): boolean {
  if (a.link == null || b.link == null) return false;
  if (a.link !== b.link) return false;
  if (a.blockID != null && b.blockID != null && a.blockID !== b.blockID) return false;
  if (a.tripID != null && b.tripID != null && a.tripID !== b.tripID) return false;
  return true;
}

export function scheduleStopKey(stop: {
  link?: number;
  blockID?: number;
  tripID?: number;
}): string {
  return `${stop.blockID ?? 0}:${stop.link ?? -1}:${stop.tripID ?? 0}`;
}

export function findStopDataForScheduleRow(
  row: ScheduleStop,
  allStops: StopData[],
): StopData | null {
  if (allStops.length === 0) return null;
  const rowName = toStopNameText(row.longName);
  if (rowName) {
    const exact = allStops.find((stop) => toStopNameText(stop.longName) === rowName);
    if (exact) return exact;
  }
  if (row.link != null) {
    const byLink = allStops.find((stop) => String(stop.stopID) === String(row.link));
    if (byLink) return byLink;
  }
  return null;
}

function coordsFromStopData(stop: StopData): { latitude: number; longitude: number } | null {
  const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(String(stop.lat ?? ''));
  const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(String(stop.lng ?? ''));
  return normalizeLatLng(lat, lng);
}

function coordsFromScheduleRow(
  row: ScheduleStop,
  allStops: StopData[],
): { latitude: number; longitude: number } | null {
  const rowLat = typeof row.lat === 'number' ? row.lat : parseFloat(String(row.lat ?? ''));
  const rowLng = typeof row.lng === 'number' ? row.lng : parseFloat(String(row.lng ?? ''));
  const fromRow = normalizeLatLng(rowLat, rowLng);
  if (fromRow) return fromRow;
  const matched = findStopDataForScheduleRow(row, allStops);
  return matched ? coordsFromStopData(matched) : null;
}

export function sortScheduleStopsSequentially<
  T extends {
    calculatedArrivalTime?: number;
    departureTime?: number;
    link?: number;
    tripID?: number;
    blockID?: number;
  },
>(schedule: T[]): T[] {
  return [...schedule].sort((a, b) => {
    const aTime = a.calculatedArrivalTime ?? a.departureTime ?? 0;
    const bTime = b.calculatedArrivalTime ?? b.departureTime ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    if ((a.tripID ?? 0) !== (b.tripID ?? 0)) return (a.tripID ?? 0) - (b.tripID ?? 0);
    if ((a.blockID ?? 0) !== (b.blockID ?? 0)) return (a.blockID ?? 0) - (b.blockID ?? 0);
    return (a.link ?? 0) - (b.link ?? 0);
  });
}

export function scheduleRowToNavigationStop(
  row: ScheduleStop,
  allStops: StopData[],
  sequenceIndex: number,
): NavigationStop | null {
  const coords = coordsFromScheduleRow(row, allStops);
  if (!coords) return null;
  return {
    id: scheduleStopKey(row),
    longName: toStopNameText(row.longName) || `Stop ${sequenceIndex + 1}`,
    link: row.link,
    tripID: row.tripID,
    blockID: row.blockID,
    latitude: coords.latitude,
    longitude: coords.longitude,
    sequenceIndex,
  };
}

export function buildNavigationStopsFromSchedule(
  schedule: ScheduleStop[],
  allStops: StopData[] = [],
  anchorStop: ScheduleStop | null = null,
): NavigationStop[] {
  const scopedSchedule = filterScheduleForNavigation(schedule, anchorStop);
  const orderedSchedule = sortScheduleStopsSequentially(scopedSchedule);
  const stops: NavigationStop[] = [];
  const seenKeys = new Set<string>();

  orderedSchedule.forEach((row) => {
    const key = scheduleStopKey(row);
    if (seenKeys.has(key)) return;
    const navStop = scheduleRowToNavigationStop(row, allStops, stops.length);
    if (!navStop) return;
    seenKeys.add(key);
    stops.push(navStop);
  });

  return stops.map((stop, index) => ({ ...stop, sequenceIndex: index }));
}

/**
 * Fallback when schedule has no coordinates but the map already shows routeStops.
 * Uses static agency stop list in route.routeStops order.
 */
export function buildNavigationStopsFromRouteStops(
  routeStops: StopData[],
): NavigationStop[] {
  const stops: NavigationStop[] = [];
  const seen = new Set<string>();

  routeStops.forEach((stop, index) => {
    const id = String(stop.stopID ?? '');
    if (!id || seen.has(id)) return;
    const coords = coordsFromStopData(stop);
    if (!coords) return;
    seen.add(id);
    stops.push({
      id: `route:${id}`,
      longName: toStopNameText(stop.longName) || `Stop ${index + 1}`,
      link: Number.isFinite(Number(stop.stopID)) ? Number(stop.stopID) : undefined,
      latitude: coords.latitude,
      longitude: coords.longitude,
      sequenceIndex: stops.length,
    });
  });

  return stops.map((stop, index) => ({ ...stop, sequenceIndex: index }));
}

/**
 * Resolve StopData rows in the exact order of route.routeStops IDs
 * (not the agency-wide stops array order).
 */
export function orderStopsByRouteStopIds(
  routeStopIds: Array<string | number> | null | undefined,
  allStops: StopData[],
): StopData[] {
  if (!routeStopIds || !Array.isArray(routeStopIds) || allStops.length === 0) {
    return [];
  }

  const byId = new Map<string, StopData>();
  for (const stop of allStops) {
    byId.set(String(stop.stopID), stop);
  }

  const ordered: StopData[] = [];
  const seen = new Set<string>();
  for (const id of routeStopIds) {
    const key = String(id);
    if (!key || seen.has(key)) continue;
    const stop = byId.get(key);
    if (!stop) continue;
    seen.add(key);
    ordered.push(stop);
  }
  return ordered;
}

/**
 * Prefer trip stopTimes order (sequence-sorted stopIDs) for turn-by-turn.
 * Falls back to map routeStops, then schedule.
 */
export function resolveNavigableStops(
  schedule: ScheduleStop[],
  allStops: StopData[],
  anchorStop: ScheduleStop | null,
  routeStops: StopData[] = [],
  tripOrderedStops: StopData[] = [],
): NavigationStop[] {
  const fromTrip = buildNavigationStopsFromRouteStops(tripOrderedStops);
  if (fromTrip.length > 0) {
    return fromTrip;
  }

  const fromMap = buildNavigationStopsFromRouteStops(routeStops);
  if (fromMap.length > 0) {
    return fromMap;
  }

  const fromSchedule = buildNavigationStopsFromSchedule(schedule, allStops, anchorStop);
  if (fromSchedule.length > 0) return fromSchedule;
  return [];
}

/** Limit schedule rows to the active trip/block so Mapbox does not route across regions. */
export function filterScheduleForNavigation(
  schedule: ScheduleStop[],
  anchorStop: ScheduleStop | null,
): ScheduleStop[] {
  if (!anchorStop || schedule.length === 0) return schedule;

  if (anchorStop.tripID != null) {
    const sameTrip = schedule.filter((row) => row.tripID === anchorStop.tripID);
    if (sameTrip.length > 0) return sameTrip;
  }

  if (anchorStop.blockID != null) {
    const sameBlock = schedule.filter((row) => row.blockID === anchorStop.blockID);
    if (sameBlock.length > 0) return sameBlock;
  }

  return schedule;
}

function stopMatchesScheduleRow(
  stop: NavigationStop,
  scheduleStop: ScheduleStop,
): boolean {
  if (scheduleStopsMatch(stop, scheduleStop)) return true;
  if (
    stop.link === scheduleStop.link &&
    (scheduleStop.blockID == null || stop.blockID === scheduleStop.blockID)
  ) {
    return true;
  }
  if (stop.link === scheduleStop.link) return true;

  // Route-stop lists key by stopID/name; schedule link is often a polyline index.
  const stopName = toStopNameText(stop.longName).toLowerCase();
  const scheduleName = toStopNameText(scheduleStop.longName).toLowerCase();
  if (stopName && scheduleName && stopName === scheduleName) {
    return true;
  }

  if (stop.id?.startsWith('route:')) {
    const routeStopId = stop.id.slice('route:'.length);
    const scheduleStopId =
      scheduleStop.stopID ?? scheduleStop.stopId ?? scheduleStop.StopID;
    if (scheduleStopId != null && String(scheduleStopId) === routeStopId) {
      return true;
    }
  }

  return false;
}

/**
 * Index of the logical next stop in the navigable stop list.
 * Prefers forward matches from fromIndex so sequence stays monotonic.
 */
export function findNavigationStopIndex(
  stops: NavigationStop[],
  scheduleStop: ScheduleStop | null | undefined,
  options?: { fromIndex?: number },
): number {
  if (!scheduleStop || stops.length === 0) return 0;

  const fromIndex = Math.max(0, Math.min(options?.fromIndex ?? 0, stops.length - 1));

  for (let index = fromIndex; index < stops.length; index += 1) {
    if (stopMatchesScheduleRow(stops[index], scheduleStop)) return index;
  }

  // Name/id match may only exist behind us on a loop — still search whole list forward-first.
  for (let index = 0; index < fromIndex; index += 1) {
    if (stopMatchesScheduleRow(stops[index], scheduleStop)) return index;
  }

  // Coordinate proximity fallback when names/links differ between schedule and routeStops.
  const schedLat =
    typeof scheduleStop.lat === 'number'
      ? scheduleStop.lat
      : parseFloat(String(scheduleStop.lat ?? ''));
  const schedLng =
    typeof scheduleStop.lng === 'number'
      ? scheduleStop.lng
      : parseFloat(String(scheduleStop.lng ?? ''));
  if (Number.isFinite(schedLat) && Number.isFinite(schedLng)) {
    let bestIndex = fromIndex;
    let bestDistance = Infinity;
    for (let index = fromIndex; index < stops.length; index += 1) {
      const distance = calculateDistance(
        schedLat,
        schedLng,
        stops[index].latitude,
        stops[index].longitude,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestDistance <= 75) return bestIndex;
  }

  return fromIndex;
}

export function mergeNavigationStopWithSchedule(
  navStop: NavigationStop,
  schedule: ScheduleStop[],
  allStops: StopData[],
): NavigationStop {
  const row =
    schedule.find((item) => scheduleStopsMatch(navStop, item)) ??
    schedule.find(
      (item) =>
        item.link === navStop.link &&
        (navStop.blockID == null || item.blockID === navStop.blockID),
    );
  if (!row) return navStop;
  const refreshed = scheduleRowToNavigationStop(row, allStops, navStop.sequenceIndex);
  if (!refreshed) return navStop;
  return { ...navStop, ...refreshed };
}

export function refreshNavigationStopsFromSchedule(
  stops: NavigationStop[],
  schedule: ScheduleStop[],
  allStops: StopData[],
): NavigationStop[] {
  return stops.map((stop) => mergeNavigationStopWithSchedule(stop, schedule, allStops));
}

export function estimateRemainingStopsMetrics(
  stops: NavigationStop[],
  fromStopIndex: number,
): { distanceMeters: number; durationSeconds: number } {
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (let i = fromStopIndex + 1; i < stops.length; i += 1) {
    const prev = stops[i - 1];
    const next = stops[i];
    const segmentDistance = calculateDistance(
      prev.latitude,
      prev.longitude,
      next.latitude,
      next.longitude,
    );
    distanceMeters += segmentDistance;
    durationSeconds += segmentDistance / 13.4;
  }
  return { distanceMeters, durationSeconds };
}

/** Meters past a stop, along the line to the next stop, before HUD advances. */
export const HUD_PASS_ALONG_METERS = 40;

export const HUD_APPROACHING_METERS = 150;

export const HUD_ARRIVAL_METERS = 20;

/** After arriving, puck must leave this far before HUD advances to the next stop. */
export const HUD_LEAVE_METERS = 35;

/** Puck must be this close to the current stop before we may pass it (unless already approached). */
export const HUD_NEAR_STOP_METERS = 150;

/**
 * Max distance for “passed away without visit” advances (offset curb pins / fast GPS).
 * Beyond this, treat as a far GPS jump and do not skip.
 */
export const HUD_PASSED_AWAY_MAX_METERS = HUD_NEAR_STOP_METERS * 2;

export type NavigationStopPhase = 'next' | 'approaching' | 'arrived';

export type AdvancePastStopOptions = {
  passAlongMeters?: number;
  nearStopMeters?: number;
  leaveMeters?: number;
  /** Cap for advancing after leaving a stop without approach/arrive. */
  passedAwayMaxMeters?: number;
  /** True once puck (or native arrive) has been inside the approach radius. */
  hasApproached?: boolean;
  /** True once puck was inside the arrival radius or Mapbox fired arrive. */
  hasArrived?: boolean;
};

export function resolveStopHudPhase(
  distanceMeters: number | null | undefined,
  approachingMeters: number = HUD_APPROACHING_METERS,
  arrivalMeters: number = HUD_ARRIVAL_METERS,
): NavigationStopPhase {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return 'next';
  if (distanceMeters <= arrivalMeters) return 'arrived';
  if (distanceMeters <= approachingMeters) return 'approaching';
  return 'next';
}

function resolveAdvanceOptions(
  passAlongMetersOrOptions?: number | AdvancePastStopOptions,
): Required<AdvancePastStopOptions> {
  const fromObject =
    typeof passAlongMetersOrOptions === 'object' && passAlongMetersOrOptions != null
      ? passAlongMetersOrOptions
      : {
          passAlongMeters:
            typeof passAlongMetersOrOptions === 'number'
              ? passAlongMetersOrOptions
              : HUD_PASS_ALONG_METERS,
        };
  return {
    passAlongMeters: fromObject.passAlongMeters ?? HUD_PASS_ALONG_METERS,
    nearStopMeters: fromObject.nearStopMeters ?? HUD_NEAR_STOP_METERS,
    leaveMeters: fromObject.leaveMeters ?? HUD_LEAVE_METERS,
    passedAwayMaxMeters:
      fromObject.passedAwayMaxMeters ?? HUD_PASSED_AWAY_MAX_METERS,
    hasApproached: Boolean(fromObject.hasApproached),
    hasArrived: Boolean(fromObject.hasArrived),
  };
}

/**
 * Signed meters from `current` toward `next` of the puck.
 * Negative = still behind current. >= distance(current,next) = at/past next.
 */
export function alongMetersTowardNext(
  puck: NavigationCoordinate,
  current: NavigationCoordinate,
  next: NavigationCoordinate,
): number {
  const ab = calculateDistance(
    current.latitude,
    current.longitude,
    next.latitude,
    next.longitude,
  );
  if (ab < 1) return 0;
  const ap = calculateDistance(
    puck.latitude,
    puck.longitude,
    current.latitude,
    current.longitude,
  );
  const pb = calculateDistance(
    puck.latitude,
    puck.longitude,
    next.latitude,
    next.longitude,
  );
  return (ap * ap + ab * ab - pb * pb) / (2 * ab);
}

export function shouldAdvancePastStop(
  puck: NavigationCoordinate,
  current: NavigationCoordinate,
  next: NavigationCoordinate,
  passAlongMetersOrOptions: number | AdvancePastStopOptions = HUD_PASS_ALONG_METERS,
): boolean {
  const options = resolveAdvanceOptions(passAlongMetersOrOptions);
  const distCurrent = calculateDistance(
    puck.latitude,
    puck.longitude,
    current.latitude,
    current.longitude,
  );
  const distNext = calculateDistance(
    puck.latitude,
    puck.longitude,
    next.latitude,
    next.longitude,
  );
  const stopSpacing = calculateDistance(
    current.latitude,
    current.longitude,
    next.latitude,
    next.longitude,
  );
  const along = alongMetersTowardNext(puck, current, next);
  const passedAlong = along >= options.passAlongMeters;
  const closerToNext = along > 15 && distNext + 15 < distCurrent;
  const leftAfterArrival =
    options.hasArrived && distCurrent >= options.leaveMeters;
  const leftAfterApproach =
    options.hasApproached &&
    distCurrent >= options.leaveMeters &&
    (along > 0 || distNext < distCurrent);

  // Visited this stop (or Mapbox arrived) — advance only after leave / pass toward next.
  // Do not skip from a bare far GPS jump while still marked arrived.
  if (options.hasArrived || options.hasApproached) {
    return (
      leftAfterArrival ||
      leftAfterApproach ||
      passedAlong ||
      closerToNext
    );
  }

  // Corridor along current→next (not crow-flies from the pin). Lets the HUD
  // advance when the puck drove past a curb-offset stop without ever entering
  // the approach radius, even once distCurrent > 300m — while still
  // blocking multi-km GPS teleports (along ≫ stopSpacing + passedAwayMax).
  const alongCorridorMax = stopSpacing + options.passedAwayMaxMeters;
  const withinLegCorridor = along >= options.passAlongMeters && along <= alongCorridorMax;

  // Puck clearly left this stop toward the next (bottom HUD → index+1), even if
  // approach/arrive never fired (curb / off-road pin outside arrival radius).
  const leftStopTowardNext =
    withinLegCorridor &&
    distCurrent >= options.leaveMeters &&
    distNext < distCurrent;
  if (leftStopTowardNext) return true;

  // Already at/past the next stop's projection along the leg — never keep HUD
  // stuck on the previous name while the puck keeps moving.
  const reachedOrPastNext =
    stopSpacing >= 1 &&
    along >= Math.max(options.passAlongMeters, stopSpacing * 0.85) &&
    distNext <= distCurrent;
  if (reachedOrPastNext && along <= alongCorridorMax) return true;

  if (distCurrent > options.nearStopMeters) return false;
  return passedAlong || closerToNext;
}

/**
 * First stop the puck has not yet passed, never moving backward from fromIndex.
 * Unvisited far GPS must not skip ahead; approached/arrived stops may be left behind.
 */
export function resolveForwardStopIndex(
  puck: NavigationCoordinate | null | undefined,
  stops: NavigationStop[],
  fromIndex = 0,
  passAlongMetersOrOptions: number | AdvancePastStopOptions = HUD_PASS_ALONG_METERS,
): number {
  if (!stops.length) return 0;
  if (
    !puck ||
    !Number.isFinite(puck.latitude) ||
    !Number.isFinite(puck.longitude)
  ) {
    return Math.max(0, Math.min(fromIndex, stops.length - 1));
  }

  const options = resolveAdvanceOptions(passAlongMetersOrOptions);
  let index = Math.max(0, Math.min(fromIndex, stops.length - 1));
  const from = index;
  while (index < stops.length - 1) {
    // Sticky approach/arrive applies only to the current HUD stop — never skip the rest.
    const stepOptions =
      index === from
        ? options
        : { ...options, hasApproached: false, hasArrived: false };
    if (!shouldAdvancePastStop(puck, stops[index], stops[index + 1], stepOptions)) {
      break;
    }
    index += 1;
  }
  return index;
}
