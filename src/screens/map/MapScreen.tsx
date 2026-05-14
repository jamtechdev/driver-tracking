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
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, { Path } from 'react-native-svg';
import MainLayout from '../../components/MainLayout';
import { COLORS } from '../../theme/colors';
import { useDriverModel } from '../../context/DriverModelContext';
import { useAuth } from '../../context/AuthContext';
import { useMapLocation } from '../../context/MapLocationContext';
import { useDriverData } from '../../context/DriverDataContext';
import { MAPS_CONFIG, isMapsApiKeyValid } from '../../config/maps.config';
import { getAllVehicles } from '../../api/vehicle.api';

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

const DirectionalArrow = ({ color }: { color: string }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // useEffect(() => {
  //   // Create a 'ping' animation: start from center, expand and fade out
  //   Animated.loop(
  //     Animated.timing(pulseAnim, {
  //       toValue: 1,
  //       duration: 2000,
  //       useNativeDriver: true,
  //     })
  //   ).start();
  // }, [pulseAnim]);

  const glowScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5], // Larger expansion
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 0.8, 0], // Quick fade in, slow fade out
  });

  return (
    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulsing Glow Effect */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 30,
          height: 30,
          borderRadius: 15,
          // backgroundColor: color,
          // opacity: glowOpacity,
          // transform: [{ scale: glowScale }],
        }}
      />
      {/* The Arrow */}
      <Svg width={50} height={50} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2L19 21L12 17L5 21L12 2Z"
          fill={color}
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};


