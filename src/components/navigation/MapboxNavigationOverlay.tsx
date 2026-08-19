/**
 * Full-screen native Mapbox Navigation SDK overlay (iOS + Android).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeepAwake from 'react-native-keep-awake';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { TurnByTurnNavigationState } from '@/features/navigation/types';
import type { LastLocation } from '@/context/DriverModelContext';
import type { NativeRouteProgress } from '@/hooks/useMapboxTurnByTurnNavigation';
import type { FrozenMapboxNativeSession } from '@/features/navigation/mapboxNativeRoute';
import { StableMapboxNavigationSession } from '@/components/navigation/StableMapboxNavigationSession';
import MapboxNavigationHud from '@/components/navigation/MapboxNavigationHud';
import { getNavigationHudTheme } from '@/config/navigationMapStyle';
import { toStopNameText } from '@/utils/stopDisplayName';

/** Native Mapbox maneuver banner — keep floating HUD below it. */
const NATIVE_MANEUVER_BANNER_CLEARANCE = Platform.select({
  ios: 92,
  android: 108,
  default: 100,
});

const ROUTE_PROGRESS_THROTTLE_MS = 1000;
const ARRIVAL_BANNER_MS = 2500;

interface NavigationChromeState {
  status: TurnByTurnNavigationState['status'];
  stops: TurnByTurnNavigationState['stops'];
  currentStopIndex: number;
  errorMessage: string | null;
  cancelNavigation: () => void;
  currentDestination: TurnByTurnNavigationState['stops'][number] | null;
  upcomingStops: TurnByTurnNavigationState['stops'];
  handleNativeArrive: () => void;
  handleNativeRouteProgress: (progress: NativeRouteProgress) => void;
  handleNativeOffRoute: (offRoute: boolean) => void;
  handleNativeError: (message: string) => void;
  handleNativeCancel: () => void;
  isOffRoute?: boolean;
}

interface MapboxNavigationOverlayProps {
  visible: boolean;
  frozenNativeSession: FrozenMapboxNativeSession | null;
  navigationState: NavigationChromeState;
  lastLocation: LastLocation | null;
  routeName?: string | null;
  routeColor?: string;
}

export default function MapboxNavigationOverlay({
  visible,
  frozenNativeSession,
  navigationState,
  lastLocation,
  routeName,
  routeColor,
}: MapboxNavigationOverlayProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [routeProgress, setRouteProgress] = useState<NativeRouteProgress | null>(null);
  const [arrivalBanner, setArrivalBanner] = useState<{ stopName: string } | null>(null);
  const lastProgressPushRef = useRef(0);
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theme = useMemo(
    () => getNavigationHudTheme(colorScheme === 'dark' ? 'dark' : 'light'),
    [colorScheme],
  );

  useEffect(() => {
    if (!visible) {
      setRouteProgress(null);
      setArrivalBanner(null);
      lastProgressPushRef.current = 0;
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current);
        arrivalTimerRef.current = null;
      }
    }
  }, [visible]);

  const isOffRoute = Boolean(navigationState.isOffRoute);

  useEffect(() => {
    return () => {
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current);
      }
    };
  }, []);

  const handlersRef = useRef(navigationState);
  handlersRef.current = navigationState;

  const nativeCallbacks = useMemo(
    () => ({
      onArrive: () => {
        const destination = handlersRef.current.currentDestination;
        const stopName =
          toStopNameText(destination?.longName) ||
          `Stop ${(handlersRef.current.currentStopIndex ?? 0) + 1}`;

        if (arrivalTimerRef.current) {
          clearTimeout(arrivalTimerRef.current);
        }
        setArrivalBanner({ stopName });
        arrivalTimerRef.current = setTimeout(() => {
          setArrivalBanner(null);
          handlersRef.current.handleNativeArrive();
          arrivalTimerRef.current = null;
        }, ARRIVAL_BANNER_MS);
      },
      onRouteProgressChange: (progress: NativeRouteProgress) => {
        handlersRef.current.handleNativeRouteProgress(progress);
        const now = Date.now();
        if (now - lastProgressPushRef.current >= ROUTE_PROGRESS_THROTTLE_MS) {
          lastProgressPushRef.current = now;
          setRouteProgress(progress);
        }
      },
      onOffRoute: (offRoute: boolean) => {
        handlersRef.current.handleNativeOffRoute(offRoute);
      },
      onError: (message: string) => handlersRef.current.handleNativeError(message),
      onCancel: () => handlersRef.current.handleNativeCancel(),
    }),
    [],
  );

  const canRenderNavigation =
    visible && frozenNativeSession != null && navigationState.status !== 'error';

  const showHudChrome =
    visible &&
    navigationState.status !== 'error' &&
    (navigationState.status === 'preparing' || canRenderNavigation);

  const topHudOffset =
    Math.max(insets.top, 8) +
    (showHudChrome ? (NATIVE_MANEUVER_BANNER_CLEARANCE ?? 100) : 0);

  const driverLocation = lastLocation
    ? { latitude: lastLocation.latitude, longitude: lastLocation.longitude }
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={navigationState.cancelNavigation}
    >
      {visible ? <KeepAwake /> : null}
      <View style={[styles.container, { backgroundColor: theme.canvas }]}>
        {canRenderNavigation && frozenNativeSession ? (
          <StableMapboxNavigationSession
            session={frozenNativeSession}
            onArrive={nativeCallbacks.onArrive}
            onRouteProgressChange={nativeCallbacks.onRouteProgressChange}
            onOffRoute={nativeCallbacks.onOffRoute}
            onError={nativeCallbacks.onError}
            onCancel={nativeCallbacks.onCancel}
          />
        ) : (
          <View style={styles.fallback}>
            {navigationState.status === 'error' ? (
              <>
                <MaterialIcons name="error-outline" size={42} color={theme.bannerText} />
                <Text style={[styles.errorText, { color: theme.error }]}>
                  {navigationState.errorMessage ?? 'Navigation is unavailable.'}
                </Text>
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: theme.banner }]}
                  onPress={navigationState.cancelNavigation}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Close navigation"
                >
                  <Text style={styles.closeBtnText}>Back to map</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color={theme.banner} />
            )}
          </View>
        )}

        {showHudChrome ? (
          <MapboxNavigationHud
            theme={theme}
            topOffset={topHudOffset}
            bottomInset={Math.max(insets.bottom, 12)}
            speedMps={lastLocation?.speed}
            routeName={routeName}
            routeColor={routeColor}
            currentStopIndex={navigationState.currentStopIndex}
            upcomingStops={navigationState.upcomingStops}
            driverLocation={driverLocation}
            routeProgress={routeProgress}
            arrivalBanner={arrivalBanner}
            isOffRoute={isOffRoute}
            onEndNavigation={navigationState.cancelNavigation}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
