/**
 * Home Screen - Driver Dashboard
 * Clean design for mobile
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Pressable,
  Modal,
  TextInput,
  Platform,
  Image,
  useColorScheme,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Svg, { Line, Circle } from 'react-native-svg';
import GradientPath from 'react-native-svg-path-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWindowDimensions } from 'react-native';
import VehicleSelectModal from '../../components/VehicleSelectModal';
import PassengerCountModal from '../../components/PassengerCountModal';
import BulkPassengerNumpad, { NumpadMode } from '../../components/BulkPassengerNumpad';
import SupervisorModal from '../../components/SupervisorModal';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useDriverModal } from '../../context/DriverModalContext';
import { useEmergency } from '../../context/EmergencyContext';
import { useReportIncidentModal } from '../../context/ReportIncidentModalContext';
import { deviceService } from '../../services/device.service';
import { passengerApi } from '../../api/passenger.api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { useDriverModel } from '@/context/DriverModelContext';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { useDriverData } from '@/context/DriverDataContext';
import { APP_CONSTANTS } from '../../utils/constants';
import { requestBackgroundLocationPermission } from '@/utils/permissions';
import { useFocusEffect } from '@react-navigation/native';


interface HomeScreenProps {
  navigation: any;
}

const GAUGE_MAX_WIDTH = 300;
const GAUGE_MIN_SIZE = 140;

const HOLD_DURATION_MS = 5000;

const DEFAULT_STOP_ID = '0';

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { driver, passengerCount, setPassengerCount, selectedRouteId, hasShownSupervisorModal, setHasShownSupervisorModal, vehicleId, apcCount, selectedRoute } = useAuth();
  const { open: openDriverModal } = useDriverModal();
  const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
  const { open: openReportIncidentModal } = useReportIncidentModal();
  const { width, height } = useWindowDimensions();
  const { minsLate, lastLocation, nextStop, schedule, setOnLocationXmit } = useDriverModel();
  const [isGpsFlashing, setIsGpsFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fareCategories, stops } = useDriverData();
  // console.log('stops======>>>>>>', nextStop);
  // console.log('fareCategories', fareCategories);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [isCharging, setIsCharging] = useState(true);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showPassengerInline, setShowPassengerInline] = useState(false);
  const [passengerCountModalVisible, setPassengerCountModalVisible] = useState(false);
  const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Numeric keypad modal
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const dynamicIconColor = isDarkMode ? '#000000' : '#ffffff';
  const [numpadVisible, setNumpadVisible] = useState(false);
  const [numpadMode, setNumpadMode] = useState<NumpadMode>('board');
  const isMobile = !((Platform.OS === 'ios' && Platform.isPad) || width >= 600);
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const isPortrait = height > width;
  const isLandscape = width > height;
  const centerGaugeVertically = isMobile || (isTablet && isPortrait);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [mdtId, setMdtId] = useState<string>('');
  const MDT_ID_KEY = '@driver_tracking:mdt_id';

  type Stop = {
    id: string | number;
    name: string;
    lat: number;
    lng: number;
  };

// useFocusEffect(
//   useCallback(() => {
//     requestBackgroundLocationPermission();

//     return () => {
//     };
//   }, [])
// );

  const deg2rad = (deg: number) => (deg * Math.PI) / 180;

  const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getNearestStopName = (stops: Stop[] | undefined, lastLocation: { latitude: number; longitude: number } | null) => {
    if (!stops || !stops.length || !lastLocation || selectedRoute === 'Out of Service') return '...';

    let best: { name: string; dist: number } | null = null;

    for (const stop of stops as any[]) {
      if (stop.lat == null || stop.lng == null) continue;
      const d = distanceMeters(
        lastLocation.latitude,
        lastLocation.longitude,
        stop.lat,
        stop.lng,
      );
      if (!best || d < best.dist) {
        best = { name: stop.name ?? stop.longName ?? String(stop.id), dist: d };
      }
    }

    return best ? best.name : '...';
  };

  const nextStopName = useMemo(
    () => {
      // 1. If we have a calculated next stop from the schedule tracking
      if (nextStop && selectedRouteId && selectedRouteId !== 'Out of Service') {
        return nextStop.longName;
      }

      // 2. Default fallback for empty schedule or unknown state
      return '...';
    },
    [nextStop, selectedRouteId],
  );

  // Responsive gauge size from device dimensions (no scroll: fit in viewport)
  const contentHeight = height - 128;
  const gaugeSize = useMemo(() => {
    const base = Math.min(
      width - 48,
      GAUGE_MAX_WIDTH,
      Math.max(GAUGE_MIN_SIZE, contentHeight - 230),
    );
    if (isLandscape) {
      return Math.min(Math.round(base * 1.15), width - 48, GAUGE_MAX_WIDTH);
    }
    return base;
  }, [width, contentHeight, isLandscape]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (driver?.role === 'supervisor' && !hasShownSupervisorModal) {
      setSupervisorModalVisible(true);
      setHasShownSupervisorModal(true);
    }
  }, [driver, hasShownSupervisorModal, setHasShownSupervisorModal]);

  useEffect(() => {
    deviceService.isCharging().then(setIsCharging);
    const removeListener = deviceService.addBatteryListener(({ charging }) => setIsCharging(charging));
    return removeListener;
  }, []);

  useEffect(() => {
    // Initial check
    deviceService.getVolume().then((volume) => {
      if (volume < APP_CONSTANTS.VOLUME_WARNING_THRESHOLD) {
        Toast.show({
          type: 'error',
          text1: 'Low Volume Warning',
          text2: `Volume is currently ${volume}%. Please increase for Alerts.`,
          visibilityTime: 4000,
        });
      }
    });

    // Listen for changes
    const removeVolumeListener = deviceService.addVolumeListener((volume) => {
      if (volume < APP_CONSTANTS.VOLUME_WARNING_THRESHOLD) {
        Toast.show({
          type: 'error',
          text1: 'Low Volume Warning',
          text2: `Volume is currently ${volume}%. Please increase for Alerts.`,
          visibilityTime: 4000,
        });
      }
    });

    return removeVolumeListener;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(MDT_ID_KEY);
        console.log('storedId', storedId);
        if (storedId) {
          setMdtId(storedId);
        } else {
          const uniqueId = await DeviceInfo.getUniqueId();
          const cleanId = uniqueId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          // Format as BPT-XXXXXXXX-XXXX-XXXX-XXXX
          const formattedId = `BPT-${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}`;
          setMdtId(formattedId);
        }
      } catch (error) {
        console.error('Error getting MDT ID:', error);
        // Fallback to random if device info fails
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = (len: number) =>
          Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        setMdtId(`BPT-${segment(8)}-${segment(4)}-${segment(4)}-${segment(4)}`);
      }
    })();
  }, []);

  useEffect(() => {
    if (mdtId) {
      AsyncStorage.setItem(MDT_ID_KEY, mdtId);
    }
  }, [mdtId]);

  useEffect(() => {
    setOnLocationXmit(() => {
      setIsGpsFlashing(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setIsGpsFlashing(false);
      }, 500);
    });
    return () => {
      setOnLocationXmit(null);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [setOnLocationXmit]);


  // const [isHighAccuracy, setIsHighAccuracy] = useState(false);

  // useEffect(() => {
  //   const checkAccuracy = () => {
  //     const accuracy = lastLocation?.accuracy ?? 999;
  //     // High accuracy: less than 30 meters
  //     setIsHighAccuracy(accuracy < 30);
  //   };

  //   // Check once immediately on location change
  //   checkAccuracy();
  // }, [lastLocation]);

  // Fetch passenger history when a route is selected and set count from tallies
  useEffect(() => {
    if (!selectedRouteId) return;
    let cancelled = false;
    passengerApi
      .getHistory(selectedRouteId)
      .then((tallies) => {
        if (cancelled) return;
        const count = tallies.reduce((sum, t) => sum + (t.passengersOn ?? 0) - (t.passengersOff ?? 0), 0);
        setPassengerCount(Math.max(0, count));
      })
      .catch(() => {
        // Keep current count on error (e.g. endpoint not available)
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRouteId, setPassengerCount]);

  const powerTrackingStatus = isCharging
    ? 'Auto/Tracking On'
    : 'No Power (Auto/Tracking On)';

  const handleEmergencyPressIn = () => {
    if (!emergencyActivated) return;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setShowReasonModal(true);
    }, HOLD_DURATION_MS);
  };

  const handleEmergencyPressOut = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleEmergencyPress = () => {
    if (!emergencyActivated) {
      activateEmergency();
    } else {
      handleEmergencyPressOut();
      openReportIncidentModal();
    }
  };

  const handleReasonSubmit = () => {
    deactivateEmergency(reasonText);
    setReasonText('');
    setShowReasonModal(false);
  };

  const handleReasonCancel = () => {
    setReasonText('');
    setShowReasonModal(false);
  };

  const togglePassengerInline = () => {
    setShowPassengerInline((prev) => !prev);
  };

  const openPassengerModal = () => {
    setShowPassengerInline(false);
    setShowPassengerModal(true);
  };


  const handleBoarding = (count = 1) => {
    const next = Math.min(999, passengerCount + count);
    setPassengerCount(next);
    // Call individual updatecount API
    if (vehicleId) {
      passengerApi.updateCount({
        agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
        vehicleID: vehicleId,
        count_in: count
      }).catch(e => console.log('Error updating Peak transit count', e));
    }
  };

  const handleAlighting = (count = 1) => {
    const next = Math.max(0, passengerCount - count);
    setPassengerCount(next);
    // Call individual updatecount API
    if (vehicleId) {
      passengerApi.updateCount({
        agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
        vehicleID: vehicleId,
        count_out: count
      }).catch(e => console.log('Error updating Peak transit count', e));
    }
  };

  const openNumpad = (mode: NumpadMode) => {
    setNumpadMode(mode);
    setNumpadVisible(true);
  };

  const handleNumpadConfirm = (count: number) => {
    if (numpadMode === 'board') {
      handleBoarding(count);
    } else {
      handleAlighting(count);
    }
  };


  // ---------------------------------------------------------------------------
  // Gauge image map
  // 0          → on_time.png
  // -9999      → no_status.png
  // > 0 (1-10) → {n}_early.png
  // < 0 (1-20) → {n}_late.png
  // ---------------------------------------------------------------------------
  const ON_TIME_IMAGE = require('../../assets/gauge/on_time.png');
  const NO_STATUS_IMAGE = require('../../assets/gauge/no_status.png');

  const EARLY_IMAGES: Record<number, any> = {
    1: require('../../assets/gauge/1_early.png'),
    2: require('../../assets/gauge/2_early.png'),
    3: require('../../assets/gauge/3_early.png'),
    4: require('../../assets/gauge/4_early.png'),
    5: require('../../assets/gauge/5_early.png'),
    6: require('../../assets/gauge/6_early.png'),
    7: require('../../assets/gauge/7_early.png'),
    8: require('../../assets/gauge/8_early.png'),
    9: require('../../assets/gauge/9_early.png'),
    10: require('../../assets/gauge/10_early.png'),
  };

  const LATE_IMAGES: Record<number, any> = {
    1: require('../../assets/gauge/1_late.png'),
    2: require('../../assets/gauge/2_late.png'),
    3: require('../../assets/gauge/3_late.png'),
    4: require('../../assets/gauge/4_late.png'),
    5: require('../../assets/gauge/5_late.png'),
    6: require('../../assets/gauge/6_late.png'),
    7: require('../../assets/gauge/7_late.png'),
    8: require('../../assets/gauge/8_late.png'),
    9: require('../../assets/gauge/9_late.png'),
    10: require('../../assets/gauge/10_late.png'),
    11: require('../../assets/gauge/11_late.png'),
    12: require('../../assets/gauge/12_late.png'),
    13: require('../../assets/gauge/13_late.png'),
    14: require('../../assets/gauge/14_late.png'),
    15: require('../../assets/gauge/15_late.png'),
    16: require('../../assets/gauge/16_late.png'),
    17: require('../../assets/gauge/17_late.png'),
    18: require('../../assets/gauge/18_late.png'),
    19: require('../../assets/gauge/19_late.png'),
    20: require('../../assets/gauge/20_late.png'),
  };

  /** Always returns a PNG source based on minsLate. */
  const getGaugeImage = (mins: number | null | undefined): any => {
    if (driver?.role === 'supervisor' || driver?.role === 'unassigned') {
      return NO_STATUS_IMAGE;
    }
    if (mins === null || mins === undefined) return NO_STATUS_IMAGE;
    if (mins && mins === -9999) return NO_STATUS_IMAGE;
    if (mins && mins === 0) return ON_TIME_IMAGE;
    if (mins && mins > 0) {
      // early — cap at max available (10)
      const key = Math.min(mins, 10);
      return EARLY_IMAGES[key] ?? ON_TIME_IMAGE;
    }
    // late — mins is negative, e.g. -3 → key 3, cap at 20
    const key = Math.min(Math.abs(mins), 20);
    return LATE_IMAGES[key] ?? ON_TIME_IMAGE;
  };

  const StatusGauge = () => {
    const size = gaugeSize;
    const gaugeImage = getGaugeImage(minsLate);
    const containerSize = isMobile  ? size -50: isTablet && isPortrait ? size :isTablet && isLandscape ? size - 600 :
 size + 380; 

    return (
      <View style={[styles.gaugeWrapper, { width: containerSize, height: containerSize, alignItems:'center', flex:1, justifyContent:'center',}]}>
        <Text style={styles.nextStopText}>{nextStopName}</Text>

        <Image
          source={gaugeImage}
          style={{ width: size + 60, height: size-20, resizeMode: 'contain' }}
        />
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={styles.contentContainer}
        onPress={() => {
          if (showPassengerInline) {
            setShowPassengerInline(false);
          }
        }}
      >
        <View
          style={[
            styles.centerSection,
            centerGaugeVertically && styles.centerSectionPhone,
          ]}
        >
          <Animated.View
            style={[
              styles.gaugeSection,
              centerGaugeVertically && styles.gaugeSectionPhone,
              { opacity: fadeAnim },
            ]}
          >
            <StatusGauge />
          </Animated.View>
        </View>

        <View style={[styles.mainButtonContainer, isPortrait && styles.mainButtonContainerPortrait]}>
          {driver?.role === 'supervisor' && (
            <TouchableOpacity
              style={styles.supervisorBlock}
              onPress={() => setSupervisorModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="account-tie"
                size={34}
                color={dynamicIconColor}
              />
              <Text style={styles.supervisorLabel}>Supervisor</Text>
            </TouchableOpacity>
          )}

          <View style={styles.passengerBlock}>
            <View style={styles.passengerInfoSection}>
              <MaterialIcons name="people" size={38} color="rgba(255,255,255,0.6)" />

              <Text style={styles.passengerCountText}>{passengerCount}</Text>



            </View>

            <View style={styles.passengerActions}>
              <View>
                {showPassengerInline && (
                  <View style={styles.passengerEditContainer}>
                    <View style={styles.passengerEditTopRow}>
                      <TouchableOpacity
                        style={styles.passengerEditBtn}
                        onPress={() => handleAlighting()}
                        onLongPress={() => openNumpad('alight')}
                        delayLongPress={600}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="person-remove" size={32} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.passengerEditBtn}
                        onPress={() => handleBoarding()}
                        onLongPress={() => openNumpad('board')}
                        delayLongPress={600}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="person-add-alt-1" size={32} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.passengerEditPointer} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.passengerActionBox}
                  onPress={togglePassengerInline}
                  activeOpacity={0.7}
                  disabled={!driver || driver.role === 'unassigned'}
                >
                  <MaterialCommunityIcons
                    name="account-edit"
                    size={34}
                    color={driver && driver.role !== 'unassigned' ? dynamicIconColor : 'rgba(255,255,255,0.4)'}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.passengerActionBox}
                onPress={openPassengerModal}
                activeOpacity={0.7}
                disabled={!driver || driver.role === 'unassigned'}
              >
                <MaterialIcons
                  name="confirmation-number"
                  size={34}
                  color={driver && driver.role !== 'unassigned' ? dynamicIconColor : 'rgba(255,255,255,0.4)'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SupervisorModal
          visible={supervisorModalVisible}
          onClose={() => setSupervisorModalVisible(false)}
        />
        {/* margin bottom style 25 */}
        {isPortrait && (
          <View style={[styles.gpsRowPortrait,{ bottom: isTablet ? 45 : 18,}]}>

            <View style={[styles.gpsDot, isGpsFlashing && styles.gpsDotFlashing]} />
            <Text style={[styles.gpsText, { fontSize: 13 }]}>{powerTrackingStatus}</Text>
          </View>
        )}

        {!isPortrait && (
          <View style={[styles.gpsRow, {bottom: isMobile && isLandscape ? 10 : 35, flex:isTablet ? 0.1 :0.2}]}>
            <View style={[styles.gpsDot, isGpsFlashing && styles.gpsDotFlashing]} />
            <Text style={styles.gpsText}>{powerTrackingStatus}</Text>
          </View>
        )}

        {/* {!isPortrait && (
          <View style={styles.gpsRow}>
            <GPSIndicator isHighAccuracy={isHighAccuracy} />
            <Text style={styles.gpsText}>{powerTrackingStatus}</Text>
          </View>
        )} */}

      </Pressable>

      <VehicleSelectModal
        visible={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
      />

      {/* ── Numeric Keypad Modal ─────────────────────────────────────────── */}
      <BulkPassengerNumpad
        visible={numpadVisible}
        mode={numpadMode}
        onConfirm={handleNumpadConfirm}
        onClose={() => setNumpadVisible(false)}
      />

      <PassengerCountModal
        visible={showPassengerModal}
        onClose={() => setShowPassengerModal(false)}
      // onSubmit={handlePassengerCountSubmit}
      />

      <Modal
        visible={showReasonModal}
        transparent
        animationType="fade"
        onRequestClose={handleReasonCancel}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
      >
        <Pressable style={[StyleSheet.absoluteFill, styles.reasonModalOverlay]} onPress={handleReasonCancel}>
          <Pressable style={styles.reasonModalContent} onPress={() => { }}>
            <Text style={styles.reasonModalTitle}>
              Reason for Clearing Emergency State
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Please input reason here"
              placeholderTextColor="#94A3B8"
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              numberOfLines={3}
            />
            <View style={styles.reasonModalButtons}>
              <TouchableOpacity
                style={[styles.reasonModalBtn, styles.reasonModalBtnCancel]}
                onPress={handleReasonCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.reasonModalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reasonModalBtn, styles.reasonModalBtnSubmit]}
                onPress={handleReasonSubmit}
                activeOpacity={0.7}
              >
                <Text style={styles.reasonModalBtnSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    paddingBottom: 24,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  centerSectionPhone: {
    justifyContent: 'center',
    paddingTop: 0,
  },
  timeDisplayCenter: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  emergencyBtnAbsolute: {
    position: 'absolute',
    top: 12,
    right: 24,
    zIndex: 10,
  },
  emergencyBtnAbsolutePhone: {
    top: 8,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3C',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 20,
    borderRadius: 28,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 20,
  },
  emergencyBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.emergency,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyBtnCircleActivated: {
    backgroundColor: '#EAB308',
  },
  emergencyBtnArrow: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  emergencyBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emergencyBtnActivated: {
    backgroundColor: '#4A4A4C',
  },
  emergencyBtnTextActivated: {
    color: '#FFFFFF',
  },
  reasonModalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reasonModalContent: {
    backgroundColor: '#252A32',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  reasonModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: '#1E2228',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reasonModalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  reasonModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  reasonModalBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reasonModalBtnSubmit: {
    backgroundColor: COLORS.primary,
  },
  reasonModalBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  reasonModalBtnSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  passengerEditContainer: {
    position: 'absolute',
    bottom: '105%',
    left: '50%',
    transform: [{ translateX: -55 }],
    marginBottom: 8,
    alignItems: 'center',
  },
  passengerEditTopRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.navBarBackground,
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  passengerEditPointer: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.navBarBackground,
  },
  passengerEditBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navBarBackground,
    padding: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.navBarIconDisabled,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  gaugeSection: {
    alignItems: 'center',
    marginTop: -45,
  },
  gaugeSectionPhone: {
    marginTop: 12,
  },
  gaugeWrapper: {
    alignItems: 'center',
  },
  gaugeArc: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gaugeCenter: {
    position: 'absolute',
    backgroundColor: COLORS.background,
  },
  gaugeLabelsBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 28,
  },
  gaugeLabelsBottomPositioned: {
    marginTop: 2,
  },
  gaugeLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  gaugeLabelLate: {},
  gaugeLabelOnTime: {
    textAlign: 'center',
    marginBottom: 0,
  },
  gaugeLabelEarly: {
    textAlign: 'right',
  },
  mainButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
  },
  mainButtonContainerPortrait: {
    bottom: 40,
  },
  supervisorBlock: {
    backgroundColor: COLORS.navBarBackground,
    paddingVertical: 10,
    paddingHorizontal:12,
    borderRadius: 5,
    alignItems: 'center',

  },
  supervisorLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '300',
  },
  passengerBlock: {
    backgroundColor: COLORS.navBarBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal:12,
    borderRadius: 5,
    gap: 16,

  },
  passengerInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerCountText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '300',
    minWidth: 30,
  },
  passengerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  passengerActionBox: {
    width: 68,
    height: 68,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',

  },
  statusBtn: {
    // flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navBarBackground,
    padding: 15,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  statusBtnDisabled: {
    opacity: 0.5,
  },
  statusBtnWithCount: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 0,
    elevation: 0
  },
  statusBtnCount: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    marginTop: -4,
    marginBottom: 16,
  },
  gpsRowPortrait: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight:10,
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
    opacity: 0.6,
  },
  gpsDotFlashing: {
    backgroundColor: '#4ADE80', // Brighter green
    opacity: 1,
    transform: [{ scale: 1.4 }],
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  gpsText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  quickActions: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3038',
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  menuIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    letterSpacing: 0.2,
  },
  nextStopText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 10
  },


});