const MapScreen: React.FC<MapScreenProps> = ({ navigation, isTabView = false }) => {
  const { isAcquiringSat, trackingMode, setTrackingMode } = useDriverModel();
  const { location, error: mapLocationError, heading } = useMapLocation();
  const { vehicleId, selectedRouteId, driver } = useAuth();
  const { agency, routes, stops } = useDriverData();
  const [vehiclesPosition, setVehiclesPosition] = useState<any[]>([]);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPositionOverlay, setShowPositionOverlay] = useState(false);
  const { width, height } = useWindowDimensions();
  const isMobile = width < 600;
  const isLandscape = width > height;
  const [initialRegion, setInitialRegion] = useState({
    ...MAPS_CONFIG.DEFAULT_REGION,
    latitudeDelta: MAPS_CONFIG.DEFAULT_REGION.latitudeDelta ?? 0.0922,
    longitudeDelta: MAPS_CONFIG.DEFAULT_REGION.longitudeDelta ?? 0.0421,
  });
  const [currentRegion, setCurrentRegion] = useState(initialRegion);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchOtherVehicles = async () => {
      try {
        const data = await getAllVehicles();
        if (data !== null) {
          setVehiclesPosition(data);
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
    routes.find(r => String(r.routeID) === String(selectedRouteId)),
    [routes, selectedRouteId]
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

  // All other routes (not selected) with valid points
  const otherRoutesWithPoints = useMemo(() =>
    routes
      .filter(r => String(r.routeID) !== String(selectedRouteId) && r.points)
      .map(r => ({
        routeID: String(r.routeID),
        color: r.color ? `#${r.color}` : COLORS.textMuted,
        points: parseRoutePoints(r.points as string),
      }))
      .filter(r => r.points.length > 0),
    [routes, selectedRouteId]
  );

  const getRouteStops = useCallback((route: any) => {
    const rStops = route?.routeStops;
    if (!rStops || !Array.isArray(rStops) || stops.length === 0) return [];
    return stops.filter(stop =>
      rStops.some((id: any) => String(id) === String(stop.stopID))
    );
  }, [stops]);

  const routeStops = useMemo(() => getRouteStops(selectedRoute), [selectedRoute, getRouteStops]);

  // Other vehicles (all, not just same route), excluding current driver
  const otherVehicles = useMemo(() =>
    vehiclesPosition.filter(v => String(v.vehicleID) !== String(vehicleId)),
    [vehiclesPosition, vehicleId]
  );


  useEffect(() => {
    if (routePoints.length > 0 && mapReady && mapRef.current) {
      // Use a small timeout to ensure map layout is complete before fitting
      const timer = setTimeout(() => {
        mapRef.current.fitToCoordinates(routePoints, {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [routePoints, mapReady]);

  // Fit to route when map first becomes ready if route already exists
  useEffect(() => {
    if (mapReady && routePoints.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(routePoints, {
        edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
        animated: true,
      });
    }
  }, [mapReady]);

  // Center on user location if no route is selected
  useEffect(() => {
    if (mapReady && routePoints.length === 0 && mapRef.current) {
      if (location && driver?.role !== 'unassigned') {
        const reg = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current.animateToRegion(reg, 1000);
      } else if (agency?.latitude && agency?.longitude) {
        const reg = {
          latitude: parseFloat(agency.latitude),
          longitude: parseFloat(agency.longitude),
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        mapRef.current.animateToRegion(reg, 1000);
      }
    }
  }, [mapReady, routePoints.length, location?.latitude, location?.longitude, agency?.latitude, agency?.longitude, driver?.role]);

  const calculatedRegion = useMemo(() => {
    if (agency?.latitude && agency?.longitude && (driver?.role === 'unassigned' || !location)) {
      return {
        latitude: parseFloat(agency.latitude),
        longitude: parseFloat(agency.longitude),
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    if (location && !mapReady) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }
    return null;
  }, [location, agency, mapReady, driver?.role]);

  useEffect(() => {
    if (calculatedRegion) {
      setInitialRegion(calculatedRegion);
      setCurrentRegion(calculatedRegion);
    }
  }, [calculatedRegion, setInitialRegion, setCurrentRegion]);

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

  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (location && !hasCenteredRef.current && mapReady) {
      const reg = {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setInitialRegion(reg);
      setCurrentRegion(reg);
      mapRef.current?.animateToRegion(reg, 500);
      hasCenteredRef.current = true;
    }
  }, [location, mapReady]);

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
      <MapView
        ref={mapRef}
        style={isTabView ? styles.mapWithHeader : styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={!isTabView || isMobile}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={setCurrentRegion}
        zoomControlEnabled={!isTabView || isMobile}
      >
        {/* Other routes – dimmed polylines */}
        {otherRoutesWithPoints.map(r => (
          <Polyline
            key={`route-path-${r.routeID}`}
            coordinates={r.points}
            strokeColor={r.color + '66'}
            strokeWidth={4}
            lineJoin="round"
            lineCap="round"
          />
        ))}

        {/* Other route stops – small dimmed dots */}
        {otherRoutesWithPoints.map(r => {
          const rObj = routes.find(ro => String(ro.routeID) === r.routeID);
          return getRouteStops(rObj).map((stop) => {
            const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat as string);
            const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng as string);
            if (isNaN(lat) || isNaN(lng)) return null;
            return (
              <Marker
                key={`other-stop-${r.routeID}-${stop.stopID}`}
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                title={String(stop.longName || `Stop ${stop.stopID}`)}
              >
                <View style={[styles.stopMarker, { backgroundColor: r.color + '99', borderColor: r.color, width: 12, height: 12, borderRadius: 6 }]} />
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

        {/* Selected route stops */}
        {routeStops.map((stop) => {
          const lat = typeof stop.lat === 'number' ? stop.lat : parseFloat(stop.lat as string);
          const lng = typeof stop.lng === 'number' ? stop.lng : parseFloat(stop.lng as string);
          if (isNaN(lat) || isNaN(lng)) return null;
          return (
            <Marker
              key={`stop-${stop.stopID}`}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 1 }}
              title={String(stop.longName || `Stop ${stop.stopID}`)}
              description={`Stop ID: ${stop.stopID}`}
            >
              <View style={[styles.stopMarker, { backgroundColor: routeColor, borderColor: '#FFF' }]} />
            </Marker>
          );
        })}
        {
          driver?.role === 'unassigned' && (
            <Marker
              key="agency-marker"
              coordinate={{
                latitude: parseFloat(agency?.latitude || "0"),
                longitude: parseFloat(agency?.longitude || "0"),
              }}
              title="Agency"
              description="Agency Location"
              anchor={{ x: 0.5, y: 1 }}
            >
              <DirectionalArrow color={COLORS.background} />
            </Marker>
          )
        }

        {location && driver && driver?.role !== 'unassigned' && (
          <Marker
            key="user-marker-map-context"
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="You"
            description={
              `Accuracy: ${Math.round(location.accuracy)} m`
            }
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
            flat
          >

            <DirectionalArrow color={selectedRouteId ? routeColor : COLORS.background} />
          </Marker>
        )}

        {/* All other vehicles with their own route color */}
        {otherVehicles.map((v) => {
          const lat = typeof v.lat === 'number' ? v.lat : parseFloat(v.lat);
          const lng = typeof v.lng === 'number' ? v.lng : parseFloat(v.lng);
          const bear = typeof v.bearing === 'number' ? v.bearing : parseFloat(v.bearing || v.heading || '0');
          const vColor = routeColorMap[String(v.routeID)] ?? COLORS.textMuted;

          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={`vehicle-${v.vehicleID}`}
              coordinate={{ latitude: lat, longitude: lng }}
              title={String(v.vehicleName || v.vehicleNumber || `Vehicle ${v.vehicleID}`)}
              description={`Route: ${v.routeShortName || v.routeID || '—'}`}
              anchor={{ x: 0.5, y: 0.5 }}
              rotation={isNaN(bear) ? 0 : bear}
              flat
            >
              <DirectionalArrow color={vColor} />
            </Marker>
          );
        })}
      </MapView>

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
                  {heading != null ? ` · Heading: ${Math.round(heading)}°` : ''}
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
              Vehicle: {vehicleId || '—'} · Route: {selectedRouteId || '—'}
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
    width: 20,
    height: 20,
    borderRadius: 10,
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
});

export default MapScreen;
