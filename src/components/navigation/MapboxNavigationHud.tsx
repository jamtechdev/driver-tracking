/**
 * Modern navigation HUD chrome for native Mapbox overlay.
 */

import React, { useMemo, useState } from 'react';
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
  formatNavigationDistanceMeters,
  formatNavigationDuration,
  type PerStopRouteMetric,
} from '@/features/navigation/navigationUtils';
import { toStopNameText } from '@/utils/stopDisplayName';
import { speedMpsToMph } from '@/api/position.api';

export interface MapboxNavigationHudProps {
  theme: NavigationHudTheme;
  topOffset: number;
  bottomInset: number;
  speedMps?: number;
  routeName?: string | null;
  routeColor?: string;
  currentStopIndex: number;
  totalStops: number;
  upcomingStops: NavigationStop[];
  driverLocation: NavigationCoordinate | null;
  routeProgress: NativeRouteProgress | null;
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
        {formatNavigationDistanceMeters(metric.distanceMeters)}
        {' · '}
        {formatNavigationDuration(metric.durationSeconds)}
      </Text>
    </View>
  );
}

function formatStopSummary(metric: PerStopRouteMetric | null, fallback: string): string {
  if (!metric) return fallback;
  const name = toStopNameText(metric.stop.longName) || `Stop ${metric.stopIndex + 1}`;
  return `${formatEtaTime(metric.etaTimestamp)} · ${formatNavigationDistanceMeters(metric.distanceMeters)} · ${formatNavigationDuration(metric.durationSeconds)} · ${name}`;
}

export default function MapboxNavigationHud({
  theme,
  topOffset,
  bottomInset,
  speedMps,
  routeColor: _routeColor = '#1A73E8',
  routeName: _routeName,
  currentStopIndex,
  totalStops: _totalStops,
  upcomingStops,
  driverLocation,
  routeProgress,
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

  const collapsedSummary = useMemo(
    () => formatStopSummary(currentDestinationMetric, 'No active stop'),
    [currentDestinationMetric],
  );

  const currentStopName =
    toStopNameText(currentDestinationMetric?.stop.longName) ||
    (currentDestinationMetric ? `Stop ${currentDestinationMetric.stopIndex + 1}` : 'Finding stop…');

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
      <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
        <SpeedPill speedMps={speedMps} theme={theme} />
        <EndNavigationButton theme={theme} onPress={onEndNavigation} />
      </View>

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
                label="Current stop"
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
                label={`Upcoming · stop ${metric.stopIndex + 1}`}
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
            accessibilityLabel={`Current stop: ${collapsedSummary}`}
            accessibilityHint="Expands current and upcoming stop details"
          >
            <View style={styles.collapsedRow}>
              <Text
                style={[styles.collapsedText, { color: theme.sheetPrimary }]}
                numberOfLines={1}
              >
                {currentDestinationMetric ? (
                  <>
                    <Text style={[styles.collapsedEta, { color: theme.eta }]}>
                      {formatEtaTime(currentDestinationMetric.etaTimestamp)}
                    </Text>
                    <Text style={{ color: theme.sheetSecondary }}> · </Text>
                    {formatNavigationDistanceMeters(currentDestinationMetric.distanceMeters)}
                    <Text style={{ color: theme.sheetSecondary }}> · </Text>
                    {currentStopName}
                  </>
                ) : (
                  'No active stop'
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
    gap: 0,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  collapseIcon: {
    marginTop: -2,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  collapsedEta: {
    fontWeight: '700',
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