export default HomeScreen;









/**
 * Home Screen - Driver Dashboard
 * Clean design for mobile
 */

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   TouchableOpacity,
//   Animated,
//   Pressable,
//   Modal,
//   TextInput,
//   Platform,
// } from 'react-native';
// import Svg, { Line, Circle } from 'react-native-svg';
// import GradientPath from 'react-native-svg-path-gradient';
// import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// import { useWindowDimensions } from 'react-native';
// import VehicleSelectModal from '../../components/VehicleSelectModal';
// import PassengerCountModal from '../../components/PassengerCountModal';
// import SupervisorModal from '../../components/SupervisorModal';
// import { COLORS } from '../../theme/colors';
// import { useAuth } from '../../context/AuthContext';
// import { useDriverModal } from '../../context/DriverModalContext';
// import { useEmergency } from '../../context/EmergencyContext';
// import { useReportIncidentModal } from '../../context/ReportIncidentModalContext';
// import { deviceService } from '../../services/device.service';
// import { passengerApi } from '../../api/passenger.api';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useDriverModel } from '@/context/DriverModelContext';


// interface HomeScreenProps {
//   navigation: any;
// }

// const GAUGE_MAX_WIDTH = 300;
// const GAUGE_MIN_SIZE = 140;

// const HOLD_DURATION_MS = 5000;

