/**
 * Map view used during active Mapbox navigation (route overlay + stable camera).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { NavigationCoordinate, NavigationStop } from '@/features/navigation/types';
import { sliceRouteAheadOfDriver } from '@/features/navigation/navigationUtils';
import { MAPBOX_CONFIG } from '@/config/mapbox.config';
import { vehicleMarkerImage } from '@/config/mapMarkers';
import { calculateDistance } from '@/utils/helpers';
import { toStopNameText } from '@/utils/stopDisplayName';
import { COLORS } from '@/theme/colors';
import VehicleMapMarkerContent from '@/components/map/VehicleMapMarkerContent';

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
} catch (_error) {
  // react-native-maps unavailable
}

interface MapboxNavigationMapProps {
  location: NavigationCoordinate | null;
  heading?: number;
  routeCoordinates: NavigationCoordinate[];
  destination: NavigationCoordinate | null;
  stops: NavigationStop[];
  currentStopIndex: number;
  routeColor?: string;
  routePolylineIndex?: number;
}

export default function MapboxNavigationMap({
  location,
  heading = 0,
  routeCoordinates,
  destination,
  stops,
  currentStopIndex,
  routeColor = '#3B82F6',
  routePolylineIndex = 0,
}: MapboxNavigationMapProps) {
  const mapRef = useRef<any>(null);
  const lastLegFitRef = useRef<string | null>(null);
  const lastCameraCenterRef = useRef<NavigationCoordinate | null>(null);
  const lastCameraMoveAtRef = useRef(0);
  const minRouteIndexRef = useRef(routePolylineIndex);

  useEffect(() => {
    minRouteIndexRef.current = Math.max(minRouteIndexRef.current, routePolylineIndex);
  }, [routePolylineIndex]);

  const routeAhead = useMemo(() => {
    if (!location || routeCoordinates.length < 2) return routeCoordinates;
    return sliceRouteAheadOfDriver(location, routeCoordinates, minRouteIndexRef.current);
  }, [location, routeCoordinates]);

  const legFitKey = useMemo(() => {
    const dest = destination
      ? `${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`
      : 'none';
    return `${currentStopIndex}|${dest}|${routeCoordinates.length}`;
  }, [currentStopIndex, destination, routeCoordinates.length]);

  useEffect(() => {
    if (!mapRef.current || lastLegFitRef.current === legFitKey) return;

    const points: NavigationCoordinate[] = [];
    if (location) points.push(location);
    if (routeCoordinates.length > 0) points.push(...routeCoordinates);
    if (destination) points.push(destination);
    stops.slice(currentStopIndex).forEach((stop) => {
      points.push({ latitude: stop.latitude, longitude: stop.longitude });
    });

    if (points.length === 0) return;
    lastLegFitRef.current = legFitKey;
    minRouteIndexRef.current = 0;
    lastCameraCenterRef.current = location;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 100, right: 40, bottom: 320, left: 40 },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [legFitKey, location, routeCoordinates, destination, stops, currentStopIndex]);


  
  useEffect(() => {
    if (!mapRef.current || !location) return;

    const now = Date.now();
    const prev = lastCameraCenterRef.current;
    const moved =
      !prev ||
      calculateDistance(prev.latitude, prev.longitude, location.latitude, location.longitude) >=
        MAPBOX_CONFIG.CAMERA_RECENTER_DISTANCE_METERS;
    const waited = now - lastCameraMoveAtRef.current >= MAPBOX_CONFIG.CAMERA_RECENTER_INTERVAL_MS;

    if (!moved || !waited) return;

    lastCameraCenterRef.current = location;
    lastCameraMoveAtRef.current = now;

    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      700,
    );
  }, [location?.latitude, location?.longitude]);

  if (!MapView) {
    return <View style={styles.fallback} />;
  }

  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }
    : destination
      ? {
          latitude: destination.latitude,
          longitude: destination.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : undefined;

  const markerImage = vehicleMarkerImage();

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
      pitchEnabled={false}
      scrollEnabled
      zoomEnabled
    >
      {routeCoordinates.length > 1 && Polyline ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="rgba(148, 163, 184, 0.35)"
          strokeWidth={4}
          lineJoin="round"
          lineCap="round"
        />
      ) : null}

      {routeAhead.length > 1 && Polyline ? (
        <Polyline
          coordinates={routeAhead}
          strokeColor={routeColor}
          strokeWidth={7}
          lineJoin="round"
          lineCap="round"
        />
      ) : null}

      {stops.map((stop, index) => {
        if (!Marker) return null;
        const isCurrent = index === currentStopIndex;
        const isPast = index < currentStopIndex;
        const showLabel = isCurrent || index === currentStopIndex + 1;
        const pinColor = isPast ? '#94A3B8' : isCurrent ? '#F59E0B' : routeColor;
        const compact = !isCurrent && !showLabel;

        return (
          <Marker
            key={`nav-stop-${stop.id}`}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={isCurrent ? 35 : isPast ? 5 : 20}
            image={markerImage}
            tracksViewChanges={false}
          >
            <View style={styles.stopMarkerWrap} collapsable={false}>
              {showLabel ? (
                <View
                  style={[
                    styles.stopLabelBubble,
                    isCurrent ? styles.stopLabelCurrent : styles.stopLabelUpcoming,
                  ]}
                >
                  <Text style={styles.stopLabelText} numberOfLines={2}>
                    {toStopNameText(stop.longName)}
                  </Text>
                </View>
              ) : null}
              {!compact ? <View style={styles.stopPinStem} /> : null}
              <View
                style={[
                  styles.stopPinHead,
                  { backgroundColor: pinColor },
                  isCurrent && styles.stopPinHeadCurrent,
                  isPast && styles.stopPinHeadPast,
                  compact && styles.stopPinHeadSmall,
                ]}
              >
                <Text
                  style={[
                    styles.stopPinIndex,
                    isPast && styles.stopPinIndexPast,
                    compact && styles.stopPinIndexSmall,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
            </View>
          </Marker>
        );
      })}

      {location && Marker ? (
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={50}
          image={markerImage}
          tracksViewChanges={Platform.OS === 'ios'}
        >
          <VehicleMapMarkerContent
            heading={heading}
            color={routeColor}
            blinkMode="none"
            size={44}
          />
        </Marker>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  stopMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stopLabelBubble: {
    maxWidth: 168,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
    borderWidth: 1.5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stopLabelCurrent: {
    borderColor: '#F59E0B',
  },
  stopLabelUpcoming: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  stopLabelText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  stopPinStem: {
    width: 3,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 1,
  },
  stopPinHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  stopPinHeadCurrent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
  },
  stopPinHeadPast: {
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.75,
  },
  stopPinHeadSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  stopPinIndex: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stopPinIndexPast: {
    fontSize: 9,
  },
  stopPinIndexSmall: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
