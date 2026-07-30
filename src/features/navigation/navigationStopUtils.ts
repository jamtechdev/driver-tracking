/**
 * Build ordered navigation stops from backend schedule.
 */

import type { ScheduleStop } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';
import { calculateDistance } from '@/utils/helpers';
import { toStopNameText } from '@/utils/stopDisplayName';
import type { NavigationStop } from './types';

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
 * Prefer the stops drawn on the map (route.routeStops order) for turn-by-turn.
 * Navigation is stop-based — not agency polyline / Map Matching geometry.
 * Schedule is only a fallback when the map has no usable stop list.
 */
export function resolveNavigableStops(
  schedule: ScheduleStop[],
  allStops: StopData[],
  anchorStop: ScheduleStop | null,
  routeStops: StopData[] = [],
): NavigationStop[] {
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
