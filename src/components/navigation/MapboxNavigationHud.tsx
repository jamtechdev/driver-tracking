/**
 * Modern navigation HUD chrome for native Mapbox overlay.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeRouteProgress } from '@/hooks/useMapboxTurnByTurnNavigation';
import type { NavigationCoordinate, NavigationStop } from '@/features/navigation/types';
import type { NavigationHudTheme } from '@/config/navigationMapStyle';
import {
  computePerStopRouteMetrics,
  formatEtaTime,
  formatNavigationDistance,
  formatNavigationDuration,
  formatTurnByTurnDistance,
  getManeuverIconName,
  type PerStopRouteMetric,
} from '@/features/navigation/navigationUtils';
import {
  HUD_APPROACHING_METERS,
  HUD_ARRIVAL_METERS,
  resolveStopHudPhase,
} from '@/features/navigation/navigationStopUtils';
import { isStaleMapboxStopBanner } from '@/features/navigation/staleMapboxStopBanner';
import { toStopNameText } from '@/utils/stopDisplayName';
import { calculateDistance } from '@/utils/helpers';
import { speedMpsToMph } from '@/api/position.api';

export interface MapboxNavigationHudProps {
  theme: NavigationHudTheme;
  topOffset: number;
  bottomInset: number;
  /** Status-bar / notch inset so the live guidance banner clears it. */
  safeTopInset?: number;
  speedMps?: number;
  routeName?: string | null;
  routeColor?: string;
  currentStopIndex: number;
  upcomingStops: NavigationStop[];
  /** Full trip stop list — used to ignore Mapbox banners for already-passed stops. */
  allStops?: NavigationStop[];
  driverLocation: NavigationCoordinate | null;
  routeProgress: NativeRouteProgress | null;
  /** Shown briefly when the driver reaches a stop. */
  arrivalBanner?: { stopName: string } | null;
  /** Training: matched agency path left — show return-to-route (no silent reroute). */
  isOffRoute?: boolean;
  onEndNavigation: () => void;
}

