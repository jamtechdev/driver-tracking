/**
 * Pure functions ported from iOS DirectionModel.m (link scoring, next stop, mins late).
 */

import type {
  DirectionScheduleItem,
  ExpectedLink,
  RouteLink,
  DirectionResult,
} from './types';
import { projectLocationOntoLinks } from './linkGeometry';

export const MINS_LATE_UNKNOWN = -9999;

export function secondsSinceMidnight(date: Date = new Date()): number {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return Math.floor(Math.abs(midnight.getTime() - date.getTime()) / 1000);
}

export function bearingDifference(angle0: number, angle1: number): number {
  let diff = angle1 - angle0;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return Math.abs(diff);
}

export function isLinkAfter(link: number, link2: number, linkCount: number): boolean {
  let maxLink = link2 + linkCount / 2;
  if (link > link2 && link < maxLink) return true;

  if (maxLink > linkCount) {
    maxLink = maxLink - linkCount;
    if (link > 0 && link < maxLink) return true;
  }
  return false;
}

export function secondsFromLink(
  from: number,
  to: number,
  linkAverages: number[],
): number {
  if (to < 0 || to > linkAverages.length) return 0;
  let link = from;
  let seconds = 0;
  while (link !== to) {
    if (link >= linkAverages.length) {
      link = 0;
      if (link === to) break;
    }
    seconds += linkAverages[link] ?? 0;
    link++;
  }
  return seconds;
}

export function linksFromLink(
  from: number,
  to: number,
  linkCount: number,
): number {
  if (to < 0 || to > linkCount) return 0;
  let link = from;
  let count = 0;
  while (link !== to) {
    if (link >= linkCount) {
      link = 0;
      if (link === to) break;
    }
    count++;
    link++;
  }
  return count;
}

/**
 * Port of updateAdherence — expected on-time link per block.
 */
export function buildExpectedLinks(
  routeSchedule: DirectionScheduleItem[],
  linkAverages: number[],
  timeInSeconds: number,
  totalRouteTime: number,
  previousExpectedLink?: number,
  previousBlockID?: string | null,
): ExpectedLink[] {
  const upcoming: ExpectedLink[] = [];
  const seenBlocks = new Set<string>();

  for (const s of routeSchedule) {
    if (s.calculatedArrivalTime <= timeInSeconds) continue;
    if (s.calculatedArrivalTime >= timeInSeconds + totalRouteTime) continue;
    const blockKey = String(s.blockID);
    if (seenBlocks.has(blockKey)) continue;
    seenBlocks.add(blockKey);
    upcoming.push({
      link: s.link,
      calculatedArrivalTime: s.calculatedArrivalTime - timeInSeconds,
      stopName: s.stopName,
      blockID: blockKey,
    });
  }

  for (const s of upcoming) {
    while (s.calculatedArrivalTime > 0) {
      s.link--;
      if (s.link < 0 || s.link >= linkAverages.length) {
        s.link = linkAverages.length - 1;
      }
      const sec = linkAverages[s.link] > 0 ? linkAverages[s.link] : 2;
      s.calculatedArrivalTime -= sec;
    }

    if (
      previousBlockID != null &&
      String(s.blockID) === String(previousBlockID) &&
      previousExpectedLink != null &&
      previousExpectedLink !== -9999 &&
      isLinkAfter(previousExpectedLink, s.link, linkAverages.length)
    ) {
      s.link = previousExpectedLink;
    }
  }

  return upcoming;
}

/**
 * Port of findCurrentLinkWithLocation (next stop + local mins late).
 */
