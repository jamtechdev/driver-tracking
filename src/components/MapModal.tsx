/**
 * Map Modal - Map view in modal overlay
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useMapModal } from '../context/MapModalContext';
import { useMapLocation } from '../context/MapLocationContext';
import { useDriverModel } from '../context/DriverModelContext';
import { useEmergency } from '../context/EmergencyContext';
import { MAPS_CONFIG } from '../config/maps.config';
import { useDriverData } from '../context/DriverDataContext';
import { useMapAssignment } from '../hooks/useMapAssignment';
import { TRANSPARENT_MAP_MARKER } from '../config/mapMarkers';
import { buildTabletMarkerKey } from '../utils/mapMarkerKeys';
import DirectionalArrow from './DirectionalArrow';
import { getTabletMarkerBlinkMode, isEmergencyAlertActive } from '../utils/helpers';

let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch (_e) { }

const MapModal: React.FC = () => {
  const { visible, close } = useMapModal();
  const { location, heading, error } = useMapLocation();
  const { lastLocation, serverAlert } = useDriverModel();
  const { emergencyActivated } = useEmergency();
  const { agency, routes } = useDriverData();
  const { effectiveRouteId, hasMapAssignment } = useMapAssignment();
  const [mapReady, setMapReady] = React.useState(false);
  const [arrowBlink, setArrowBlink] = React.useState<0 | 1>(0);

  const tabletHeading = lastLocation?.heading ?? heading ?? 0;
  const tabletAlertActive = isEmergencyAlertActive(serverAlert) || emergencyActivated;
  const tabletBlinkMode = getTabletMarkerBlinkMode(hasMapAssignment, tabletAlertActive);

  const tabletRouteColor = React.useMemo(() => {
    const route = routes.find(r => String(r.routeID) === String(effectiveRouteId));
    return route?.color ? `#${route.color}` : COLORS.background;
  }, [routes, effectiveRouteId]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setArrowBlink(p => (p === 0 ? 1 : 0));
    }, 600);
    return () => clearInterval(timer);
  }, []);

  const initialRegion = React.useMemo(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }
    if (agency?.latitude && agency?.longitude) {
      return {
        latitude: parseFloat(agency.latitude),
        longitude: parseFloat(agency.longitude),
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
    }
    return {
      ...MAPS_CONFIG.DEFAULT_REGION,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  }, [location, agency]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Real-time Map</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {!MapView || !Marker ? (
              <View style={styles.fallback}>
                <Text style={styles.icon}>🗺️</Text>
                <Text style={styles.subtitle}>Map not available</Text>
                <Text style={styles.description}>Please install react-native-maps</Text>
              </View>
            ) : (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={initialRegion}
                  onMapReady={() => setMapReady(true)}
                  showsUserLocation={false}
                >
                  {location && (
                    <Marker
                      key={buildTabletMarkerKey(tabletBlinkMode !== 'none', arrowBlink)}
                      image={TRANSPARENT_MAP_MARKER}
                      coordinate={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }}
                      anchor={{ x: 0.5, y: 0.5 }}
                      flat
                      tracksViewChanges={tabletBlinkMode !== 'none'}
                    >
                      <DirectionalArrow
                        heading={tabletHeading}
                        color={hasMapAssignment ? tabletRouteColor : COLORS.background}
                        blinkMode={tabletBlinkMode}
                        blinkPhase={tabletBlinkMode === 'none' ? undefined : arrowBlink}
                        size={30}
                      />
                    </Marker>
                  )}
                </MapView>
                {!mapReady && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                  </View>
                )}
                {error && (
                  <View style={styles.errorOverlay}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {location && (
            <View style={styles.footer}>
              <MaterialIcons name="location-searching" size={16} color={COLORS.primary} />
              <Text style={styles.coords}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
              <Text style={styles.accuracy}>
                ±{Math.round(location.accuracy)}m
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    height: '80%',
    maxWidth: 600,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  coords: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  accuracy: {
    fontSize: 11,
    color: COLORS.textMuted,
  }
});

export default MapModal;