// const DEFAULT_STOP_ID = '0';

// const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
//   const { driver, passengerCount, setPassengerCount, selectedRouteId, hasShownSupervisorModal, setHasShownSupervisorModal, vehicleId, apcCount } = useAuth();

//   const { open: openDriverModal } = useDriverModal();
//   const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
//   const { open: openReportIncidentModal } = useReportIncidentModal();
//   const { width, height } = useWindowDimensions();
//   const { minsLate } = useDriverModel();
//   const [showReasonModal, setShowReasonModal] = useState(false);
//   const [reasonText, setReasonText] = useState('');
//   const [isCharging, setIsCharging] = useState(true);
//   const [showPassengerModal, setShowPassengerModal] = useState(false);
//   const [showPassengerInline, setShowPassengerInline] = useState(false);
//   const [passengerCountModalVisible, setPassengerCountModalVisible] = useState(false);
//   const [supervisorModalVisible, setSupervisorModalVisible] = useState(false);
//   const [showVehicleModal, setShowVehicleModal] = useState(false);
//   const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const isMobile = !((Platform.OS === 'ios' && Platform.isPad) || width >= 600);
//   const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
//   const isPortrait = height > width;



//   // Fetch passenger history when a route is selected and set count from tallies
//   useEffect(() => {
//     if (!selectedRouteId) return;
//     let cancelled = false;
//     passengerApi
//       .getHistory(selectedRouteId)
//       .then((tallies) => {
//         if (cancelled) return;
//         const count = tallies.reduce((sum, t) => sum + (t.passengersOn ?? 0) - (t.passengersOff ?? 0), 0);
//         setPassengerCount(Math.max(0, count));
//       })
//       .catch(() => {
//         // Keep current count on error (e.g. endpoint not available)
//       });
//     return () => {
//       cancelled = true;
//     };
//   }, [selectedRouteId, setPassengerCount]);

