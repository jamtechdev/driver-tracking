/**
 * DirectionModel — stateful port of iOS DirectionModel.m
 * Holds links, schedule, expected links; updates next stop on GPS.
 */

import {
  normalizeLinkAverages,
  parseRoutePointsToLinksRobust,
} from './linkGeometry';
import {
  buildExpectedLinks,
  findCurrentLinkWithLocation,
  secondsSinceMidnight,
  MINS_LATE_UNKNOWN,
} from './directionEngine';
import type { DirectionScheduleItem, DirectionResult, RouteLink } from './types';

export type { RouteLink };
import { mapApiScheduleToDirection, type ApiScheduleStop } from './scheduleMapper';

/** iOS: lastAdherenceUpdate > 1800 → refetch routefordriver */
export const STALE_SCHEDULE_SECONDS = 1800;

export class DirectionModel {
  links: RouteLink[] = [];
  linkAverages: number[] = [];
  routeSchedule: DirectionScheduleItem[] = [];
  totalRouteTime = 0;
  expectedLinks: ReturnType<typeof buildExpectedLinks> = [];

  atLink = 0;
  nextStop: DirectionScheduleItem | null = null;
  nextScheduledStop: DirectionScheduleItem | null = null;
  minsLate = MINS_LATE_UNKNOWN;
  secondsToNextStop = 0;

  expectedLink = -9999;
  expectedBlockID: string | null = null;

  private lastAdherenceUpdate = 0;
  private loadedRouteId: string | null = null;

  loadLinksFromPoints(points: string | null | undefined): RouteLink[] {
    this.links = parseRoutePointsToLinksRobust(points);
    return this.links;
  }

  setSchedule(
    routeId: string,
    linkAverages: number[],
    totalRouteTime: number,
    apiSchedule: ApiScheduleStop[],
  ): void {
    this.loadedRouteId = routeId;
    this.linkAverages = normalizeLinkAverages(
      linkAverages,
      this.links.length > 0 ? this.links.length : linkAverages.length,
    );
    this.totalRouteTime = totalRouteTime > 0 ? totalRouteTime : 3600;
    this.routeSchedule = mapApiScheduleToDirection(apiSchedule);
    this.lastAdherenceUpdate = Date.now() / 1000;
    this.updateExpectedLinks();
  }

  clear(): void {
    this.links = [];
    this.linkAverages = [];
    this.routeSchedule = [];
    this.totalRouteTime = 0;
    this.expectedLinks = [];
    this.nextStop = null;
    this.nextScheduledStop = null;
    this.minsLate = MINS_LATE_UNKNOWN;
    this.loadedRouteId = null;
    this.expectedLink = -9999;
    this.expectedBlockID = null;
  }

  isStale(): boolean {
    if (this.lastAdherenceUpdate === 0) return false;
    return Date.now() / 1000 - this.lastAdherenceUpdate > STALE_SCHEDULE_SECONDS;
  }

  getLoadedRouteId(): string | null {
    return this.loadedRouteId;
  }

  /** iOS updateAdherence (sync portion). */
  updateExpectedLinks(now: Date = new Date()): void {
    if (this.routeSchedule.length === 0 || this.linkAverages.length === 0) {
      this.expectedLinks = [];
      return;
    }

    const timeInSeconds = secondsSinceMidnight(now);
    this.expectedLinks = buildExpectedLinks(
      this.routeSchedule,
      this.linkAverages,
      timeInSeconds,
      this.totalRouteTime,
      this.expectedLink,
      this.expectedBlockID,
    );
  }

  /** iOS findCurrentLinkWithLocation */
  updateFromLocation(lat: number, lng: number, course: number, now: Date = new Date()): DirectionResult {
    if (this.isStale()) {
      this.loadedRouteId = null;
    }

    this.updateExpectedLinks(now);
    const timeInSeconds = secondsSinceMidnight(now);

    const result = findCurrentLinkWithLocation({
      lat,
      lng,
      course,
      links: this.links,
      linkAverages: this.linkAverages,
      routeSchedule: this.routeSchedule,
      expectedLinks: this.expectedLinks,
      timeInSeconds,
      totalRouteTime: this.totalRouteTime,
      previousExpectedLink: this.expectedLink,
      previousBlockID: this.expectedBlockID,
      previousAtLink: this.atLink,
    });

    this.atLink = result.atLink;
    this.nextStop = result.nextStop;
    this.nextScheduledStop = result.nextScheduledStop;
    this.minsLate = result.minsLate;
    this.secondsToNextStop = result.secondsToNextStop;
    this.expectedLink = result.expectedLink;
    this.expectedBlockID = result.expectedBlockID;

    return result;
  }
}
