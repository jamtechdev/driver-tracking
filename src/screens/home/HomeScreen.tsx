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
import { useSafeAreaInsets } from 'react-native-safe-area-context';


interface HomeScreenProps {
  navigation: any;
}

const GAUGE_MAX_WIDTH = 300;
const GAUGE_MIN_SIZE = 140;

const HOLD_DURATION_MS = 5000;

const DEFAULT_STOP_ID = '0';

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
const getGaugeImage = (mins: number | null | undefined, role?: string): any => {
  if (role === 'supervisor' || role === 'unassigned') {
    return NO_STATUS_IMAGE;
  }
  if (mins === null || mins === undefined) return NO_STATUS_IMAGE;
  if (mins === -9999) return NO_STATUS_IMAGE;
  if (mins === 0) return ON_TIME_IMAGE;
  if (mins > 0) {
    // early — cap at max available (10)
    const key = Math.min(mins, 10);
    return EARLY_IMAGES[key] ?? ON_TIME_IMAGE;
  }
  // late — mins is negative, e.g. -3 → key 3, cap at 20
  const key = Math.min(Math.abs(mins), 20);
  return LATE_IMAGES[key] ?? ON_TIME_IMAGE;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { driver, passengerCount, setPassengerCount, selectedRouteId, hasShownSupervisorModal, setHasShownSupervisorModal, vehicleId, apcCount, selectedRoute } = useAuth();
  const { open: openDriverModal } = useDriverModal();
  const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
  const { open: openReportIncidentModal } = useReportIncidentModal();
  const { width, height } = useWindowDimensions();
  const { minsLate, lastLocation, nextStop, schedule, setOnLocationXmit } = useDriverModel();
  // console.log('nextStop======>>>>>>', nextStop);
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
  const isMobile = Math.min(width, height) < 600;
  const isTablet = !isMobile;
  const isPortrait = height > width;
  const isLandscape = width > height;
  const centerGaugeVertically = isMobile || (isTablet && isPortrait);
  const insets = useSafeAreaInsets();
  // Responsive UI Scaling
  const rs = Math.min(width, height) / 400;
  const actionBoxSize = Math.round((isLandscape ? 50 : 68) * Math.max(0.7, Math.min(1.2, rs)));
  const actionIconSize = Math.round((isLandscape ? 28 : 34) * Math.max(0.7, Math.min(1.2, rs)));
  const editBtnPadding = Math.round((isLandscape ? 12 : 15) * Math.max(0.8, Math.min(1.2, rs)));
  const editIconSize = Math.round((isLandscape ? 24 : 28) * Math.max(0.8, Math.min(1.2, rs)));
  const countFontSize = Math.round((isLandscape ? 28 : 32) * Math.max(0.8, Math.min(1.2, rs)));
  const peopleIconSize = Math.round((isLandscape ? 30 : 38) * Math.max(0.8, Math.min(1.2, rs)));
  const editContainerTranslateX = -Math.round((isLandscape ? 45 : 55) * Math.max(0.8, Math.min(1.2, rs)));
  const supervisorLabelFontSize = Math.round(14 * Math.max(0.8, rs));
  const passengerBlockPaddingV = isLandscape ? (isMobile ? 5 : 8) : 8;
  const passengerBlockPaddingH = Math.round(12 * rs);
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
    // In landscape on small devices, we need a smaller gauge to fit between header and footer
    const maxH = isLandscape ? height * 0.45 : contentHeight - 200;
    const base = Math.min(
      width - 100,
      GAUGE_MAX_WIDTH,
      Math.max(GAUGE_MIN_SIZE, maxH)
    );
    return base;
  }, [width, height, contentHeight, isLandscape]);

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

  const gaugeImage = useMemo(() => getGaugeImage(minsLate, driver?.role), [minsLate, driver?.role]);
  const containerSize = isLandscape ? gaugeSize : gaugeSize + 40;

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
            <View style={[styles.gaugeWrapper, { width: containerSize, height: containerSize, alignItems: 'center', flex: 1, justifyContent: 'center', }]}>
              <Text style={styles.nextStopText}>{nextStopName}</Text>
              <Image
                source={gaugeImage}
                style={{ width: gaugeSize + 40, height: gaugeSize, resizeMode: 'contain' }}
              />
            </View>
          </Animated.View>
        </View>

        <View style={[styles.mainButtonContainer, { bottom: isPortrait ? insets.bottom + 40 : insets.bottom - 18 }]}>
          {driver?.role === 'supervisor' && (
            <TouchableOpacity
              style={[styles.supervisorBlock, { paddingHorizontal: passengerBlockPaddingH, paddingVertical: passengerBlockPaddingV }]}
              onPress={() => setSupervisorModalVisible(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="account-tie"
                size={actionIconSize}
                color={dynamicIconColor}
              />
              <Text style={[styles.supervisorLabel, { fontSize: supervisorLabelFontSize }]}>Supervisor</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.passengerBlock, { paddingHorizontal: passengerBlockPaddingH, paddingVertical: passengerBlockPaddingV, minHeight: actionBoxSize + (passengerBlockPaddingV * 2) }]}>
            <View style={styles.passengerInfoSection}>
              <MaterialIcons name="people" size={peopleIconSize} color="rgba(255,255,255,0.6)" />

              <Text style={[styles.passengerCountText, { fontSize: countFontSize }]}>{passengerCount}</Text>
            </View>

            <View style={[styles.passengerActions]}>
              <View>
                {showPassengerInline && (
                  <View style={[styles.passengerEditContainer, { transform: [{ translateX: editContainerTranslateX }] }]}>
                    <View style={styles.passengerEditTopRow}>
                      <TouchableOpacity
                        style={[styles.passengerEditBtn, { padding: editBtnPadding }]}
                        onPress={() => handleAlighting()}
                        onLongPress={() => openNumpad('alight')}
                        delayLongPress={600}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="person-remove" size={editIconSize} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.passengerEditBtn, { padding: editBtnPadding }]}
                        onPress={() => handleBoarding()}
                        onLongPress={() => openNumpad('board')}
                        delayLongPress={600}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="person-add-alt-1" size={editIconSize} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.passengerEditPointer} />
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.passengerActionBox, { width: actionBoxSize, height: actionBoxSize, }]}
                  onPress={togglePassengerInline}
                  activeOpacity={0.7}
                  disabled={!driver || driver.role === 'unassigned'}
                >
                  <MaterialCommunityIcons
                    name="account-edit"
                    size={actionIconSize}
                    color={driver && driver.role !== 'unassigned' ? dynamicIconColor : 'rgba(255,255,255,0.4)'}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.passengerActionBox, { width: actionBoxSize, height: actionBoxSize }]}
                onPress={openPassengerModal}
                activeOpacity={0.7}
                disabled={!driver || driver.role === 'unassigned'}
              >
                <MaterialIcons
                  name="confirmation-number"
                  size={actionIconSize}
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
          <View style={[styles.gpsRowPortrait, { bottom: isTablet ? 20 : 18, paddingBottom: insets.bottom }]}>

            <View style={[styles.gpsDot, isGpsFlashing && styles.gpsDotFlashing]} />
            <Text style={[styles.gpsText, { fontSize: 13 }]}>{powerTrackingStatus}</Text>
          </View>
        )}

        {!isPortrait && (
          <View style={[styles.gpsRow, { bottom: isMobile && isLandscape ? insets.bottom : insets.bottom + 8, flex: isTablet ? 0.1 : 0.2, paddingRight: 0, marginRight: Platform.OS === 'ios' ? insets.right : 0 }]}>
            {/* <View style={[styles.gpsRow, { bottom: isMobile && isLandscape ? insets.bottom : insets.bottom, flex: isTablet ? 0.1 : 0.2 }]}></View> */}
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
    marginTop: 0,
  },
  gaugeSectionPhone: {
    marginTop: 0,
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
    bottom: -7,
    alignSelf: 'center',
    padding: 5,
    alignContent: 'center'
  },
  mainButtonContainerPortrait: {
    bottom: 50,
  },
  supervisorBlock: {
    backgroundColor: COLORS.navBarBackground,
    // paddingVertical: 10,
    // paddingHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',


  },
  supervisorLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '300',
  },
  passengerBlock: {
    backgroundColor: COLORS.navBarBackground,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
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
    marginRight: 10,
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
    fontSize: 14,
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
