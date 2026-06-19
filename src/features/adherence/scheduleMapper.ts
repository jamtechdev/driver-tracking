/**
 * Map API schedule rows to DirectionModel schedule items (iOS ScheduleItem).
 */

import type { DirectionScheduleItem } from './types';

export interface ApiScheduleStop {
  blockID: number | string;
  calculatedArrivalTime: number;
  departureTime?: number;
  link: number;
  unscheduled: number | boolean;
  longName: string;
  tripID: number;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

export function mapApiScheduleToDirection(items: ApiScheduleStop[]): DirectionScheduleItem[] {
  return items.map((item) => ({
    blockID: String(item.blockID),
    link: item.link,
    calculatedArrivalTime: item.calculatedArrivalTime,
    stopName: item.longName ?? '',
    longName: item.longName ?? '',
    unscheduled: Boolean(item.unscheduled),
    tripID: item.tripID,
  }));
}

/** Re-export shape compatible with DriverModelContext ScheduleStop. */
export function directionItemToContextStop(item: DirectionScheduleItem): ApiScheduleStop {
  const blockNum = parseInt(String(item.blockID), 10);
  return {
    blockID: Number.isFinite(blockNum) ? blockNum : 0,
    calculatedArrivalTime: item.calculatedArrivalTime,
    departureTime: 0,
    link: item.link,
    unscheduled: item.unscheduled ? 1 : 0,
    longName: item.longName,
    tripID: item.tripID,
  };
}