//   const powerTrackingStatus = isCharging
//     ? 'Auto/Tracking On'
//     : 'No Power (Auto/Tracking On)';

//   const handleEmergencyPressIn = () => {
//     if (!emergencyActivated) return;
//     holdTimerRef.current = setTimeout(() => {
//       holdTimerRef.current = null;
//       setShowReasonModal(true);
//     }, HOLD_DURATION_MS);
//   };

//   const handleEmergencyPressOut = () => {
//     if (holdTimerRef.current) {
//       clearTimeout(holdTimerRef.current);
//       holdTimerRef.current = null;
//     }
//   };

//   const handleEmergencyPress = () => {
//     if (!emergencyActivated) {
//       activateEmergency();
//     } else {
//       handleEmergencyPressOut();
//       openReportIncidentModal();
//     }
//   };

//   const handleReasonSubmit = () => {
//     deactivateEmergency(reasonText);
//     setReasonText('');
//     setShowReasonModal(false);
//   };

//   const handleReasonCancel = () => {
//     setReasonText('');
//     setShowReasonModal(false);
//   };

//   const togglePassengerInline = () => {
//     setShowPassengerInline((prev) => !prev);
//   };

//   const openPassengerModal = () => {
//     setShowPassengerInline(false);
//     setShowPassengerModal(true);
//   };

