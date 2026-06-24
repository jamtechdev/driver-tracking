/**
 * Route link geometry — port of DirectionModel loadLinksWithPoints / Link bearing.
 */

import type { RouteLink } from './types';

const METERS_TO_MILES = 1 / 1609.344;
const EARTH_RADIUS_M = 6371000;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const meters = 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return meters * METERS_TO_MILES;
}

export function headingBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Parse iOS route points: "lat,lng;lat,lng;..."
 */
export function parseRoutePointsToLinks(points: string | null | undefined): RouteLink[] {
  if (!points || points === 'null' || typeof points !== 'string') {
    return [];
  }

  const links: RouteLink[] = [];
  const segments = points.split(';').filter(Boolean);
  let lastLat: number | null = null;
  let lastLng: number | null = null;

  segments.forEach((segment) => {
    const parts = segment.split(',');
    if (parts.length < 2) return;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    let bearing = 0;
    if (lastLat != null && lastLng != null) {
      bearing = headingBetween(lastLat, lastLng, lat, lng);
    }

    links.push({
      position: links.length,
      latitude: lat,
      longitude: lng,
      bearing,
      distanceMiles: 0,
    });
    lastLat = lat;
    lastLng = lng;
  });

  if (links.length > 1) {
    const first = links[0];
    const last = links[links.length - 1];
    first.bearing = headingBetween(
      last.latitude,
      last.longitude,
      first.latitude,
      first.longitude,
    );
  }

  return links;
}

/** Semicolon format first, then regex lat/lng pairs (MapScreen fallback). */
export function parseRoutePointsToLinksRobust(points: string | null | undefined): RouteLink[] {
  const primary = parseRoutePointsToLinks(points);
  if (primary.length > 0) return primary;

  if (!points || typeof points !== 'string') return [];
  const coords = points.match(/-?\d+\.\d+/g);
  if (!coords || coords.length < 4) return [];

  const pairs: string[] = [];
  for (let i = 0; i < coords.length - 1; i += 2) {
    pairs.push(`${coords[i]},${coords[i + 1]}`);
  }
  return parseRoutePointsToLinks(pairs.join(';'));
}

/** API linkAverages length may differ from route point count — align to link graph. */
export function normalizeLinkAverages(
  linkAverages: number[],
  linkCount: number,
): number[] {
  if (linkCount <= 0) return [];
  if (linkAverages.length === linkCount) return linkAverages;
  if (linkAverages.length > linkCount) return linkAverages.slice(0, linkCount);
  const out = [...linkAverages];
  const fallback = out.length > 0 ? out[out.length - 1] : 2;
  while (out.length < linkCount) {
    out.push(fallback > 0 ? fallback : 2);
  }
  return out;
}

export function assignLinkDistances(
  links: RouteLink[],
  lat: number,
  lng: number,
): RouteLink[] {
  return links.map((link) => ({
    ...link,
    distanceMiles: haversineMiles(lat, lng, link.latitude, link.longitude),
  }));
}
