/**
 * Tests for resolveStopDisplayName
 * Run with: npx jest src/utils/__tests__/stopDisplayName.test.ts
 *
 * Scenarios tested:
 * 1. No route, no geofence, no nextStop          → '...'
 * 2. Route set, no geofence, no nextStop          → '...'
 * 3. Route set, nextStop with longName            → longName (NEXT STOP path)
 * 4. Route set, currentStopGeofence only          → geofence name (AT STOP path)
 * 5. Both geofence AND nextStop                   → geofence name wins (AT STOP priority)
 * 6. Out of Service route                         → '...' always
 * 7. Geofence name is empty/whitespace            → falls back to nextStop longName
 * 8. nextStop longName is empty/whitespace        → '...'
 * 9. Whitespace-only route ('Out of Service ')   → still '...'
 * 10. Geofence present while Out of Service       → '...' (route check first)
 */

import { resolveStopDisplayName } from '../stopDisplayName';

describe('resolveStopDisplayName', () => {
  // ── Scenario 1 ──────────────────────────────────────────────────────────────
  test('returns "..." when no route, no geofence, no nextStop', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: null,
        currentStopGeofence: null,
        nextStop: null,
      }),
    ).toBe('...');
  });

  // ── Scenario 2 ──────────────────────────────────────────────────────────────
  test('returns "..." when route is set but no geofence and no nextStop', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 5 - Downtown',
        currentStopGeofence: null,
        nextStop: null,
      }),
    ).toBe('...');
  });

  // ── Scenario 3 ──────────────────────────────────────────────────────────────
  test('returns nextStop longName when route is set and nextStop has a name (NEXT STOP path)', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 5 - Downtown',
        currentStopGeofence: null,
        nextStop: { longName: 'Main St & 1st Ave' },
      }),
    ).toBe('Main St & 1st Ave');
  });

  // ── Scenario 4 ──────────────────────────────────────────────────────────────
  test('returns geofence name when bus is inside a stop geofence (AT STOP path)', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 5 - Downtown',
        currentStopGeofence: { geofenceID: '42', name: 'Central Terminal' },
        nextStop: null,
      }),
    ).toBe('Central Terminal');
  });

  // ── Scenario 5 ──────────────────────────────────────────────────────────────
  test('geofence name takes priority over nextStop longName when both are set', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 5 - Downtown',
        currentStopGeofence: { geofenceID: '42', name: 'Central Terminal' },
        nextStop: { longName: 'Park & Ride South' },
      }),
    ).toBe('Central Terminal');
  });

  // ── Scenario 6 ──────────────────────────────────────────────────────────────
  test('returns "..." when route is "Out of Service"', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Out of Service',
        currentStopGeofence: { geofenceID: '1', name: 'Airport Terminal' },
        nextStop: { longName: 'Airport Terminal' },
      }),
    ).toBe('...');
  });

  // ── Scenario 7 ──────────────────────────────────────────────────────────────
  test('falls back to nextStop longName when geofence name is empty string', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 12',
        currentStopGeofence: { geofenceID: '7', name: '   ' }, // whitespace only
        nextStop: { longName: 'Oak Ave Station' },
      }),
    ).toBe('Oak Ave Station');
  });

  // ── Scenario 8 ──────────────────────────────────────────────────────────────
  test('returns "..." when nextStop longName is empty/whitespace only', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 12',
        currentStopGeofence: null,
        nextStop: { longName: '   ' },
      }),
    ).toBe('...');
  });

  // ── Scenario 9 ──────────────────────────────────────────────────────────────
  test('trims "Out of Service " with trailing space and returns "..."', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: '  Out of Service  ',
        currentStopGeofence: null,
        nextStop: { longName: 'Park Blvd' },
      }),
    ).toBe('...');
  });

  // ── Scenario 10 ─────────────────────────────────────────────────────────────
  test('returns "..." even when geofence is active but route is Out of Service', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Out of Service',
        currentStopGeofence: { geofenceID: '99', name: 'Bus Depot' },
        nextStop: null,
      }),
    ).toBe('...');
  });

  // ── Scenario 11 - nextStop with null longName ────────────────────────────────
  test('returns "..." when nextStop exists but longName is null', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 3',
        currentStopGeofence: null,
        nextStop: { longName: null },
      }),
    ).toBe('...');
  });

  // ── Scenario 12 - undefined selectedRoute ───────────────────────────────────
  test('handles undefined selectedRoute gracefully', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: undefined,
        currentStopGeofence: null,
        nextStop: { longName: 'Riverside Stop' },
      }),
    ).toBe('Riverside Stop');
  });
});