//   const handlePassengerCountSubmit = (embarking: number, disembarking: number) => {
//     const next = Math.max(0, passengerCount + embarking - disembarking);
//     setPassengerCount(next);
//     if (selectedRouteId) {
//       if (embarking > 0) {
//         passengerApi
//           .submitTally({
//             routeId: selectedRouteId,
//             stopId: DEFAULT_STOP_ID,
//             passengersOn: embarking,
//             passengersOff: 0,
//             fareType: 'full',
//             fareAmount: 0,
//             timestamp: new Date().toISOString(),
//           })
//           .catch((e) => {
//             console.log('Error submitting passenger count', e);
//           });
//       }
//       if (disembarking > 0) {
//         passengerApi
//           .submitTally({
//             routeId: selectedRouteId,
//             stopId: DEFAULT_STOP_ID,
//             passengersOn: 0,
//             passengersOff: disembarking,
//             fareType: 'full',
//             fareAmount: 0,
//             timestamp: new Date().toISOString(),
//           })
//           .catch((e) => {
//             console.log('Error submitting passenger count', e);
//           });
//       }
//     }

//     // Call individual updatecount API
//     if (vehicleId) {
//       passengerApi.updateCount({
//         agencyID: '121',
//         vehicleID: vehicleId,
//         count_in: embarking > 0 ? embarking : undefined,
//         count_out: disembarking > 0 ? disembarking : undefined,
//       }).catch(e => console.log('Error updating Peak transit count', e));
//     }
//   };

//   const handleBoarding = () => {
//     const next = Math.min(999, passengerCount + 1);
//     setPassengerCount(next);
//     // if (selectedRouteId) {
//     //   passengerApi
//     //     .submitTally({
//     //       routeId: selectedRouteId,
//     //       stopId: DEFAULT_STOP_ID,
//     //       passengersOn: 1,
//     //       passengersOff: 0,
//     //       fareType: 'full',
//     //       fareAmount: 0,
//     //       timestamp: new Date().toISOString(),
//     //     })
//     //     .catch((e) => {
//     //       console.log('Error submitting passenger count', e);
//     //     });
//     // }

//     // Call individual updatecount API
//     if (vehicleId) {
//       passengerApi.updateCount({
//         agencyID: '121',
//         vehicleID: vehicleId,
//         count_in: 1
//       }).catch(e => console.log('Error updating Peak transit count', e));
//     }
//   };

//   const handleAlighting = () => {
//     const next = Math.max(0, passengerCount - 1);
//     setPassengerCount(next);
//     // if (selectedRouteId) {
//     //   passengerApi
//     //     .submitTally({
//     //       routeId: selectedRouteId,
//     //       stopId: DEFAULT_STOP_ID,
//     //       passengersOn: 0,
//     //       passengersOff: 1,
//     //       fareType: 'full',
//     //       fareAmount: 0,
//     //       timestamp: new Date().toISOString(),
//     //     })
//     //     .catch((e) => {
//     //       console.log('Error submitting passenger count', e);
//     //     });
//     // }

//     // Call individual updatecount API
//     if (vehicleId) {
//       passengerApi.updateCount({
//         agencyID: '121',
//         vehicleID: vehicleId,
//         count_out: 1
//       }).catch(e => console.log('Error updating Peak transit count', e));
//     }
//   };

