/**
 * Map Screen - Real map view with driver position from DriverModel.
 * Uses react-native-maps (Apple Maps on iOS, Google Maps on Android).
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import MainLayout from '../../components/MainLayout';
import VehicleMapMarkerContent from '../../components/map/VehicleMapMarkerContent';
import VehicleInfoMapOverlay from '../../components/map/VehicleInfoMapOverlay';
import { useMapVehicleMarkerPress } from '../../hooks/useMapVehicleMarkerPress';
import { useVehicleInfoWindow } from '../../hooks/useVehicleInfoWindow';
import { COLORS } from '../../theme/colors';
import { useDriverModel } from '../../context/DriverModelContext';
import { useEmergency } from '../../context/EmergencyContext';
import { useAuth } from '../../context/AuthContext';
import { useMapLocation } from '../../context/MapLocationContext';
import { useDriverData } from '../../context/DriverDataContext';
import { useMapAssignment } from '../../hooks/useMapAssignment';
import { MAPS_CONFIG, isMapsApiKeyValid } from '../../config/maps.config';
import {
  buildStopMarkerId,
  isStopMarkerId,
  vehicleMarkerImage,
  vehicleMarkerTracksViewChanges,
} from '../../config/mapMarkers';
import { buildTabletMarkerKey, buildVehicleMarkerKey } from '../../utils/mapMarkerKeys';
import { handleStopMarkerPress, handleVehicleMarkerPress } from '../../utils/mapMarkerPress';
import {
  buildOwnMapVehicle,
  isOwnTabletMapVehicle,
  TABLET_DEVICE_VEHICLE_ID,
} from '../../utils/mapVehicleInfo';
import { getAllVehicles } from '../../api/vehicle.api';
import StartNavigationButton from '../../components/navigation/StartNavigationButton';
import MapboxNavigationOverlay from '../../components/navigation/MapboxNavigationOverlay';
import { useMapboxTurnByTurnNavigation } from '../../hooks/useMapboxTurnByTurnNavigation';
import { orderStopsByRouteStopIds, resolveNavigableStops } from '../../features/navigation/navigationStopUtils';
import { resolveNavigationLocation } from '../../features/navigation/navigationLocation';
import { isMapboxAccessTokenValid } from '../../config/mapbox.config';
import { useMdtTurnByTurnFeature } from '../../hooks/useMdtTurnByTurnFeature';
import { useTripOrderedStops } from '../../hooks/useTripOrderedStops';
import { PEAK_DEFAULT_PARAMS } from '../../config/env';
import {
  createVehicleHeadingResolver,
  isVehicleLocationFresh,
  parseVehicleCourse,
  parseVehicleLatLng,
  shouldAnimateVehicleArrow,
  getVehicleRouteColor,
  getTabletMarkerBlinkMode,
  isEmergencyAlertActive,
  isVehicleEmergencyAlertActive,
} from '../../utils/helpers';

interface MapScreenProps {
  navigation: any;
  isTabView?: boolean;
}

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
} catch (_e) {
  // react-native-maps not linked: show fallback UI
}

const MapScreen: React.FC<MapScreenProps> = ({ navigation, isTabView = false }) => {
  const {
    isAcquiringSat,
    trackingMode,
    setTrackingMode,
    lastLocation,
    serverAlert,
    schedule,
    nextStop,
    locationError,
  } = useDriverModel();
  const { emergencyActivated } = useEmergency();
  const { location, error: mapLocationError, heading } = useMapLocation();
  const { vehicleId, selectedRouteId, selectedRoute: selectedRouteName, driver, vehicleName } = useAuth();
  const { effectiveRouteId, hasMapAssignment, blockPeerVehicleIds, assignedTripId } = useMapAssignment();
  const { agency, routes, stops } = useDriverData();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID || agency?.agencyID || '');
  const turnByTurnFeature = useMdtTurnByTurnFeature(agencyID || null);
  const [vehiclesPosition, setVehiclesPosition] = useState<any[]>([]);
  const resolveVehicleHeading = useRef(createVehicleHeadingResolver()).current;
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPositionOverlay, setShowPositionOverlay] = useState(false);
  const { width, height } = useWindowDimensions();
  // Shortest side — phones in landscape must not flip to "tablet" UI.
  const isMobile = Math.min(width, height) < 600;
  const isLandscape = width > height;
  const [initialRegion, setInitialRegion] = useState({
    ...MAPS_CONFIG.DEFAULT_REGION,
    latitudeDelta: MAPS_CONFIG.DEFAULT_REGION.latitudeDelta ?? 0.0922,
    longitudeDelta: MAPS_CONFIG.DEFAULT_REGION.longitudeDelta ?? 0.0421,
  });
  const [currentRegion, setCurrentRegion] = useState(initialRegion);
  const [arrowBlink, setArrowBlink] = useState<0 | 1>(0);
  const {
    selectedVehicle,
    showVehicleInfo,
    dismissVehicleInfo,
    isVehicleInfoVisible,
  } = useVehicleInfoWindow();
  const liveInfoVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    const id = String(selectedVehicle.vehicleID);
    const polled = vehiclesPosition.find(v => String(v.vehicleID) === id);
    if (!polled) return selectedVehicle;
    if (isOwnTabletMapVehicle(selectedVehicle, vehicleId)) {
      return { ...polled, ...selectedVehicle };
    }
    return polled;
  }, [selectedVehicle, vehiclesPosition, vehicleId]);
  const [mapRegionTick, setMapRegionTick] = useState(0);
  const [mapLayout, setMapLayout] = useState({ width: 1, height: 1 });

  const navigationLocation = useMemo(
    () => resolveNavigationLocation(location, lastLocation, heading),
    [location, lastLocation, heading],
  );

  /** Same GPS fix sent to admin via DriverModel vehicle/update. */
  const telemetryCoordinate = useMemo(() => {
    if (lastLocation) {
      return { latitude: lastLocation.latitude, longitude: lastLocation.longitude };
    }
    if (location) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    return null;
  }, [lastLocation, location]);

  const navigationLocationError = locationError ?? mapLocationError ?? null;

  const handleNavigationTripCompleted = useCallback((_routeId: string | null) => {
    Toast.show({
      type: 'success',
      text1: 'Trip complete',
      text2: 'All assigned stops have been reached.',
    });
  }, []);

  const infoVehicle = liveInfoVehicle ?? selectedVehicle;

  const infoMapCoordinate = useMemo(() => {
    if (!infoVehicle) return null;

    if (isOwnTabletMapVehicle(infoVehicle, vehicleId)) {
      if (!telemetryCoordinate) return null;
      return telemetryCoordinate;
    }

    const fromVehicle = parseVehicleLatLng(infoVehicle);
    if (fromVehicle) {
      return { latitude: fromVehicle.lat, longitude: fromVehicle.lng };
    }
    return null;
  }, [infoVehicle, telemetryCoordinate, vehicleId]);

  const infoBubbleCoordinate = useMemo(() => {
    if (infoMapCoordinate) return infoMapCoordinate;
    if (!selectedVehicle) return null;
    const parsed = parseVehicleLatLng(selectedVehicle);
    if (parsed) return { latitude: parsed.lat, longitude: parsed.lng };
    if (isOwnTabletMapVehicle(selectedVehicle, vehicleId) && telemetryCoordinate) {
      return telemetryCoordinate;
    }
    return null;
  }, [infoMapCoordinate, selectedVehicle, vehicleId, telemetryCoordinate]);

  const handleMapLayout = useCallback((event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setMapLayout({ width, height });
    }
  }, []);

  useEffect(() => {
    if (isVehicleInfoVisible) {
      setMapRegionTick(t => t + 1);
    }
  }, [isVehicleInfoVisible, selectedVehicle?.vehicleID]);

  useEffect(() => {
    if (!isVehicleInfoVisible || !infoBubbleCoordinate) return;
    setMapRegionTick(t => t + 1);
  }, [
    isVehicleInfoVisible,
    infoBubbleCoordinate?.latitude,
    infoBubbleCoordinate?.longitude,
  ]);

  const handleVehiclePress = useCallback(
    (vehicle: Record<string, unknown>) => {
      mapRef.current?.hideCallout?.();
      showVehicleInfo(vehicle);
      setMapRegionTick(t => t + 1);
    },
    [showVehicleInfo],
  );

  const tabletHeading = lastLocation?.heading ?? heading ?? 0;
  const tabletAlertActive = isEmergencyAlertActive(serverAlert) || emergencyActivated;
  const tabletBlinkMode = getTabletMarkerBlinkMode(hasMapAssignment, tabletAlertActive);

  // Shared blink phase for tablet + other vehicles without a route color
  useEffect(() => {
    const timer = setInterval(() => {
      setArrowBlink(p => (p === 0 ? 1 : 0));
    }, 600);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchOtherVehicles = async () => {
      try {
        const data = await getAllVehicles();
        if (data !== null) {
          setVehiclesPosition([...data]);
        }
      } catch (err) {
        console.warn('[MapScreen] Failed to fetch other vehicles:', err);
      }
    };

    fetchOtherVehicles();
    interval = setInterval(fetchOtherVehicles, 5000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const parseRoutePoints = (pointsStr: any): { latitude: number, longitude: number }[] => {
    if (!pointsStr || typeof pointsStr !== 'string') return [];
    try {
      const coords = pointsStr.match(/-?\d+\.\d+/g);
      if (!coords || coords.length < 2) return [];

      const result = [];
      for (let i = 0; i < coords.length; i += 2) {
        if (coords[i + 1]) {
          result.push({
            latitude: parseFloat(coords[i]),
            longitude: parseFloat(coords[i + 1]),
          });
        }
      }
      return result;
    } catch (e) {
      console.error('Error parsing points string:', e);
      return [];
    }
  };

  const selectedRoute = useMemo(() =>
    routes.find(r => String(r.routeID) === String(effectiveRouteId)),
    [routes, effectiveRouteId],
  );

  const routeColor = selectedRoute?.color ? `#${selectedRoute.color}` : COLORS.background;

  // Build a routeID → color map for all routes
  const routeColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    routes.forEach(r => {
      map[String(r.routeID)] = r.color ? `#${r.color}` : COLORS.primary;
    });
    return map;
  }, [routes]);

  const routePoints = useMemo(() => {
    if (!selectedRoute?.points) return [];
    return parseRoutePoints(selectedRoute.points);
  }, [selectedRoute]);

  // Other routes only when no route is assigned (assigned drivers see their route only)
  const otherRoutesWithPoints = useMemo(() => {
    if (hasMapAssignment) return [];
    return routes
      .filter(r => String(r.routeID) !== String(effectiveRouteId) && r.points)
      .map(r => ({
        routeID: String(r.routeID),
        color: r.color ? `#${r.color}` : COLORS.textMuted,
        points: parseRoutePoints(r.points as string),
      }))
      .filter(r => r.points.length > 0);
  }, [routes, effectiveRouteId, hasMapAssignment]);

  const getRouteStops = useCallback((route: any) => {
    const rStops = route?.routeStops;
    if (!rStops || !Array.isArray(rStops) || stops.length === 0) return [];
    return orderStopsByRouteStopIds(rStops, stops);
  }, [stops]);

  const routeStops = useMemo(() => getRouteStops(selectedRoute), [selectedRoute, getRouteStops]);

  const routeStopIds = useMemo(() => {
    const raw = selectedRoute?.routeStops;
    return Array.isArray(raw) ? (raw as Array<string | number>) : null;
  }, [selectedRoute]);

  const { tripOrderedStops, tripId } = useTripOrderedStops({
    agencyID: agencyID || null,
    routeStopIds,
    assignedTripId,
    allStops: stops,
  });

  /** Prefer stoptimes sequence for map + Mapbox; fall back to route.routeStops. */
  const mapStopList = tripOrderedStops.length > 0 ? tripOrderedStops : routeStops;

  const navigableStops = useMemo(
    () => resolveNavigableStops(schedule, stops, nextStop, routeStops, tripOrderedStops),
    [schedule, stops, nextStop, routeStops, tripOrderedStops],
  );

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[Mapbox stops source]', {
      tripId,
      usingStopTimes: tripOrderedStops.length > 0,
      stopTimesCount: tripOrderedStops.length,
      routeStopsCount: routeStops.length,
    });
  }, [tripId, tripOrderedStops.length, routeStops.length]);

  const turnByTurn = useMapboxTurnByTurnNavigation({
    schedule,
    allStops: stops,
    mapRouteStops: routeStops,
    tripOrderedStops,
    agencyRoutePoints: routePoints,
    nextStop,
    lastLocation: navigationLocation,
    locationError: navigationLocationError,
    routeId: effectiveRouteId ?? selectedRouteId,
    onTripCompleted: handleNavigationTripCompleted,
  });

  useEffect(() => {
    if (turnByTurn.status !== 'error' || !turnByTurn.errorMessage) return;
    Toast.show({
      type: 'error',
      text1: 'Navigation error',
      text2: turnByTurn.errorMessage,
      visibilityTime: 4000,
    });
  }, [turnByTurn.status, turnByTurn.errorMessage]);

  // Fresh vehicles on the same route when assigned; otherwise all fresh vehicles except self
  const otherVehicles = useMemo(() => {
    let list = vehiclesPosition.filter(
      v => String(v.vehicleID) !== String(vehicleId) && isVehicleLocationFresh(v),
    );
    if (hasMapAssignment && effectiveRouteId) {
      list = list.filter(v =>
        String(v.routeID) === String(effectiveRouteId) ||
        blockPeerVehicleIds.has(String(v.vehicleID)),
      );
    }
    return list;
  }, [vehiclesPosition, vehicleId, hasMapAssignment, effectiveRouteId, blockPeerVehicleIds]);

  const tabletMapVehicle = useMemo(() => {
    if (!driver) return null;
    return buildOwnMapVehicle({
      vehicleId: vehicleId ? String(vehicleId) : TABLET_DEVICE_VEHICLE_ID,
      vehicleName: vehicleName ?? (vehicleId ? String(vehicleId) : 'Your vehicle'),
      routeId: effectiveRouteId ?? selectedRouteId,
      routeShortName: selectedRouteName,
    });
  }, [driver, vehicleId, vehicleName, effectiveRouteId, selectedRouteId, selectedRouteName]);

  const { onMapMarkerPress, onVehicleMarkerPress } = useMapVehicleMarkerPress(
    otherVehicles,
    handleVehiclePress,
    tabletMapVehicle,
    location,
    { onStopMarkerPress: dismissVehicleInfo },
  );

  const handleMapMarkerPress = useCallback(
    (event: {
      nativeEvent?: { id?: string; identifier?: string };
    }) => {
      const rawId = event.nativeEvent?.identifier ?? event.nativeEvent?.id;
      if (isStopMarkerId(rawId != null ? String(rawId) : null)) {
        dismissVehicleInfo();
        return;
      }
      mapRef.current?.hideCallout?.();
      onMapMarkerPress(event);
    },
    [onMapMarkerPress, dismissVehicleInfo],
  );

  const lastFittedRouteIdRef = useRef<string | null>(null);
  const hasInitialCenteredRef = useRef(false);

  // Fit to assigned route once per route (not on every GPS update or pan)
  useEffect(() => {
    if (!mapReady || !mapRef.current || routePoints.length === 0 || !effectiveRouteId) return;
    if (lastFittedRouteIdRef.current === effectiveRouteId) return;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(routePoints, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
      lastFittedRouteIdRef.current = effectiveRouteId;
      hasInitialCenteredRef.current = true;
    }, 600);
    return () => clearTimeout(timer);
  }, [mapReady, routePoints, effectiveRouteId]);

  const handleZoomIn = () => {
    if (mapRef.current) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: currentRegion.latitudeDelta * 0.5,
        longitudeDelta: currentRegion.longitudeDelta * 0.5,
      };
      setCurrentRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const newRegion = {
        ...currentRegion,
        latitudeDelta: currentRegion.latitudeDelta * 2,
        longitudeDelta: currentRegion.longitudeDelta * 2,
      };
      setCurrentRegion(newRegion);
      mapRef.current.animateToRegion(newRegion, 300);
    }
  };

  // Center on device location once when there is no route shape to fit
  useEffect(() => {
    if (!mapReady || !mapRef.current || hasInitialCenteredRef.current) return;
    if (routePoints.length > 0) return;

    if (location) {
      const reg = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setInitialRegion(reg);
      setCurrentRegion(reg);
      mapRef.current.animateToRegion(reg, 500);
      hasInitialCenteredRef.current = true;
    } else if (agency?.latitude && agency?.longitude) {
      const reg = {
        latitude: parseFloat(agency.latitude),
        longitude: parseFloat(agency.longitude),
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setInitialRegion(reg);
      setCurrentRegion(reg);
      mapRef.current.animateToRegion(reg, 500);
      hasInitialCenteredRef.current = true;
    }
  }, [mapReady, routePoints.length, location?.latitude, location?.longitude, agency?.latitude, agency?.longitude]);

  if (!MapView || !Marker) {
    const fallbackContent = (
      <View style={styles.fallback}>
        {!isTabView && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.fallbackIcon}>🗺️</Text>
        <Text style={styles.fallbackTitle}>Map not loaded</Text>
        <Text style={styles.fallbackText}>
          Install the map library and rebuild:{'\n'}
          npm install{'\n'}
          cd ios && pod install && cd ..{'\n'}
          Then rebuild the app.
        </Text>
        <View style={styles.positionCard}>
          <Text style={styles.positionTitle}>Your position (Map Context)</Text>
          {mapLocationError ? (
            <Text style={styles.positionError}>{mapLocationError}</Text>
          ) : location ? (
            <Text style={styles.positionCoords}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.positionMuted}>Waiting for GPS…</Text>
          )}
        </View>
      </View>
    );
    return isTabView ? fallbackContent : <MainLayout navigation={navigation}>{fallbackContent}</MainLayout>;
  }

  const hasMapsApiKey = isMapsApiKeyValid();
  if (!hasMapsApiKey) {
    const noKeyContent = (
      <View style={styles.container}>
        {!isTabView && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
          <Text style={styles.mapPlaceholderTitle}>Map view</Text>
          <Text style={styles.mapPlaceholderText}>
            Add a Google Maps API key to display the map.
          </Text>
        </View>
        <View style={styles.positionCard}>
          <Text style={styles.positionTitle}>Your position</Text>
          {mapLocationError ? (
            <Text style={styles.positionError}>{mapLocationError}</Text>
          ) : location ? (
            <Text style={styles.positionCoords}>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={styles.positionMuted}>Waiting for GPS…</Text>
          )}
        </View>
      </View>
    );
    return isTabView ? noKeyContent : <MainLayout navigation={navigation}>{noKeyContent}</MainLayout>;
  }

  const tabletInfoOpen =
    tabletMapVehicle != null &&
    isVehicleInfoVisible &&
    isOwnTabletMapVehicle(selectedVehicle, vehicleId);

  const content = (
    <View style={styles.container}>
      {!isTabView && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}
      <View
        style={isTabView ? styles.mapHostWithHeader : styles.mapHost}
        onLayout={handleMapLayout}
      >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={!isTabView || isMobile}
        onMapReady={() => setMapReady(true)}
        onMarkerPress={handleMapMarkerPress}
        onRegionChange={(region: typeof currentRegion) => {
          setCurrentRegion(region);
          setMapRegionTick(t => t + 1);
        }}
        onRegionChangeComplete={setCurrentRegion}
        zoomControlEnabled={!isTabView || isMobile}
      >
        {/* Other routes – only when driver has no route assignment */}
        {!hasMapAssignment && otherRoutesWithPoints.map(r => (
          <Polyline
            key={`route-path-${r.routeID}`}
            coordinates={r.points}
            strokeColor={r.color}
            strokeWidth={4}
            lineJoin="round"
            lineCap="round"
          />
        ))}

        {!hasMapAssignment && otherRoutesWithPoints.map(r => {
          const rObj = routes.find(ro => String(ro.routeID) === r.routeID);
          return getRouteStops(rObj).map((stop) => {
            const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat as string);
            const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng as string);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={`other-stop-${r.routeID}-${stop.stopID}`}
                identifier={buildStopMarkerId(stop.stopID, r.routeID)}
                image={vehicleMarkerImage()}
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                zIndex={0}
                title={String(stop.longName || `Stop ${stop.stopID}`)}
                description={`Stop ID: ${stop.stopID}`}
                onPress={(e: unknown) =>
                  handleStopMarkerPress(e, dismissVehicleInfo)
                }
              >
                <View style={[styles.stopMarker, { backgroundColor: r.color, borderColor: '#FFF' }]} />
                {/* <View style={[styles.stopMarker, { backgroundColor: r.color, borderColor: r.color, width: 12, height: 12, borderRadius: 6 }]} /> */}
              </Marker>
            );
          });
        })}

        {/* Selected route polyline */}
        {routePoints.length > 0 && Polyline && (
          <Polyline
            coordinates={routePoints}
            strokeColor={routeColor}
            strokeWidth={4}
            lineJoin="round"
            lineCap="round"
          />
        )}

        {/* Selected route stops — prefer stoptimes order when tripID is available */}
        {mapStopList.map((stop) => {
          const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat as string);
          const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng as string);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={`stop-${stop.stopID}`}
              identifier={buildStopMarkerId(
                stop.stopID,
                effectiveRouteId ?? selectedRouteId ?? undefined,
              )}
              image={vehicleMarkerImage()}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              zIndex={0}
              title={String(stop.longName || `Stop ${stop.stopID}`)}
              description={`Stop ID: ${stop.stopID}`}
              onPress={(e: unknown) =>
                handleStopMarkerPress(e, dismissVehicleInfo)
              }
            >
              <View style={[styles.stopMarker, { backgroundColor: routeColor, borderColor: '#FFF' }]} />
            </Marker>
          );
        })}
        {/* Tablet / device GPS marker — tap opens same vehicle info overlay as other markers */}
        {telemetryCoordinate && tabletMapVehicle && (
          <Marker
            key={buildTabletMarkerKey(
              tabletBlinkMode !== 'none',
              arrowBlink,
              tabletInfoOpen,
            )}
            identifier={String(tabletMapVehicle.vehicleID)}
            calloutEnabled={false}
            image={vehicleMarkerImage()}
            coordinate={telemetryCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={vehicleMarkerTracksViewChanges(tabletBlinkMode !== 'none' || tabletInfoOpen)}
            zIndex={tabletInfoOpen ? 999 : 10}
            onPress={(e: unknown) => handleVehicleMarkerPress(e, tabletMapVehicle, onVehicleMarkerPress)}
          >
            <VehicleMapMarkerContent
              heading={tabletHeading}
              color={hasMapAssignment ? routeColor : COLORS.background}
              blinkMode={tabletBlinkMode}
              blinkPhase={tabletBlinkMode === 'none' ? undefined : arrowBlink}
              onPress={() => onVehicleMarkerPress(tabletMapVehicle)}
            />
          </Marker>
        )}

        {/* All other vehicles with their own route color */}
        {otherVehicles.map((v) => {
          const coord = parseVehicleLatLng(v);
          if (!coord) return null;

          const course = parseVehicleCourse(v);
          const bear = resolveVehicleHeading(String(v.vehicleID), coord, course);
          let vColor = getVehicleRouteColor(v, routeColorMap);
          let vehicleAnimates = shouldAnimateVehicleArrow(v, routeColorMap);
          if (
            !vColor &&
            hasMapAssignment &&
            effectiveRouteId &&
            blockPeerVehicleIds.has(String(v.vehicleID))
          ) {
            vColor = routeColorMap[effectiveRouteId] ?? routeColor;
            vehicleAnimates = false;
          }
          vColor = vColor ?? COLORS.background;
          const vehicleAlertBlink = isVehicleEmergencyAlertActive(v);
          const markerBlinks = vehicleAlertBlink || vehicleAnimates;
          const vId = String(v.vehicleID);
          const infoOpen =
            isVehicleInfoVisible && String(selectedVehicle?.vehicleID) === vId;
          const markerKey = buildVehicleMarkerKey(
            v.vehicleID,
            markerBlinks,
            arrowBlink,
            infoOpen,
          );

          return (
            <Marker
              key={markerKey}
              identifier={vId}
              calloutEnabled={false}
              image={vehicleMarkerImage()}
              coordinate={{ latitude: coord.lat, longitude: coord.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges={vehicleMarkerTracksViewChanges(markerBlinks || infoOpen)}
              zIndex={infoOpen ? 999 : 10}
              onPress={(e: unknown) => handleVehicleMarkerPress(e, v, onVehicleMarkerPress)}
            >
              <VehicleMapMarkerContent
                heading={bear}
                color={vColor}
                blinkMode={
                  vehicleAlertBlink ? 'alert' : vehicleAnimates ? 'unassigned' : 'none'
                }
                blinkPhase={markerBlinks ? arrowBlink : undefined}
                onPress={() => onVehicleMarkerPress(v)}
              />
            </Marker>
          );
        })}
      </MapView>

      {isVehicleInfoVisible && selectedVehicle && infoBubbleCoordinate && (
        <VehicleInfoMapOverlay
          mapRef={mapRef}
          mapReady={mapReady}
          regionTick={mapRegionTick}
          region={currentRegion}
          mapLayout={mapLayout}
          coordinate={infoBubbleCoordinate}
          vehicle={infoVehicle ?? selectedVehicle}
          onClose={dismissVehicleInfo}
        />
      )}
      </View>

      {isTabView && !isMobile && isLandscape && (
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomIn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={35} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={handleZoomOut}
            activeOpacity={0.7}
          >
            <MaterialIcons name="remove" size={35} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {!turnByTurn.isNavigating ? (
        <View style={[styles.startNavigationHost, isTabView && isMobile && styles.startNavigationHostMobile]}>
          <StartNavigationButton
            onPress={() => {
              if (!turnByTurnFeature.enabled || !isMapboxAccessTokenValid()) {
                return;
              }
              void turnByTurn.startNavigation();
            }}
            disabled={
              !isMapboxAccessTokenValid() ||
              !turnByTurnFeature.enabled ||
              (!turnByTurn.canStart && !turnByTurn.isNavigating)
            }
            loading={turnByTurn.status === 'preparing'}
            stopCount={navigableStops.length}
            featureEnabled={turnByTurnFeature.enabled && isMapboxAccessTokenValid()}
            featureLoading={turnByTurnFeature.loading}
            ctaText={
              // Priority: feature flag → token → GPS → stops
              !turnByTurnFeature.enabled && !turnByTurnFeature.loading
                ? turnByTurnFeature.error
                  ? `Turn-by-turn unavailable (${turnByTurnFeature.error})`
                  : undefined
                : !isMapboxAccessTokenValid()
                  ? 'Mapbox token missing. Add pk token to .env and run npm run setup:mapbox.'
                  : !navigationLocation
                    ? 'Waiting for GPS fix before navigation can start.'
                    : navigableStops.length === 0
                      ? 'Waiting for assigned stops with coordinates.'
                      : undefined
            }
          />
        </View>
      ) : null}

      <MapboxNavigationOverlay
        visible={turnByTurn.isNavigating}
        frozenNativeSession={turnByTurn.frozenNativeSession}
        navigationState={{
          status: turnByTurn.status,
          stops: turnByTurn.stops,
          currentStopIndex: turnByTurn.currentStopIndex,
          errorMessage: turnByTurn.errorMessage,
          cancelNavigation: turnByTurn.cancelNavigation,
          currentDestination: turnByTurn.currentDestination,
          upcomingStops: turnByTurn.upcomingStops,
          handleNativeArrive: turnByTurn.handleNativeArrive,
          handleNativeRouteProgress: turnByTurn.handleNativeRouteProgress,
          handleNativeLocationChange: turnByTurn.handleNativeLocationChange,
          handleNativeOffRoute: turnByTurn.handleNativeOffRoute,
          handleNativeError: turnByTurn.handleNativeError,
          handleNativeCancel: turnByTurn.handleNativeCancel,
          isOffRoute: turnByTurn.isOffRoute,
        }}
        lastLocation={navigationLocation}
        routeName={selectedRouteName}
        routeColor={routeColor}
      />

      {/* Button to open position overlay (when closed) */}
      {/* {!showPositionOverlay && (
        <TouchableOpacity
          style={styles.openPositionBtn}
          onPress={() => setShowPositionOverlay(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="location-on" size={24} color="#FFF" />
          <Text style={styles.openPositionBtnText}>Your position</Text>
        </TouchableOpacity>
      )} */}

      {/* Overlay: tracking status and controls (shown when opened) */}
      {showPositionOverlay && (
        <View style={styles.overlay}>
          <View style={styles.positionCard}>
            <View style={styles.positionCardHeader}>
              <Text style={styles.positionTitle}>Your position</Text>
              <TouchableOpacity
                onPress={() => setShowPositionOverlay(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeOverlayBtn}
              >
                <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {mapLocationError ? (
              <Text style={styles.positionError}>{mapLocationError}</Text>
            ) : location ? (
              <>
                <Text style={styles.positionCoords}>
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </Text>
                <Text style={styles.positionMeta}>
                  Accuracy: {Math.round(location.accuracy)} m
                  {tabletHeading != null ? ` · Heading: ${Math.round(tabletHeading)}°` : ''}
                  {' · Real-time'}
                </Text>
              </>
            ) : (
              <Text style={styles.positionMuted}>Waiting for GPS…</Text>
            )}
            <View style={styles.trackingRow}>
              <Text style={styles.trackingLabel}>Tracking:</Text>
              {(['off', 'auto', 'on'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.trackingBtn, trackingMode === mode && styles.trackingBtnActive]}
                  onPress={() => setTrackingMode(mode)}
                >
                  <Text
                    style={[
                      styles.trackingBtnText,
                      trackingMode === mode && styles.trackingBtnTextActive,
                    ]}
                  >
                    {mode === 'off' ? 'Off' : mode === 'auto' ? 'Auto' : 'On'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.positionHint}>
              Vehicle: {vehicleId || '—'} · Route: {effectiveRouteId || selectedRouteId || '—'}
            </Text>
          </View>
        </View>
      )}

      {/* {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      )} */}
    </View>
  );

  return isTabView ? content : <MainLayout navigation={navigation}>{content}</MainLayout>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 120,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTime: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  zoomControls: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#252A32',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: 120,
  },
  zoomButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#252A32',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 42, 50, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapHost: {
    flex: 1,
    position: 'relative',
  },
  mapHostWithHeader: {
    flex: 1,
    position: 'relative',
  },
  mapWithHeader: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    marginTop: 60,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  openPositionBtn: {
    position: 'absolute',
    top: 44,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#252A32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-end',
    width: '30%'
  },
  openPositionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  overlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
  },
  positionCard: {
    backgroundColor: '#252A32',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  positionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  closeOverlayBtn: {
    padding: 4,
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  positionCoords: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.primary,
    marginBottom: 4,
  },
  positionMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  positionMuted: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  positionError: {
    fontSize: 14,
    color: COLORS.emergency,
    marginBottom: 12,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  trackingLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  trackingBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trackingBtnActive: {
    backgroundColor: COLORS.primary,
  },
  trackingBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  trackingBtnTextActive: {
    color: '#FFF',
  },
  positionHint: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.emergency,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startNavigationHost: {
    position: 'absolute',
    left: 16,
    right: 136,
    bottom: 24,
    zIndex: 20,
  },
  startNavigationHostMobile: {
    right: 16,
  },
});

export default MapScreen;