export function findCurrentLinkWithLocation(params: {
  lat: number;
  lng: number;
  course: number;
  links: RouteLink[];
  linkAverages: number[];
  routeSchedule: DirectionScheduleItem[];
  expectedLinks: ExpectedLink[];
  timeInSeconds: number;
  totalRouteTime: number;
  previousExpectedLink?: number;
  previousBlockID?: string | null;
  /** Prior GPS snap — keeps placement monotonic on loops / overlapping geometry. */
  previousAtLink?: number;
}): DirectionResult {
  const {
    lat,
    lng,
    course,
    links,
    linkAverages,
    routeSchedule,
    expectedLinks,
    timeInSeconds,
    totalRouteTime,
    previousAtLink,
  } = params;

  const empty: DirectionResult = {
    atLink: 0,
    nextStop: null,
    nextScheduledStop: null,
    minsLate: MINS_LATE_UNKNOWN,
    secondsToNextStop: 0,
    expectedLink: -9999,
    expectedBlockID: null,
  };

  if (links.length < 1) return empty;

  // Segment projection (not vertex-only) so complex agency shapes place correctly.
  const projection = projectLocationOntoLinks(
    links,
    lat,
    lng,
    course,
    previousAtLink,
  );
  const atLink = projection?.position ?? 0;

  let topClosestSchedLink: ExpectedLink | undefined;
  let lowestLinkSchedDiff = 99999;

  if (expectedLinks.length > 0) {
    for (const schedLink of expectedLinks) {
      const thisLinkSchedDiff = isLinkAfter(atLink, schedLink.link, linkAverages.length)
        ? secondsFromLink(schedLink.link, atLink, linkAverages)
        : secondsFromLink(atLink, schedLink.link, linkAverages);

      if (thisLinkSchedDiff < lowestLinkSchedDiff) {
        lowestLinkSchedDiff = thisLinkSchedDiff;
        topClosestSchedLink = schedLink;
      }
    }
  }

  if (!expectedLinks.length || !topClosestSchedLink) {
    return { ...empty, atLink };
  }

  const startAtScheduleTime = timeInSeconds - totalRouteTime;
  const endAtScheduleTime = timeInSeconds + totalRouteTime;

  let nextStop: DirectionScheduleItem | null = null;
  let nextScheduledStop: DirectionScheduleItem | null = null;
  let secondsToNextStop = 9999;
  let secondsToNextScheduledStop = 9999;
  let endAfterLink = -1;

  const blockID = String(topClosestSchedLink.blockID);
  const linkGraphCount = Math.max(links.length, linkAverages.length, 1);

  for (const stoptime of routeSchedule) {
    if (
      stoptime.calculatedArrivalTime < startAtScheduleTime ||
      String(stoptime.blockID) !== blockID
    ) {
      continue;
    }
    if (endAfterLink === -1) endAfterLink = stoptime.link;
    if (
      stoptime.calculatedArrivalTime > endAtScheduleTime &&
      isLinkAfter(stoptime.link, endAfterLink, linkGraphCount)
    ) {
      break;
    }

    // Vehicle has moved past this stop on the link graph — pick the next one ahead.
    if (
      isLinkAfter(atLink, stoptime.link, linkGraphCount) &&
      atLink !== stoptime.link
    ) {
      continue;
    }

    const secs = secondsFromLink(atLink, stoptime.link, linkAverages);
    const linkCount = linksFromLink(atLink, stoptime.link, linkAverages.length);

    if (secs < secondsToNextStop) {
      secondsToNextStop = secs;
      nextStop = stoptime;
    }

    if (
      !stoptime.unscheduled &&
      secs < secondsToNextScheduledStop &&
      secs !== 0 &&
      linkCount > 2
    ) {
      secondsToNextScheduledStop = secs;
      nextScheduledStop = stoptime;
    }
  }

  if (!nextStop) {
    return {
      ...empty,
      atLink,
      expectedLink: topClosestSchedLink.link,
      expectedBlockID: blockID,
    };
  }

  let minsLate = MINS_LATE_UNKNOWN;
  if (nextScheduledStop) {
    const secsLate =
      timeInSeconds + secondsToNextScheduledStop - nextScheduledStop.calculatedArrivalTime;
    minsLate = Math.round(secsLate / 60);
  }

  return {
    atLink,
    nextStop,
    nextScheduledStop,
    minsLate,
    secondsToNextStop,
    expectedLink: topClosestSchedLink.link,
    expectedBlockID: blockID,
  };
}