//   const menuItems = [
//     { title: 'Route Selection', screen: 'RouteSelection', icon: '🚌', color: COLORS.accentBlue },
//     { title: 'Map', screen: 'Map', icon: '🗺️', color: COLORS.primary },
//     { title: 'Pre-Trip Inspection', screen: 'PreTrip', icon: '✅', color: COLORS.emergency },
//     { title: 'Post-Trip Inspection', screen: 'PostTrip', icon: '📋', color: COLORS.accentOrange },
//     { title: 'Passenger Fare', screen: 'PassengerFare', icon: '💰', color: '#9B59B6' },
//     { title: 'Messaging', screen: 'Messaging', icon: '💬', color: COLORS.accentBlue },
//     { title: 'Settings', screen: 'Settings', icon: '⚙️', color: COLORS.textMuted },
//   ];

//   const StatusGauge = () => {
//     const size = gaugeSize;
//     const cx = size / 2;
//     const cy = size / 2;
//     // ss2: Thick arc, ~270° open at bottom, smooth gradient
//     const arcStrokeWidth = 40;
//     const radius = size / 2 - arcStrokeWidth / 2 - 6;
//     const innerArcRadius = radius - arcStrokeWidth / 2; // inner edge of gradient
//     const innerCircleRadius = innerArcRadius - 18; // inner dark gray circle
//     const tickCount = 52;
//     // ~270° arc, gap at bottom (72° to 108°)
//     const startAngle = 108;
//     const endAngle = 72;
//     const arcSpan = 324;
//     const startRad = (startAngle * Math.PI) / 180;
//     const endRad = (endAngle * Math.PI) / 180;
//     const startX = cx + radius * Math.cos(startRad);
//     const startY = cy + radius * Math.sin(startRad);
//     const endX = cx + radius * Math.cos(endRad);
//     const endY = cy + radius * Math.sin(endRad);
//     const arcPath = `M ${startX},${startY} A ${radius},${radius} 0 1 1 ${endX},${endY}`;
//     return (
//       <View style={[styles.gaugeWrapper, { width: size, height: size + 44 }]}>
//         <Text style={[styles.gaugeLabel, styles.gaugeLabelOnTime]}>On Time</Text>
//         <View style={[styles.gaugeArc, { width: size, height: size }]}>
//           <Svg width={size} height={size} style={styles.gaugeSvg}>
//             {/* ss2: Thick gradient arc - smooth transition */}
//             <GradientPath
//               d={arcPath}
//               colors={COLORS.gaugeGradient}
//               strokeWidth={arcStrokeWidth}
//               precision={15}
//             />
//             {/* ss2: Inner dark gray circle - thinner band inside gradient */}
//             <Circle
//               cx={cx}
//               cy={cy}
//               r={innerCircleRadius}
//               fill="#374151"
//               stroke="none"
//             />
//             {/* ss2: Radial lines from outer edge of inner circle to inner edge of gradient */}
//             {Array.from({ length: tickCount }).map((_, i) => {
//               const t = i / (tickCount - 1);
//               const angle = (startAngle + t * arcSpan) % 360;
//               const rad = (angle * Math.PI) / 180;
//               const x1 = cx + innerCircleRadius * Math.cos(rad);
//               const y1 = cy + innerCircleRadius * Math.sin(rad);
//               const x2 = cx + innerArcRadius * Math.cos(rad);
//               const y2 = cy + innerArcRadius * Math.sin(rad);
//               return (
//                 <Line
//                   key={`tick-${i}`}
//                   x1={x1}
//                   y1={y1}
//                   x2={x2}
//                   y2={y2}
//                   stroke="#4B5563"
//                   strokeWidth={1}
//                   strokeLinecap="round"
//                 />
//               );
//             })}
//           </Svg>
//         </View>
//         <View style={[styles.gaugeLabelsBottom, styles.gaugeLabelsBottomPositioned]}>
//           <Text style={[styles.gaugeLabel, styles.gaugeLabelLate]}>Late</Text>
//           <Text style={[styles.gaugeLabel, styles.gaugeLabelEarly]}>Early</Text>
//         </View>
//       </View>
//     );
//   };

//   return (
//     <>
//       <Pressable
//         style={styles.contentContainer}
//         onPress={() => {
//           if (showPassengerInline) {
//             setShowPassengerInline(false);
//           }
//         }}
//       >
//         <View
//           style={[
//             styles.centerSection,
//             centerGaugeVertically && styles.centerSectionPhone,
//           ]}
//         >
//           <Animated.View
//             style={[
//               styles.gaugeSection,
//               centerGaugeVertically && styles.gaugeSectionPhone,
//               { opacity: fadeAnim },
//             ]}
//           >
//             <StatusGauge />
//           </Animated.View>
//         </View>

//         <View style={[styles.mainButtonContainer, isPortrait && styles.mainButtonContainerPortrait]}>
//           {driver?.role === 'supervisor' && (
//             <TouchableOpacity
//               style={styles.supervisorBlock}
//               onPress={() => setSupervisorModalVisible(true)}
//               activeOpacity={0.7}
//             >
//               <MaterialCommunityIcons
//                 name="account-tie"
//                 size={34}
//                 color="#000"
//               />
//               <Text style={styles.supervisorLabel}>Supervisor</Text>
//             </TouchableOpacity>
//           )}

//           <View style={styles.passengerBlock}>
//             <View style={styles.passengerInfoSection}>
//               <MaterialIcons name="people" size={38} color="rgba(255,255,255,0.6)" />

//               <Text style={styles.passengerCountText}>{passengerCount}</Text>



//             </View>

//             <View style={styles.passengerActions}>
//               <View>
//                 {showPassengerInline && (
//                   <View style={styles.passengerEditContainer}>
//                     <View style={styles.passengerEditTopRow}>
//                       <TouchableOpacity
//                         style={styles.passengerEditBtn}
//                         onPress={handleAlighting}
//                         activeOpacity={0.7}
//                       >
//                         <MaterialIcons name="person-remove" size={32} color="#FFFFFF" />
//                       </TouchableOpacity>
//                       <TouchableOpacity
//                         style={styles.passengerEditBtn}
//                         onPress={handleBoarding}
//                         activeOpacity={0.7}
//                       >
//                         <MaterialIcons name="person-add-alt-1" size={32} color="#FFFFFF" />
//                       </TouchableOpacity>
//                     </View>
//                     <View style={styles.passengerEditPointer} />
//                   </View>
//                 )}
//                 <TouchableOpacity
//                   style={styles.passengerActionBox}
//                   onPress={togglePassengerInline}
//                   activeOpacity={0.7}
//                   disabled={!driver || driver.role === 'unassigned'}
//                 >
//                   <MaterialCommunityIcons
//                     name="account-edit"
//                     size={34}
//                     color={driver && driver.role !== 'unassigned' ? '#000' : 'rgba(255,255,255,0.4)'}
//                   />
//                 </TouchableOpacity>
//               </View>

