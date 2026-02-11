/**
 * Map Screen - Real map view with driver position from DriverModel.
 * Uses react-native-maps (Apple Maps on iOS, Google Maps on Android).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MainLayout from '../../components/MainLayout';
import { COLORS } from '../../theme/colors';
import { useDriverModel } from '../../context/DriverModelContext';
import { useAuth } from '../../context/AuthContext';
import { MAPS_CONFIG, isMapsApiKeyValid } from '../../config/maps.config';

interface MapScreenProps {
  navigation: any;
}

let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch (_e) {
  // react-native-maps not linked: show fallback UI
}


const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const { lastLocation, isAcquiringSat, trackingMode, setTrackingMode, locationError } = useDriverModel();
  const { vehicleId, selectedRouteId } = useAuth();
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showPositionOverlay, setShowPositionOverlay] = useState(false);

  const region = lastLocation
    ? {
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : {
        ...MAPS_CONFIG.DEFAULT_REGION,
        latitudeDelta: MAPS_CONFIG.DEFAULT_REGION.latitudeDelta ?? 0.0922,
        longitudeDelta: MAPS_CONFIG.DEFAULT_REGION.longitudeDelta ?? 0.0421,
      };

  useEffect(() => {
    if (lastLocation && mapRef.current && mapReady) {
      mapRef.current.animateToRegion(region, 500);
    }
  }, [lastLocation?.latitude, lastLocation?.longitude, mapReady]);

  if (!MapView || !Marker) {
    return (
      <MainLayout navigation={navigation}>
        <View style={styles.fallback}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.fallbackIcon}>🗺️</Text>
          <Text style={styles.fallbackTitle}>Map not loaded</Text>
          <Text style={styles.fallbackText}>
            Install the map library and rebuild:{'\n'}
            npm install{'\n'}
            cd ios && pod install && cd ..{'\n'}
            Then rebuild the app.
          </Text>
          <View style={styles.positionCard}>
            <Text style={styles.positionTitle}>Your position (DriverModel)</Text>
            {locationError ? (
              <Text style={styles.positionError}>{locationError}</Text>
            ) : lastLocation ? (
              <Text style={styles.positionCoords}>
                {lastLocation.latitude.toFixed(5)}, {lastLocation.longitude.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.positionMuted}>Waiting for GPS…</Text>
            )}
          </View>
        </View>
      </MainLayout>
    );
  }

  const hasMapsApiKey = isMapsApiKeyValid();
  if (!hasMapsApiKey) {
    return (
      <MainLayout navigation={navigation}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderIcon}>🗺️</Text>
            <Text style={styles.mapPlaceholderTitle}>Map view</Text>
            <Text style={styles.mapPlaceholderText}>
              Add a Google Maps API key to display the map.
            </Text>
          </View>
          <View style={styles.positionCard}>
            <Text style={styles.positionTitle}>Your position</Text>
            {locationError ? (
              <Text style={styles.positionError}>{locationError}</Text>
            ) : lastLocation ? (
              <Text style={styles.positionCoords}>
                {lastLocation.latitude.toFixed(5)}, {lastLocation.longitude.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.positionMuted}>Waiting for GPS…</Text>
            )}
          </View>
        </View>
      </MainLayout>
    );
  }

  const content = (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={28} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={true}
        onMapReady={() => setMapReady(true)}
      >
        {lastLocation && (
          <Marker
            coordinate={{
              latitude: lastLocation.latitude,
              longitude: lastLocation.longitude,
            }}
            title="You"
            description={
              isAcquiringSat ? 'Acquiring GPS…' : `Accuracy: ${Math.round(lastLocation.accuracy)} m`
            }
            pinColor={COLORS.primary}
          />
        )}
      </MapView>

      {/* Button to open position overlay (when closed) */}
      {!showPositionOverlay && (
        <TouchableOpacity
          style={styles.openPositionBtn}
          onPress={() => setShowPositionOverlay(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="location-on" size={24} color="#FFF" />
          <Text style={styles.openPositionBtnText}>Your position</Text>
        </TouchableOpacity>
      )}

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
            {locationError ? (
              <Text style={styles.positionError}>{locationError}</Text>
            ) : lastLocation ? (
              <>
                <Text style={styles.positionCoords}>
                  {lastLocation.latitude.toFixed(5)}, {lastLocation.longitude.toFixed(5)}
                </Text>
                <Text style={styles.positionMeta}>
                  Accuracy: {Math.round(lastLocation.accuracy)} m
                  {lastLocation.heading != null ? ` · Heading: ${Math.round(lastLocation.heading)}°` : ''}
                  {isAcquiringSat ? ' · Acquiring GPS…' : ' · Sending to server'}
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

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      )}
    </View>
  );

  return <MainLayout navigation={navigation}>{content}</MainLayout>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    bottom: 24,
    left: 16,
    right: 16,
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
  },
  openPositionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
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
});

export default MapScreen;
