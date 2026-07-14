/**
 * Google Maps Navigation–style HUD with light + dark system themes.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import {
  formatEtaTime,
  formatNavigationDistanceMeters,
  formatNavigationDuration,
  formatTurnByTurnDistance,
  getManeuverIconName,
} from '@/features/navigation/navigationUtils';
import { toStopNameText } from '@/utils/stopDisplayName';
import type { NavigationProgress, NavigationStatus, NavigationStop } from '@/features/navigation/types';
import { speedMpsToMph } from '@/api/position.api';
import {
  getNavigationHudTheme,
  type NavigationHudTheme,
} from '@/config/navigationMapStyle';

interface MapboxNavigationPanelProps {
  status: NavigationStatus;
  destination: NavigationStop | null;
  progress: NavigationProgress | null;
  stopIndex: number;
  totalStops: number;
  stops: NavigationStop[];
  upcomingStops: NavigationStop[];
  routeName?: string | null;
  errorMessage: string | null;
  onCancel: () => void;
  speedMps?: number;
  heading?: number;
  onCompassPress?: () => void;
}

function normalizeHeading(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

function GoogleCompass({
  heading,
  onPress,
  theme,
}: {
  heading: number;
  onPress?: () => void;
  theme: NavigationHudTheme;
}) {
  const dialRotation = -normalizeHeading(heading);

  return (
    <TouchableOpacity
      style={[
        styles.compassButton,
        {
          backgroundColor: theme.chipBg,
          borderColor: theme.chipBorder,
          shadowColor: theme.chipShadow,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Compass"
    >
      <View style={[styles.compassDial, { transform: [{ rotate: `${dialRotation}deg` }] }]}>
        <Svg width={48} height={48} viewBox="0 0 48 48">
          <Circle
            cx="24"
            cy="24"
            r="22"
            fill={theme.compassFace}
            stroke={theme.compassRing}
            strokeWidth={1.5}
          />
          <Circle cx="24" cy="24" r="18" fill={theme.compassInner} />
          <Path d="M24 8L28.5 24H19.5L24 8Z" fill="#EA4335" />
          <Path d="M24 40L19.5 24H28.5L24 40Z" fill={theme.compassSouth} />
          <Circle
            cx="24"
            cy="24"
            r="3.2"
            fill={theme.compassFace}
            stroke={theme.compassHubStroke}
            strokeWidth={1.2}
          />
          <SvgText
            x="24"
            y="15"
            fill="#EA4335"
            fontSize="8"
            fontWeight="700"
            textAnchor="middle"
          >
            N
          </SvgText>
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

export default function MapboxNavigationPanel({
  status,
  destination,
  progress,
  stopIndex,
  totalStops,
  upcomingStops,
  errorMessage,
  onCancel,
  speedMps = 0,
  heading = 0,
  onCompassPress,
}: MapboxNavigationPanelProps) {
  const colorScheme = useColorScheme();
  const theme = useMemo(
    () => getNavigationHudTheme(colorScheme === 'dark' ? 'dark' : 'light'),
    [colorScheme],
  );

  const isLoading = status === 'preparing' || status === 'rerouting';
  const instruction = progress?.currentInstruction ?? 'Calculating route…';
  const maneuverDistance = formatTurnByTurnDistance(progress?.distanceToNextManeuverMeters ?? 0);
  const maneuverIcon = getManeuverIconName(
    progress?.currentManeuverType,
    progress?.currentManeuverModifier,
  );
  const destinationName = toStopNameText(destination?.longName) || `Stop ${stopIndex + 1}`;
  const remainingStops = progress?.remainingStopsCount ?? upcomingStops.length;

  const speedMph = useMemo(() => {
    const mph = speedMpsToMph(speedMps);
    return Math.max(0, Math.round(mph));
  }, [speedMps]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.topBlock} pointerEvents="box-none">
        <View style={[styles.banner, { backgroundColor: theme.banner }]}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.bannerText} />
              <Text style={[styles.loadingText, { color: theme.bannerText }]}>
                {status === 'rerouting' ? 'Rerouting…' : 'Getting route…'}
              </Text>
            </View>
          ) : (
            <View style={styles.bannerRow}>
              <View style={styles.bannerLeft}>
                <MaterialIcons name={maneuverIcon as any} size={40} color={theme.bannerText} />
                <Text style={[styles.bannerDistance, { color: theme.bannerText }]}>
                  {maneuverDistance}
                </Text>
              </View>
              <View style={styles.bannerRight}>
                <Text
                  style={[styles.bannerInstruction, { color: theme.bannerText }]}
                  numberOfLines={2}
                >
                  {instruction}
                </Text>
                <Text style={[styles.bannerThen, { color: theme.bannerMuted }]} numberOfLines={1}>
                  Then toward {destinationName}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sideControlsRow} pointerEvents="box-none">
          <View
            style={[
              styles.speedBox,
              {
                backgroundColor: theme.chipBg,
                borderColor: theme.chipBorder,
                shadowColor: theme.chipShadow,
              },
            ]}
          >
            <Text style={[styles.speedValue, { color: theme.speedValue }]}>{speedMph}</Text>
            <Text style={[styles.speedUnit, { color: theme.speedUnit }]}>mph</Text>
          </View>

          <GoogleCompass heading={heading} onPress={onCompassPress} theme={theme} />
        </View>
      </View>

      <View
        style={[
          styles.bottomSheet,
          {
            backgroundColor: theme.sheetBg,
            shadowColor: theme.chipShadow,
          },
        ]}
      >
        <View style={styles.sheetTopRow}>
          <View style={styles.etaCol}>
            <Text style={[styles.etaTime, { color: theme.eta }]}>
              {formatEtaTime(progress?.legEtaTimestamp ?? null)}
            </Text>
            <Text style={[styles.etaSub, { color: theme.sheetSecondary }]}>ETA</Text>
          </View>

          <View style={styles.metricCol}>
            <Text style={[styles.metricMain, { color: theme.sheetPrimary }]}>
              {formatNavigationDuration(progress?.legRemainingDurationSeconds ?? 0)}
            </Text>
            <Text style={[styles.metricSub, { color: theme.sheetSecondary }]}>
              {formatNavigationDistanceMeters(progress?.distanceToCurrentStopMeters ?? 0)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.exitButton, { backgroundColor: theme.exitBg }]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Exit navigation"
            activeOpacity={0.85}
          >
            <Text style={[styles.exitText, { color: theme.exitText }]}>Exit</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.destinationLine, { color: theme.sheetSecondary }]} numberOfLines={1}>
          {destinationName}
          {remainingStops > 0 ? `  ·  Stop ${stopIndex + 1} of ${totalStops}` : ''}
        </Text>

        {errorMessage ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  topBlock: {
    gap: 10,
  },
  banner: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 88,
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bannerLeft: {
    alignItems: 'center',
    minWidth: 64,
    gap: 2,
  },
  bannerDistance: {
    fontSize: 20,
    fontWeight: '700',
  },
  bannerRight: {
    flex: 1,
    gap: 4,
  },
  bannerInstruction: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  bannerThen: {
    fontSize: 13,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sideControlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  speedBox: {
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  speedValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  speedUnit: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  compassButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  compassDial: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheet: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  etaCol: {
    minWidth: 72,
  },
  etaTime: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  etaSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  metricCol: {
    flex: 1,
  },
  metricMain: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricSub: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  exitButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  exitText: {
    fontSize: 14,
    fontWeight: '700',
  },
  destinationLine: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
});
