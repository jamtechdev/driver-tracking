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
): NavigationStop[] {
  const orderedSchedule = sortScheduleStopsSequentially(schedule);
  const stops: NavigationStop[] = [];
  orderedSchedule.forEach((row) => {
    const navStop = scheduleRowToNavigationStop(row, allStops, stops.length);
    if (navStop) stops.push(navStop);
  });
  return stops.map((stop, index) => ({ ...stop, sequenceIndex: index }));
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
  return stop.link === scheduleStop.link;
}

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

  for (let index = 0; index < fromIndex; index += 1) {
    if (stopMatchesScheduleRow(stops[index], scheduleStop)) return index;
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