//               <TouchableOpacity
//                 style={styles.passengerActionBox}
//                 onPress={openPassengerModal}
//                 activeOpacity={0.7}
//                 disabled={!driver || driver.role === 'unassigned'}
//               >
//                 <MaterialIcons
//                   name="confirmation-number"
//                   size={34}
//                   color={driver && driver.role !== 'unassigned' ? '#000' : 'rgba(255,255,255,0.4)'}
//                 />
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>

//         <SupervisorModal
//           visible={supervisorModalVisible}
//           onClose={() => setSupervisorModalVisible(false)}
//         />
//         {/* margin bottom style 25 */}
//         {isPortrait && (
//           <View style={styles.gpsRowPortrait}>

//             <View style={styles.gpsDot} />
//             <Text style={[styles.gpsText, { fontSize: 13 }]}>{powerTrackingStatus}</Text>
//           </View>
//         )}

//         {!isPortrait && (
//           <View style={styles.gpsRow}>
//             <View style={styles.gpsDot} />
//             <Text style={styles.gpsText}>{powerTrackingStatus}</Text>
//           </View>
//         )}

//         {/* Quick Actions - commented out
//         <Animated.View style={[styles.quickActions, { opacity: fadeAnim }]}>
//           <Text style={styles.sectionTitle}>Quick Actions</Text>
//           <View style={styles.menuGrid}>
//             {menuItems.map((item, i) => (
//               <TouchableOpacity
//                 key={i}
//                 style={[styles.menuCard, { borderLeftColor: item.color }]}
//                 onPress={() => navigation.navigate(item.screen)}
//                 activeOpacity={0.7}
//               >
//                 <Text style={styles.menuIcon}>{item.icon}</Text>
//                 <Text style={styles.menuTitle}>{item.title}</Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </Animated.View>
//         */}
//       </Pressable>

//       <VehicleSelectModal
//         visible={showVehicleModal}
//         onClose={() => setShowVehicleModal(false)}
//       />

//       <PassengerCountModal
//         visible={showPassengerModal}
//         onClose={() => setShowPassengerModal(false)}
//         onSubmit={handlePassengerCountSubmit}
//       />

//       <Modal
//         visible={showReasonModal}
//         transparent
//         animationType="fade"
//         onRequestClose={handleReasonCancel}
//         presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
//         supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
//       >
//         <Pressable style={[StyleSheet.absoluteFill, styles.reasonModalOverlay]} onPress={handleReasonCancel}>
//           <Pressable style={styles.reasonModalContent} onPress={() => { }}>
//             <Text style={styles.reasonModalTitle}>
//               Reason for Clearing Emergency State
//             </Text>
//             <TextInput
//               style={styles.reasonInput}
//               placeholder="Please input reason here"
//               placeholderTextColor="#94A3B8"
//               value={reasonText}
//               onChangeText={setReasonText}
//               multiline
//               numberOfLines={3}
//             />
//             <View style={styles.reasonModalButtons}>
//               <TouchableOpacity
//                 style={[styles.reasonModalBtn, styles.reasonModalBtnCancel]}
//                 onPress={handleReasonCancel}
//                 activeOpacity={0.7}
//               >
//                 <Text style={styles.reasonModalBtnCancelText}>Cancel</Text>
//               </TouchableOpacity>
//               <TouchableOpacity
//                 style={[styles.reasonModalBtn, styles.reasonModalBtnSubmit]}
//                 onPress={handleReasonSubmit}
//                 activeOpacity={0.7}
//               >
//                 <Text style={styles.reasonModalBtnSubmitText}>Submit</Text>
//               </TouchableOpacity>
//             </View>
//           </Pressable>
//         </Pressable>
//       </Modal>

//     </>
//   );
// };

