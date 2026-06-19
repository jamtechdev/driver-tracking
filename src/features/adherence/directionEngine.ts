/**
 * Pure functions ported from iOS DirectionModel.m (link scoring, next stop, mins late).
 */

import type {
  DirectionScheduleItem,
  ExpectedLink,
  RouteLink,
  DirectionResult,
} from './types';
import { assignLinkDistances } from './linkGeometry';

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

  const withDistance = assignLinkDistances(links, lat, lng);
  const sorted = [...withDistance].sort((a, b) => a.distanceMiles - b.distanceMiles);

  const halfLinks = links.length / 2;
  let topLink = 0;
  let topScore = -9999;
  let topClosestSchedLink: ExpectedLink | undefined;

  const candidateCount = Math.min(8, sorted.length);
  for (let i = 0; i < candidateCount; i++) {
    const link = sorted[i];
    const bearingDiff = bearingDifference(course, link.bearing);
    let distance = 1 - link.distanceMiles / 0.1;
    if (distance < 0) distance = 0;

    let closestSchedLink: ExpectedLink | undefined;
    let lowestLinkSchedDiff = 99999;

    if (expectedLinks.length > 0) {
      for (const schedLink of expectedLinks) {
        const thisLinkSchedDiff = isLinkAfter(link.position, schedLink.link, linkAverages.length)
          ? secondsFromLink(schedLink.link, link.position, linkAverages)
          : secondsFromLink(link.position, schedLink.link, linkAverages);

        if (thisLinkSchedDiff < lowestLinkSchedDiff) {
          lowestLinkSchedDiff = thisLinkSchedDiff;
          closestSchedLink = schedLink;
        }
      }
    }

    const linkSchedDiff =
      lowestLinkSchedDiff === 99999 ? 0 : (halfLinks - lowestLinkSchedDiff) / halfLinks;

    const score =
      distance * 0.6 + ((180 - bearingDiff) / 180) * 0.5 + linkSchedDiff * 0.8;

    if (score > topScore) {
      topScore = score;
      topLink = link.position;
      topClosestSchedLink = closestSchedLink;
    }
  }

  const atLink = topLink;

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