function SpeedPill({ speedMps, theme }: { speedMps?: number; theme: NavigationHudTheme }) {
  const speedMph = Math.max(0, Math.round(speedMpsToMph(speedMps)));

  return (
    <View
      style={[
        styles.speedPill,
        {
          backgroundColor: theme.chipBg,
          borderColor: theme.chipBorder,
          shadowColor: theme.chipShadow,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Current speed ${speedMph} miles per hour`}
    >
      <Text style={[styles.speedValue, { color: theme.speedValue }]}>{speedMph}</Text>
      <Text style={[styles.speedUnit, { color: theme.speedUnit }]}>mph</Text>
    </View>
  );
}

function EndNavigationButton({
  theme,
  onPress,
}: {
  theme: NavigationHudTheme;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.endFab,
        {
          backgroundColor: theme.exitBg,
          shadowColor: theme.chipShadow,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="End navigation"
    >
      <MaterialIcons name="close" size={22} color={theme.exitText} />
    </TouchableOpacity>
  );
}

function NextStopCard({
  metric,
  theme,
  label,
}: {
  metric: PerStopRouteMetric;
  theme: NavigationHudTheme;
  label: string;
}) {
  const name = toStopNameText(metric.stop.longName) || `Stop ${metric.stopIndex + 1}`;

  return (
    <View
      style={[
        styles.nextStopCard,
        {
          backgroundColor: theme.scheme === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8F9FA',
          borderColor: theme.chipBorder,
        },
      ]}
    >
      <Text style={[styles.nextStopLabel, { color: theme.sheetSecondary }]}>{label}</Text>
      <Text style={[styles.nextStopName, { color: theme.sheetPrimary }]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[styles.nextStopMetrics, { color: theme.sheetSecondary }]}>
        <Text style={[styles.nextStopEta, { color: theme.eta }]}>
          {formatEtaTime(metric.etaTimestamp)}
        </Text>
        {' · '}
        {formatNavigationDistance(metric.distanceMeters)}
        {' · '}
        {formatNavigationDuration(metric.durationSeconds)}
      </Text>
    </View>
  );
}

const PHASE_LABEL: Record<'next' | 'approaching' | 'arrived', string> = {
  next: 'Next stop',
  approaching: 'Approaching',
  arrived: 'Arrived',
};

function buildTurnInstruction(
  type?: string,
  modifier?: string,
  streetName?: string,
  primaryText?: string,
  rawInstruction?: string,
  currentStopName?: string,
  completedStopNames: string[] = [],
): string | null {
  const stopName = currentStopName?.trim() || '';
  const primary = primaryText?.trim() || '';
  const instruction = rawInstruction?.trim() || '';
  const t = (type ?? '').toLowerCase();
  const m = (modifier ?? '').toLowerCase();

  const usablePrimary =
    primary &&
    !isStaleMapboxStopBanner(primary, stopName, completedStopNames)
      ? primary
      : null;
  const usableInstruction =
    instruction &&
    !isStaleMapboxStopBanner(instruction, stopName, completedStopNames)
      ? instruction
      : null;

  // Arrive / empty types are not road turns — let caller use stop-name copy instead
  if (!t || t === 'arrive') {
    // Never surface stale arrive banners; otherwise fall through to stop copy
    return null;
  }

  const isDirectional =
    t === 'turn' ||
    t === 'roundabout' ||
    t === 'rotary' ||
    t === 'fork' ||
    t === 'merge' ||
    t === 'uturn' ||
    t === 'end of road' ||
    m.includes('left') ||
    m.includes('right');

  let action = 'Continue straight';
  if (t === 'roundabout' || t === 'rotary') action = 'Enter the roundabout';
  else if (t === 'uturn') action = 'Make a U-turn';
  else if (t === 'merge') action = 'Merge';
  else if (t === 'fork') {
    action = m.includes('left') ? 'Keep left' : m.includes('right') ? 'Keep right' : 'At the fork';
  } else if (m.includes('sharp left')) action = 'Turn sharp left';
  else if (m.includes('sharp right')) action = 'Turn sharp right';
  else if (m.includes('slight left')) action = 'Keep left';
  else if (m.includes('slight right')) action = 'Keep right';
  else if (m.includes('left')) action = 'Turn left';
  else if (m.includes('right')) action = 'Turn right';
  else if (t === 'turn') action = 'Turn';
  else if (t === 'depart' || t === 'new name' || t === 'continue' || t === 'notification') {
    action = 'Continue';
  }

  const street = streetName?.trim() || '';

  // Prefer structured left/right from type+modifier so street-only Mapbox
  // primary text never hides the actual turn.
  if (isDirectional) {
    if (street) return `${action} onto ${street}`;
    // If Mapbox primary is a short street title (not a full sentence), append it
    if (
      usablePrimary &&
      usablePrimary.length < 48 &&
      !/\b(turn|keep|merge|left|right|arrive|continue)\b/i.test(usablePrimary)
    ) {
      return `${action} onto ${usablePrimary}`;
    }
    return action;
  }

  // Non-directional (continue / depart): prefer usable Mapbox sentence, else action
  if (usablePrimary && /\b(turn|keep|merge|left|right|roundabout|exit|fork)\b/i.test(usablePrimary)) {
    return usablePrimary;
  }
  if (usableInstruction && /\b(turn|keep|merge|left|right|roundabout|exit|fork)\b/i.test(usableInstruction)) {
    return usableInstruction;
  }
  if (usablePrimary) return usablePrimary;
  if (usableInstruction) return usableInstruction;
  return street ? `${action} onto ${street}` : action;
}

function GoogleMapsGuidanceBanner({
  theme,
  topInset,
  phase,
  stopName,
  stopDistanceMeters,
  stopDurationSeconds,
  stopEtaTimestamp,
  routeProgress,
  arrivalOverrideName,
  nextStopName,
  completedStopNames = [],
}: {
  theme: NavigationHudTheme;
  topInset: number;
  phase: 'next' | 'approaching' | 'arrived';
  stopName: string;
  stopDistanceMeters: number;
  stopDurationSeconds?: number | null;
  stopEtaTimestamp?: number | null;
  routeProgress: NativeRouteProgress | null;
  /** When set, lock banner to "You have arrived at {name}" for that stop. */
  arrivalOverrideName?: string | null;
  /** Upcoming stop after the current destination (for "Then" / will-arrive copy). */
  nextStopName?: string | null;
  /** Already-passed stops — Mapbox must never re-banner these mid-trip. */
  completedStopNames?: string[];
}) {
  const lockedArrived = Boolean(arrivalOverrideName?.trim());
  const arrivedStopName = arrivalOverrideName?.trim() || stopName;
  const willArriveCopy = `You will arrive at ${stopName}`;

  // Only switch to stop-arrival copy when the driver is actually near the stop.
  // Do NOT treat Mapbox "arrive" waypoint banners as stop-only — that hid all turns.
  const nearStop = lockedArrived || phase === 'arrived' || phase === 'approaching';
  const maneuverType = (routeProgress?.maneuverType ?? '').toLowerCase();
  const isArriveManeuver = maneuverType === 'arrive';
  const stalePrimary = isStaleMapboxStopBanner(
    routeProgress?.maneuverPrimaryText,
    stopName,
    completedStopNames,
  );
  const staleInstruction = isStaleMapboxStopBanner(
    routeProgress?.maneuverInstruction,
    stopName,
    completedStopNames,
  );
  const hasDirectionalType =
    maneuverType === 'turn' ||
    maneuverType === 'roundabout' ||
    maneuverType === 'rotary' ||
    maneuverType === 'merge' ||
    maneuverType === 'fork' ||
    maneuverType === 'end of road' ||
    maneuverType === 'uturn';
  const hasDirectionalModifier = Boolean(
    (routeProgress?.maneuverModifier ?? '').toLowerCase().match(/left|right/),
  );
  // Stale arrive *text* must not block real left/right turns from type+modifier.
  const hasRoadManeuver =
    Boolean(maneuverType) &&
    !isArriveManeuver &&
    (hasDirectionalType ||
      hasDirectionalModifier ||
      maneuverType === 'new name' ||
      maneuverType === 'depart' ||
      maneuverType === 'continue' ||
      maneuverType === 'notification' ||
      (Boolean(routeProgress?.maneuverPrimaryText) && !stalePrimary) ||
      (Boolean(routeProgress?.maneuverInstruction) && !staleInstruction));

  const turnDistance = routeProgress?.distanceToNextManeuver;
  const hasTurnDistance =
    turnDistance != null && Number.isFinite(turnDistance) && turnDistance >= 0;

  const turnInstruction =
    !lockedArrived && !nearStop && !isArriveManeuver
      ? buildTurnInstruction(
          routeProgress?.maneuverType,
          routeProgress?.maneuverModifier,
          routeProgress?.maneuverStreetName,
          routeProgress?.maneuverPrimaryText,
          routeProgress?.maneuverInstruction,
          stopName,
          completedStopNames,
        )
      : null;

  // Show left/right whenever Mapbox reports a directional maneuver.
  // Plain "continue" only becomes the banner when the next maneuver is close.
  const showTurnGuidance =
    !lockedArrived &&
    !nearStop &&
    Boolean(turnInstruction) &&
    (hasDirectionalType ||
      hasDirectionalModifier ||
      (hasTurnDistance && !isArriveManeuver && turnDistance! < 800 && hasRoadManeuver));


  // Prefer Mapbox leg remaining for stop distance when present (synced with bottom sheet).
  const nativeStopDistance = routeProgress?.distanceRemaining;
  const useNativeStopDistance =
    !lockedArrived &&
    !showTurnGuidance &&
    nativeStopDistance != null &&
    Number.isFinite(nativeStopDistance) &&
    nativeStopDistance >= 0 &&
    (stopDistanceMeters <= 0 ||
      (nativeStopDistance <= Math.max(stopDistanceMeters * 4, stopDistanceMeters + 800) &&
        // Reject stale ~0m after stop advance while crow-flies is still far.
        (stopDistanceMeters <= 40 ||
          nativeStopDistance >= Math.min(stopDistanceMeters * 0.35, stopDistanceMeters - 25))));
  const resolvedStopDistance = useNativeStopDistance
    ? nativeStopDistance!
    : stopDistanceMeters;

  const distanceLabel = lockedArrived
    ? 'Now'
    : showTurnGuidance && hasTurnDistance
      ? formatTurnByTurnDistance(turnDistance!)
      : formatNavigationDistance(resolvedStopDistance);

  const effectivePhase = lockedArrived ? 'arrived' : phase;

  const primaryText = lockedArrived
    ? `You have arrived at ${arrivedStopName}`
    : nearStop
      ? effectivePhase === 'arrived'
        ? `You have arrived at ${stopName}`
        : willArriveCopy
      : showTurnGuidance && turnInstruction
        ? turnInstruction
        : willArriveCopy;

  const etaLabel =
    stopEtaTimestamp != null
      ? formatEtaTime(stopEtaTimestamp)
      : stopDurationSeconds != null && Number.isFinite(stopDurationSeconds)
        ? formatNavigationDuration(stopDurationSeconds)
        : null;

  const thenStop = nextStopName?.trim() || null;

  const secondaryText = lockedArrived
    ? thenStop
      ? `Next · You will arrive at ${thenStop}`
      : 'Stop complete'
    : nearStop
      ? [formatNavigationDistance(resolvedStopDistance), etaLabel].filter(Boolean).join(' · ')
      : showTurnGuidance
        ? ['Then', willArriveCopy, etaLabel].filter(Boolean).join(' · ')
        : [etaLabel, formatNavigationDistance(resolvedStopDistance)].filter(Boolean).join(' · ');

  const iconName = lockedArrived || effectivePhase === 'arrived'
    ? 'place'
    : nearStop
      ? 'near-me'
      : showTurnGuidance
        ? getManeuverIconName(routeProgress?.maneuverType, routeProgress?.maneuverModifier)
        : 'straight';

  return (
    <View
      style={[
        styles.liveGuidanceBanner,
        {
          paddingTop: topInset + 8,
          backgroundColor: theme.banner,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${primaryText}, ${distanceLabel}`}
    >
      <View style={styles.liveGuidanceRow}>
        <View style={styles.liveGuidanceLeft}>
          <MaterialIcons name={iconName as any} size={40} color={theme.bannerText} />
          <Text style={[styles.liveGuidanceDistance, { color: theme.bannerText }]}>
            {distanceLabel}
          </Text>
        </View>
        <View style={styles.liveGuidanceTextCol}>
          <Text
            style={[styles.liveGuidanceInstruction, { color: theme.bannerText }]}
            numberOfLines={2}
          >
            {primaryText}
          </Text>
          <Text
            style={[styles.liveGuidanceSecondary, { color: theme.bannerMuted }]}
            numberOfLines={1}
          >
            {secondaryText}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function MapboxNavigationHud({
  theme,
  topOffset,
  bottomInset,
  safeTopInset = 0,
  speedMps,
  routeColor: _routeColor = '#1A73E8',
  routeName: _routeName,
  currentStopIndex,
  upcomingStops,
  allStops,
  driverLocation,
  routeProgress,
  arrivalBanner = null,
  isOffRoute = false,
  onEndNavigation,
}: MapboxNavigationHudProps) {
  const stopMetrics = useMemo(() => {
    if (upcomingStops.length === 0) return [];
    return computePerStopRouteMetrics({
      remainingStops: upcomingStops,
      currentStopIndex,
      driverLocation,
      routeProgress,
    });
  }, [upcomingStops, currentStopIndex, driverLocation, routeProgress]);

  const currentDestinationMetric = stopMetrics[0] ?? null;
  const followingStopMetrics = stopMetrics.slice(1, 4);

  const [sheetExpanded, setSheetExpanded] = useState(false);
  const enteredFromOutsideRef = useRef<Record<string, boolean>>({});

  // Phase must use crow-flies — native leg remaining can stay ~0 after stop advance.
  const crowDistanceToStop = useMemo(() => {
    const stop = upcomingStops[0];
    if (!driverLocation || !stop) return null;
    if (
      !Number.isFinite(driverLocation.latitude) ||
      !Number.isFinite(driverLocation.longitude) ||
      !Number.isFinite(stop.latitude) ||
      !Number.isFinite(stop.longitude)
    ) {
      return null;
    }
    return calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      stop.latitude,
      stop.longitude,
    );
  }, [driverLocation, upcomingStops]);

  const distanceToStop = currentDestinationMetric?.distanceMeters ?? null;
  const phaseDistance = crowDistanceToStop ?? distanceToStop;
  const stopKey = currentDestinationMetric?.stop.id ?? String(currentStopIndex);
  if (phaseDistance != null && phaseDistance > HUD_ARRIVAL_METERS + 10) {
    enteredFromOutsideRef.current[stopKey] = true;
  }
  const rawPhase = resolveStopHudPhase(
    phaseDistance,
    HUD_APPROACHING_METERS,
    HUD_ARRIVAL_METERS,
  );
  const phase =
    rawPhase === 'arrived' && !enteredFromOutsideRef.current[stopKey]
      ? phaseDistance != null && phaseDistance <= HUD_APPROACHING_METERS
        ? 'approaching'
        : 'next'
      : rawPhase;

  const currentStopName =
    toStopNameText(currentDestinationMetric?.stop.longName) ||
    (currentDestinationMetric ? `Stop ${currentDestinationMetric.stopIndex + 1}` : 'Finding stop…');

  const nextStopName =
    toStopNameText(followingStopMetrics[0]?.stop.longName) ||
    (followingStopMetrics[0] ? `Stop ${followingStopMetrics[0].stopIndex + 1}` : null);

  const arrivalOverrideName = arrivalBanner?.stopName?.trim() || null;

  const completedStopNames = useMemo(() => {
    if (!allStops || allStops.length === 0) return [];
    return allStops
      .slice(0, Math.max(0, currentStopIndex))
      .map((stop) => toStopNameText(stop.longName))
      .filter((name) => Boolean(name));
  }, [allStops, currentStopIndex]);

  const phaseLabel = PHASE_LABEL[phase];
  const phaseColor =
    phase === 'arrived' ? '#188038' : phase === 'approaching' ? '#E37400' : theme.eta;

  const sheetSurfaceStyle = [
    styles.sheet,
    {
      backgroundColor: theme.sheetBg,
      shadowColor: theme.chipShadow,
      borderColor: theme.chipBorder,
    },
    !sheetExpanded && styles.sheetCollapsed,
  ];

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Always mounted for the whole trip — do not unmount on stop arrivals. */}
      <GoogleMapsGuidanceBanner
        theme={theme}
        topInset={safeTopInset}
        phase={phase}
        stopName={currentStopName}
        stopDistanceMeters={crowDistanceToStop ?? distanceToStop ?? 0}
        stopDurationSeconds={currentDestinationMetric?.durationSeconds}
        stopEtaTimestamp={currentDestinationMetric?.etaTimestamp}
        routeProgress={arrivalOverrideName ? null : routeProgress}
        arrivalOverrideName={arrivalOverrideName}
        nextStopName={arrivalOverrideName ? currentStopName : nextStopName}
        completedStopNames={completedStopNames}
      />

      <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
        <SpeedPill speedMps={speedMps} theme={theme} />
        <EndNavigationButton theme={theme} onPress={onEndNavigation} />
      </View>

      {/* Off-route banner disabled — noisy / unnecessary for current training UX
      {isOffRoute && !arrivalBanner ? (
        <View
          style={[styles.offRouteBanner, { top: topOffset + 56 }]}
          accessibilityRole="alert"
          accessibilityLabel="Off route. Return to the assigned route."
        >
          <MaterialIcons name="warning" size={22} color="#FFF" />
          <View style={styles.arrivalBannerTextWrap}>
            <Text style={styles.arrivalBannerEyebrow}>Off route</Text>
            <Text style={styles.arrivalBannerName} numberOfLines={2}>
              Return to the assigned route
            </Text>
          </View>
        </View>
      ) : null}
      */}

      <View style={[styles.bottomHost, { paddingBottom: bottomInset }]} pointerEvents="box-none">
        {sheetExpanded ? (
          <View style={sheetSurfaceStyle}>
            <TouchableOpacity
              style={styles.sheetHandleRow}
              onPress={() => setSheetExpanded(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Collapse stop details"
            >
              <View style={styles.sheetHandle} />
              <MaterialIcons
                name="keyboard-arrow-down"
                size={22}
                color={theme.sheetSecondary}
                style={styles.collapseIcon}
              />
            </TouchableOpacity>

            {currentDestinationMetric ? (
              <NextStopCard
                metric={currentDestinationMetric}
                theme={theme}
                label={phaseLabel}
              />
            ) : (
              <Text style={[styles.emptyNextStop, { color: theme.sheetSecondary }]}>
                No active stop on this trip
              </Text>
            )}

            {followingStopMetrics.map((metric) => (
              <NextStopCard
                key={`upcoming-${metric.stopIndex}-${metric.stop.id}`}
                metric={metric}
                theme={theme}
                label={`Then · stop ${metric.stopIndex + 1}`}
              />
            ))}

            <TouchableOpacity
              style={[styles.endSheetButton, { backgroundColor: theme.exitBg }]}
              onPress={onEndNavigation}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="End navigation"
            >
              <MaterialIcons name="stop-circle" size={20} color={theme.exitText} />
              <Text style={[styles.endSheetButtonText, { color: theme.exitText }]}>
                End navigation
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={sheetSurfaceStyle}
            onPress={() => setSheetExpanded(true)}
            activeOpacity={0.92}
            accessibilityRole="button"
            accessibilityLabel={`${phaseLabel}: ${currentStopName}`}
            accessibilityHint="Expands current and upcoming stop details"
          >
            <View style={styles.collapsedHeader}>
              <Text style={[styles.phaseBadge, { color: phaseColor }]}>{phaseLabel}</Text>
              {currentDestinationMetric ? (
                <Text style={[styles.collapsedDistance, { color: theme.sheetPrimary }]}>
                  {formatNavigationDistance(currentDestinationMetric.distanceMeters)}
                </Text>
              ) : null}
            </View>
            <Text
              style={[styles.collapsedStopName, { color: theme.sheetPrimary }]}
              numberOfLines={2}
            >
              {currentStopName}
            </Text>
            <View style={styles.collapsedRow}>
              <Text style={[styles.collapsedMeta, { color: theme.sheetSecondary }]} numberOfLines={1}>
                {currentDestinationMetric ? (
                  <>
                    <Text style={[styles.collapsedEta, { color: theme.eta }]}>
                      {formatEtaTime(currentDestinationMetric.etaTimestamp)}
                    </Text>
                    {'  ·  '}
                    {formatNavigationDuration(currentDestinationMetric.durationSeconds)}
                    {'  ·  '}
                    {`Stop ${currentStopIndex + 1}`}
                  </>
                ) : (
                  'Waiting for stop details…'
                )}
              </Text>
              <MaterialIcons name="keyboard-arrow-up" size={22} color={theme.sheetSecondary} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveGuidanceBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 14,
    paddingHorizontal: 16,
    elevation: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: {},
    }),
  },
  liveGuidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
  },
  liveGuidanceLeft: {
    alignItems: 'center',
    minWidth: 64,
    gap: 2,
  },
  liveGuidanceDistance: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  liveGuidanceInstruction: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  liveGuidanceTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  liveGuidanceSecondary: {
    fontSize: 14,
    fontWeight: '600',
  },
  speedPill: {
    minWidth: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  speedValue: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  speedUnit: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  endFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  bottomHost: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
  },
  sheet: {
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  sheetCollapsed: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 6,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  collapseIcon: {
    marginTop: -2,
  },
  collapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phaseBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  collapsedDistance: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  collapsedStopName: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedMeta: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  collapsedEta: {
    fontWeight: '700',
  },
  arrivalBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#188038',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  offRouteBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#C5221F',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  arrivalBannerTextWrap: {
    flex: 1,
    gap: 2,
  },
  arrivalBannerEyebrow: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arrivalBannerName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.45)',
    marginBottom: 2,
  },
  nextStopCard: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  nextStopLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  nextStopName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  nextStopMetrics: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  nextStopEta: {
    fontWeight: '700',
  },
  emptyNextStop: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  endSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
  },
  endSheetButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
