/**
 * Home Screen - Driver Dashboard
 * Clean design for mobile
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import GradientPath from 'react-native-svg-path-gradient';
import { useWindowDimensions } from 'react-native';
import MainLayout from '../../components/MainLayout';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useDriverModal } from '../../context/DriverModalContext';
import { useEmergency } from '../../context/EmergencyContext';

interface HomeScreenProps {
  navigation: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAUGE_SIZE = Math.min(SCREEN_WIDTH - 48, 280);

const HOLD_DURATION_MS = 5000;

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { driver } = useAuth();
  const { open: openDriverModal } = useDriverModal();
  const { emergencyActivated, activateEmergency, deactivateEmergency } = useEmergency();
  const { width } = useWindowDimensions();
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonText, setReasonText] = useState('');
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = width < 900;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

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
      // When activated, tap opens the reason modal directly (clear hold timer if any)
      handleEmergencyPressOut();
      setShowReasonModal(true);
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
    const size = GAUGE_SIZE;
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
    // ss2: Smooth gradient - orange-red left → yellow → light green top → darker green right
    const gradientColors = [
      '#EA580C', '#F97316', '#FB923C', '#FBBF24', '#FACC15', '#EAB308',
      '#A3E635', '#84CC16', '#22C55E', '#16A34A', '#15803D',
    ];

    return (
      <View style={[styles.gaugeWrapper, { width: size, height: size + 44 }]}>
        <Text style={[styles.gaugeLabel, styles.gaugeLabelOnTime]}>On Time</Text>
        <View style={[styles.gaugeArc, { width: size, height: size }]}>
          <Svg width={size} height={size} style={styles.gaugeSvg}>
            {/* ss2: Thick gradient arc - smooth transition */}
            <GradientPath
              d={arcPath}
              colors={gradientColors}
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          {isMobile ? <View style={styles.menuBtnPlaceholder} /> : null}
          <Text style={styles.timeDisplay}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Pressable
            style={[
              styles.emergencyBtn,
              emergencyActivated && styles.emergencyBtnActivated,
            ]}
            onPress={handleEmergencyPress}
            onPressIn={handleEmergencyPressIn}
            onPressOut={handleEmergencyPressOut}
          >
            <View
              style={[
                styles.emergencyIconWrap,
                emergencyActivated && styles.emergencyIconWrapActivated,
              ]}
            >
              <Text style={styles.emergencyIcon}>→</Text>
            </View>
            <Text
              style={[
                styles.emergencyText,
                emergencyActivated && styles.emergencyTextActivated,
              ]}
            >
              {emergencyActivated ? 'Activated' : 'Emergency'}
            </Text>
          </Pressable>
        </View>

        <Animated.View style={[styles.gaugeSection, { opacity: fadeAnim }]}>
          <StatusGauge />
        </Animated.View>

        <View style={styles.buttonRow}>
          <View style={styles.statusBtn}>
            <Text style={styles.statusBtnIcon}>👥</Text>
            <Text style={styles.statusBtnValue}>0</Text>
          </View>
          <TouchableOpacity style={styles.statusBtn} onPress={openDriverModal} activeOpacity={0.7}>
            <Text style={styles.statusBtnIcon}>✏️</Text>
          </TouchableOpacity>
          <View style={styles.statusBtn}>
            <Text style={styles.statusBtnIcon}>🎫</Text>
          </View>
        </View>

        <View style={styles.gpsRow}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsText}>GPS Tracking (Auto)</Text>
        </View>

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
      </ScrollView>

      <Modal
        visible={showReasonModal}
        transparent
        animationType="fade"
        onRequestClose={handleReasonCancel}
      >
        <Pressable style={styles.reasonModalOverlay} onPress={handleReasonCancel}>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  menuBtnPlaceholder: {
    width: 48,
    height: 48,
  },
  timeDisplay: {
    flex: 1,
    fontSize: 32,
    fontWeight: '200',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.emergency,
    paddingHorizontal: 4,
    paddingVertical: 4,
    paddingRight: 16,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  emergencyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.emergency,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  emergencyIcon: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencyText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emergencyBtnActivated: {
    backgroundColor: '#EAB308',
    borderColor: 'rgba(234, 179, 8, 0.5)',
  },
  emergencyIconWrapActivated: {
    backgroundColor: '#CA8A04',
    shadowColor: '#EAB308',
  },
  emergencyTextActivated: {
    color: '#1E293B',
  },
  reasonModalOverlay: {
    flex: 1,
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
  gaugeSection: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  gaugeLabelLate: {},
  gaugeLabelOnTime: {
    textAlign: 'center',
    marginBottom: 8,
  },
  gaugeLabelEarly: {
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A3038',
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  statusBtnIcon: {
    fontSize: 22,
  },
  statusBtnValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  gpsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
