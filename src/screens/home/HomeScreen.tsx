/**
 * Home Screen - Driver Dashboard
 * Clean design for mobile
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import GradientPath from 'react-native-svg-path-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWindowDimensions } from 'react-native';
import MainLayout from '../../components/MainLayout';
import VehicleSelectModal from '../../components/VehicleSelectModal';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useDriverModal } from '../../context/DriverModalContext';
import { useEmergency } from '../../context/EmergencyContext';
import { useReportIncidentModal } from '../../context/ReportIncidentModalContext';
import { deviceService } from '../../services/device.service';
import { passengerApi } from '../../api/passenger.api';

interface HomeScreenProps {
  navigation: any;
}

const GAUGE_MAX_WIDTH = 300;
const GAUGE_MIN_SIZE = 140;

const HOLD_DURATION_MS = 5000;

const DEFAULT_STOP_ID = '0';

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { driver, passengerCount, setPassengerCount, selectedRouteId } = useAuth();
  const { open: openDriverModal } = useDriverModal();
  const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
  const { open: openReportIncidentModal } = useReportIncidentModal();
  const { width, height } = useWindowDimensions();
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const [isCharging, setIsCharging] = useState(true);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = !((Platform.OS === 'ios' && Platform.isPad) || width >= 600);
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const isPortrait = height > width;
  const isLandscape = width > height;
  const centerGaugeVertically = isMobile || (isTablet && isPortrait);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Responsive gauge size from device dimensions (no scroll: fit in viewport)
  const contentHeight = height - 128;
  const gaugeSize = useMemo(() => {
    const base = Math.min(
      width - 48,
      GAUGE_MAX_WIDTH,
      Math.max(GAUGE_MIN_SIZE, contentHeight - 210),
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
    deviceService.isCharging().then(setIsCharging);
    const removeListener = deviceService.addBatteryListener(({ charging }) => setIsCharging(charging));
    return removeListener;
  }, []);

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

  const handleBoarding = () => {
    const next = Math.min(999, passengerCount + 1);
    setPassengerCount(next);
    if (selectedRouteId) {
      passengerApi
        .submitTally({
          routeId: selectedRouteId,
          stopId: DEFAULT_STOP_ID,
          passengersOn: 1,
          passengersOff: 0,
          fareType: 'full',
          fareAmount: 0,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});
    }
  };

  const handleAlighting = () => {
    const next = Math.max(0, passengerCount - 1);
    setPassengerCount(next);
    if (selectedRouteId) {
      passengerApi
        .submitTally({
          routeId: selectedRouteId,
          stopId: DEFAULT_STOP_ID,
          passengersOn: 0,
          passengersOff: 1,
          fareType: 'full',
          fareAmount: 0,
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});
    }
  };

  const menuItems = [
    { title: 'Route Selection', screen: 'RouteSelection', icon: '🚌', color: COLORS.accentBlue },
    { title: 'Map', screen: 'Map', icon: '🗺️', color: COLORS.primary },
    { title: 'Pre-Trip Inspection', screen: 'PreTrip', icon: '✅', color: COLORS.emergency },
    { title: 'Post-Trip Inspection', screen: 'PostTrip', icon: '📋', color: COLORS.accentOrange },
    { title: 'Passenger Fare', screen: 'PassengerFare', icon: '💰', color: '#9B59B6' },
    { title: 'Messaging', screen: 'Messaging', icon: '💬', color: COLORS.accentBlue },
    { title: 'Settings', screen: 'Settings', icon: '⚙️', color: COLORS.textMuted },
  ];

  const StatusGauge = () => {
    const size = gaugeSize;
    const cx = size / 2;
    const cy = size / 2;
    // ss2: Thick arc, ~270° open at bottom, smooth gradient
    const arcStrokeWidth = 40;
    const radius = size / 2 - arcStrokeWidth / 2 - 6;
    const innerArcRadius = radius - arcStrokeWidth / 2; // inner edge of gradient
    const innerCircleRadius = innerArcRadius - 18; // inner dark gray circle
    const tickCount = 52;
    // ~270° arc, gap at bottom (72° to 108°)
    const startAngle = 108;
    const endAngle = 72;
    const arcSpan = 324;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const startX = cx + radius * Math.cos(startRad);
    const startY = cy + radius * Math.sin(startRad);
    const endX = cx + radius * Math.cos(endRad);
    const endY = cy + radius * Math.sin(endRad);
    const arcPath = `M ${startX},${startY} A ${radius},${radius} 0 1 1 ${endX},${endY}`;

    return (
      <View style={[styles.gaugeWrapper, { width: size, height: size + 44 }]}>
        <Text style={[styles.gaugeLabel, styles.gaugeLabelOnTime]}>On Time</Text>
        <View style={[styles.gaugeArc, { width: size, height: size }]}>
          <Svg width={size} height={size} style={styles.gaugeSvg}>
            {/* ss2: Thick gradient arc - smooth transition */}
            <GradientPath
              d={arcPath}
              colors={COLORS.gaugeGradient}
              strokeWidth={arcStrokeWidth}
              precision={15}
            />
            {/* ss2: Inner dark gray circle - thinner band inside gradient */}
            <Circle
              cx={cx}
              cy={cy}
              r={innerCircleRadius}
              fill="#374151"
              stroke="none"
            />
            {/* ss2: Radial lines from outer edge of inner circle to inner edge of gradient */}
            {Array.from({ length: tickCount }).map((_, i) => {
              const t = i / (tickCount - 1);
              const angle = (startAngle + t * arcSpan) % 360;
              const rad = (angle * Math.PI) / 180;
              const x1 = cx + innerCircleRadius * Math.cos(rad);
              const y1 = cy + innerCircleRadius * Math.sin(rad);
              const x2 = cx + innerArcRadius * Math.cos(rad);
              const y2 = cy + innerArcRadius * Math.sin(rad);
              return (
                <Line
                  key={`tick-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#4B5563"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </View>
        <View style={[styles.gaugeLabelsBottom, styles.gaugeLabelsBottomPositioned]}>
          <Text style={[styles.gaugeLabel, styles.gaugeLabelLate]}>Late</Text>
          <Text style={[styles.gaugeLabel, styles.gaugeLabelEarly]}>Early</Text>
        </View>
      </View>
    );
  };

  return (
    <MainLayout navigation={navigation}>
      <View style={styles.contentContainer}>
        <Pressable
          style={[
            styles.emergencyBtn,
            styles.emergencyBtnAbsolute,
            isMobile && styles.emergencyBtnAbsolutePhone,
            emergencyActivated && styles.emergencyBtnActivated,
          ]}
          onPress={handleEmergencyPress}
          onPressIn={handleEmergencyPressIn}
          onPressOut={handleEmergencyPressOut}
        >
          <View style={[
            styles.emergencyBtnCircle,
            emergencyActivated && styles.emergencyBtnCircleActivated,
          ]}>
            <Text style={styles.emergencyBtnArrow}>→</Text>
          </View>
          <Text
            style={[
              styles.emergencyBtnText,
              emergencyActivated && styles.emergencyBtnTextActivated,
            ]}
          >
            {emergencyActivated ? 'Activated' : 'Emergency'}
          </Text>
        </Pressable>

        <View
          style={[
            styles.centerSection,
            centerGaugeVertically && styles.centerSectionPhone,
          ]}
        >
          <Text style={styles.timeDisplayCenter}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
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

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.statusBtn, styles.statusBtnWithCount]}
            onPress={() => setShowPassengerModal(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="people" size={32} color="#FFFFFF" />
            <Text style={styles.statusBtnCount}>{passengerCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statusBtn}
            onPress={() => setShowPassengerModal(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="account-edit" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusBtn, (!driver || driver.role === 'unassigned') && styles.statusBtnDisabled]}
            onPress={() => {
              if (driver && driver.role !== 'unassigned') setShowVehicleModal(true);
            }}
            activeOpacity={0.7}
            disabled={!driver || driver.role === 'unassigned'}
          >
            <MaterialIcons
              name="confirmation-number"
              size={32}
              color={driver && driver.role !== 'unassigned' ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.gpsRow}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsText}>{powerTrackingStatus}</Text>
        </View>

        {/* Quick Actions - commented out
        <Animated.View style={[styles.quickActions, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.menuCard, { borderLeftColor: item.color }]}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.7}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
        */}
      </View>

      <Modal
        visible={showPassengerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPassengerModal(false)}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
      >
        <Pressable style={[StyleSheet.absoluteFill, styles.reasonModalOverlay]} onPress={() => setShowPassengerModal(false)}>
          <Pressable style={styles.passengerModalContent} onPress={() => {}}>
            <Text style={styles.passengerModalTitle}>Count Passengers</Text>
            <Text style={styles.passengerModalCount}>{passengerCount}</Text>
            <View style={styles.passengerModalButtons}>
              <TouchableOpacity
                style={styles.passengerModalBtn}
                onPress={handleAlighting}
                activeOpacity={0.7}
              >
                <MaterialIcons name="person-remove" size={36} color="#FFFFFF" />
                <Text style={styles.passengerModalBtnLabel}>Alighting</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passengerModalBtn}
                onPress={handleBoarding}
                activeOpacity={0.7}
              >
                <MaterialIcons name="person-add" size={36} color="#FFFFFF" />
                <Text style={styles.passengerModalBtnLabel}>Boarding</Text>
              </TouchableOpacity>
            </View>
            <Pressable
              style={styles.passengerModalDone}
              onPress={() => setShowPassengerModal(false)}
            >
              <Text style={styles.passengerModalDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <VehicleSelectModal
        visible={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
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
          <Pressable style={styles.reasonModalContent} onPress={() => {}}>
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
    </MainLayout>
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
  passengerModalContent: {
    backgroundColor: '#252A32',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  passengerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  passengerModalCount: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 24,
  },
  passengerModalButtons: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 24,
  },
  passengerModalBtn: {
    backgroundColor: '#3A3A3C',
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  passengerModalBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  passengerModalDone: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  passengerModalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  gaugeSection: {
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 16,
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
    marginTop: 12,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  statusBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#232931',
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  statusBtnDisabled: {
    opacity: 0.5,
  },
  statusBtnWithCount: {
    flexDirection: 'row',
    gap: 10,
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
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
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
});

export default HomeScreen;