// const styles = StyleSheet.create({
//   contentContainer: {
//     flex: 1,
//     paddingBottom: 24,
//   },
//   centerSection: {
//     flex: 1,
//     justifyContent: 'flex-start',
//     alignItems: 'center',
//     paddingHorizontal: 24,
//     paddingTop: 8,
//   },
//   centerSectionPhone: {
//     justifyContent: 'center',
//     paddingTop: 0,
//   },
//   timeDisplayCenter: {
//     fontSize: 28,
//     fontWeight: '600',
//     color: COLORS.textPrimary,
//     letterSpacing: 0.5,
//     textAlign: 'center',
//     marginBottom: 14,
//   },
//   emergencyBtnAbsolute: {
//     position: 'absolute',
//     top: 12,
//     right: 24,
//     zIndex: 10,
//   },
//   emergencyBtnAbsolutePhone: {
//     top: 8,
//   },
//   emergencyBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#3A3A3C',
//     paddingVertical: 6,
//     paddingLeft: 6,
//     paddingRight: 20,
//     borderRadius: 28,
//     gap: 12,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.08)',
//     marginTop: 20,
//   },
//   emergencyBtnCircle: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: COLORS.emergency,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   emergencyBtnCircleActivated: {
//     backgroundColor: '#EAB308',
//   },
//   emergencyBtnArrow: {
//     color: '#FFF',
//     fontSize: 20,
//     fontWeight: 'bold',
//     alignSelf: 'center',
//   },
//   emergencyBtnText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#FFFFFF',
//   },
//   emergencyBtnActivated: {
//     backgroundColor: '#4A4A4C',
//   },
//   emergencyBtnTextActivated: {
//     color: '#FFFFFF',
//   },
//   reasonModalOverlay: {
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 24,
//   },
//   reasonModalContent: {
//     backgroundColor: '#252A32',
//     borderRadius: 16,
//     padding: 24,
//     width: '100%',
//     maxWidth: 360,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.08)',
//   },
//   reasonModalTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#FFFFFF',
//     marginBottom: 16,
//   },
//   reasonInput: {
//     backgroundColor: '#1E2228',
//     borderRadius: 12,
//     padding: 16,
//     fontSize: 16,
//     color: '#FFFFFF',
//     marginBottom: 24,
//     minHeight: 100,
//     textAlignVertical: 'top',
//   },
//   reasonModalButtons: {
//     flexDirection: 'row',
//     gap: 12,
//     justifyContent: 'flex-end',
//   },
//   reasonModalBtn: {
//     paddingVertical: 12,
//     paddingHorizontal: 24,
//     borderRadius: 10,
//   },
//   reasonModalBtnCancel: {
//     backgroundColor: 'rgba(255,255,255,0.1)',
//   },
//   reasonModalBtnSubmit: {
//     backgroundColor: COLORS.primary,
//   },
//   reasonModalBtnCancelText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: 'rgba(255,255,255,0.9)',
//   },
//   reasonModalBtnSubmitText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#1E293B',
//   },
//   passengerEditContainer: {
//     position: 'absolute',
//     bottom: '105%',
//     left: '50%',
//     transform: [{ translateX: -55 }],
//     marginBottom: 8,
//     alignItems: 'center',
//   },
//   passengerEditTopRow: {
//     flexDirection: 'row',
//     gap: 8,
//     backgroundColor: COLORS.navBarBackground,
//     padding: 5,
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.08)',
//   },
//   passengerEditPointer: {
//     width: 0,
//     height: 0,
//     marginTop: -1,
//     borderLeftWidth: 10,
//     borderRightWidth: 10,
//     borderTopWidth: 10,
//     borderLeftColor: 'transparent',
//     borderRightColor: 'transparent',
//     borderTopColor: COLORS.navBarBackground,
//   },
//   passengerEditBtn: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.navBarBackground,
//     padding: 18,
//     borderRadius: 5,
//     borderWidth: 1.5,
//     borderColor: COLORS.navBarIconDisabled,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.18,
//     shadowRadius: 6,
//     elevation: 4,
//   },
//   gaugeSection: {
//     alignItems: 'center',
//     marginTop: -4,
//     marginBottom: 16,
//   },
//   gaugeSectionPhone: {
//     marginTop: 12,
//   },
//   gaugeWrapper: {
//     alignItems: 'center',
//   },
//   gaugeArc: {
//     overflow: 'hidden',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   gaugeSvg: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//   },
//   gaugeCenter: {
//     position: 'absolute',
//     backgroundColor: COLORS.background,
//   },
//   gaugeLabelsBottom: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     width: '100%',
//     paddingHorizontal: 28,
//   },
//   gaugeLabelsBottomPositioned: {
//     marginTop: 2,
//   },
//   gaugeLabel: {
//     fontSize: 14,
//     color: '#FFFFFF',
//     fontWeight: '600',
//     letterSpacing: 0.2,
//   },
//   gaugeLabelLate: {},
//   gaugeLabelOnTime: {
//     textAlign: 'center',
//     marginBottom: 0,
//   },
//   gaugeLabelEarly: {
//     textAlign: 'right',
//   },
//   mainButtonContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 12,
//     position: 'absolute',
//     bottom: -8,
//     alignSelf: 'center',
//   },
//   mainButtonContainerPortrait: {
//     bottom: 40,
//   },
//   supervisorBlock: {
//     backgroundColor: COLORS.navBarBackground,
//     paddingHorizontal: 10,
//     paddingVertical: 14,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   supervisorLabel: {
//     color: '#FFF',
//     fontSize: 16,
//     fontWeight: '300',
//   },
//   passengerBlock: {
//     backgroundColor: COLORS.navBarBackground,
//     flexDirection: 'row',
//     alignItems: 'center',
//     padding: 8,
//     paddingLeft: 16,
//     borderRadius: 8,
//     gap: 16,
//   },
//   passengerInfoSection: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 12,
//   },
//   passengerCountText: {
//     color: '#FFF',
//     fontSize: 32,
//     fontWeight: '300',
//     minWidth: 30,
//   },
//   passengerActions: {
//     flexDirection: 'row',
//     gap: 8,
//   },
//   passengerActionBox: {
//     width: 68,
//     height: 68,
//     borderWidth: 1,
//     borderColor: 'rgba(0,0,0,0.6)',
//     borderRadius: 6,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   statusBtn: {
//     // flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: COLORS.navBarBackground,
//     padding: 15,
//     borderRadius: 5,
//     borderWidth: 1.5,
//     borderColor: '#000',
//   },
//   statusBtnDisabled: {
//     opacity: 0.5,
//   },
//   statusBtnWithCount: {
//     flexDirection: 'row',
//     gap: 10,
//     borderWidth: 0,
//     elevation: 0
//   },
//   statusBtnCount: {
//     fontSize: 22,
//     color: '#FFFFFF',
//     fontWeight: '600',
//   },
//   gpsRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'flex-end',
//     paddingHorizontal: 24,
//     marginTop: -4,
//     marginBottom: 16,
//   },
//   gpsRowPortrait: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'flex-end',
//     paddingHorizontal: 24,
//     position: 'absolute',
//     bottom: 18,
//     left: 0,
//     right: 0,
//   },
//   gpsDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: COLORS.primary,
//     marginRight: 8,
//   },
//   gpsText: {
//     fontSize: 15,
//     color: '#FFFFFF',
//     fontWeight: '500',
//   },
//   quickActions: {
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: COLORS.textPrimary,
//     marginBottom: 16,
//     letterSpacing: 0.3,
//   },
//   menuGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'space-between',
//   },
//   menuCard: {
//     width: '48%',
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#2A3038',
//     padding: 18,
//     borderRadius: 14,
//     marginBottom: 14,
//     borderLeftWidth: 4,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.06)',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 6,
//     elevation: 4,
//   },
//   menuIcon: {
//     fontSize: 26,
//     marginRight: 14,
//   },
//   menuTitle: {
//     fontSize: 15,
//     fontWeight: '600',
//     color: COLORS.textPrimary,
//     flex: 1,
//     letterSpacing: 0.2,
//   },
// });

// export default HomeScreen;
