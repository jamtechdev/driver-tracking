import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useEmergency } from '../context/EmergencyContext';
import { EMERGENCY_HOLD_DURATION_MS } from './EmergencyDeactivateReasonModal';
import { useReportIncidentModal } from '../context/ReportIncidentModalContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsModal } from '../context/SettingsModalContext';
import { useSidebar } from '../context/SidebarContext';

const TabHeader: React.FC = () => {
  const { emergencyActivated, activateEmergency, openDeactivateReasonModal } = useEmergency();
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const holdRippleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const { open: openReportIncidentModal } = useReportIncidentModal();
  const { use24HourClock } = useSettingsModal();
  const { open: openSidebar } = useSidebar();
  const sliderAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isPortrait = !isLandscape;
  const isMobile = width < 768;
  const isSmallDevice = width < 600;
  const sliderWidth = isSmallDevice ? (isPortrait ? 130 : 150) : 160;
  const thumbSize = 52;
  const timeFontSize = isSmallDevice ? (isPortrait ? 16 : 24) : 28;
  const [currentTime, setCurrentTime] = useState(new Date());
  const insets = useSafeAreaInsets()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!emergencyActivated) {
      Animated.timing(sliderAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [emergencyActivated, sliderAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !emergencyActivated,
        onMoveShouldSetPanResponder: () => !emergencyActivated,
        onPanResponderMove: (_, gestureState) => {
          if (emergencyActivated) return;
          const newValue = Math.max(0, Math.min(sliderWidth - thumbSize, gestureState.dx));
          sliderAnim.setValue(newValue);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (emergencyActivated) return;
          const threshold = (sliderWidth - thumbSize) * 0.8;
          if (gestureState.dx >= threshold) {
            Animated.spring(sliderAnim, {
              toValue: sliderWidth - thumbSize,
              useNativeDriver: false,
            }).start((result) => {
              if (result.finished) {
                try {
                  activateEmergency();
                } catch (error) {
                  sliderAnim.setValue(0);
                }
              }
            });
          } else {
            Animated.spring(sliderAnim, {
              toValue: 0,
              tension: 50,
              friction: 7,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [emergencyActivated, activateEmergency, sliderWidth, thumbSize, sliderAnim]
  );

  const resetHoldRipple = () => {
    holdRippleAnimRef.current?.stop();
    holdRippleAnimRef.current = null;
    rippleScale.setValue(0);
    rippleOpacity.setValue(0);
  };

  const startHoldRipple = () => {
    holdRippleAnimRef.current?.stop();
    rippleScale.setValue(0);
    rippleOpacity.setValue(0.55);
    const easing = Easing.inOut(Easing.ease);
    holdRippleAnimRef.current = Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 2.8,
        duration: EMERGENCY_HOLD_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: EMERGENCY_HOLD_DURATION_MS,
        easing,
        useNativeDriver: true,
      }),
    ]);
    holdRippleAnimRef.current.start();
  };

  const cancelHoldRipple = () => {
    holdRippleAnimRef.current?.stop();
    holdRippleAnimRef.current = null;
    const easing = Easing.out(Easing.ease);
    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 0,
        duration: 220,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 220,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDeactivatePressIn = () => {
    if (!emergencyActivated) return;
    startHoldRipple();
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      resetHoldRipple();
      openDeactivateReasonModal();
    }, EMERGENCY_HOLD_DURATION_MS);
  };

  const handleDeactivatePressOut = () => {
    cancelHoldRipple();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => () => {
    resetHoldRipple();
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  return (
    <SafeAreaView style={[styles.header, isLandscape && styles.headerLandscape]} edges={['top']}>
      <View style={styles.leftContainer}>
        {isPortrait && isSmallDevice && (
          <TouchableOpacity onPress={openSidebar} style={styles.menuButton}>
            <MaterialIcons name="menu" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.headerTimeContainer}>
        <Text style={[styles.headerTime, { fontSize: timeFontSize }]}>
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !use24HourClock })}
        </Text>
      </View>

      <View style={styles.rightContainer}>
        <View style={[styles.emergencyContainerNew, { width: sliderWidth + (isMobile ? 12 : 24), paddingRight: isMobile ? 12 : 24, marginBottom: isPortrait ? 10 : 0 }]}>
          {emergencyActivated ? (
            <TouchableOpacity
              style={styles.emergencyActivatedBtn}
              activeOpacity={0.92}
              onPressIn={handleDeactivatePressIn}
              onPressOut={handleDeactivatePressOut}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.emergencyRipple,
                  {
                    opacity: rippleOpacity,
                    transform: [{ scale: rippleScale }],
                  },
                ]}
              />
              <Text style={styles.emergencyActivatedText}>Activated</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.sliderTrack, { width: sliderWidth }]}>
              <Text style={styles.sliderLabel}>Emergency</Text>
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.sliderThumb, { transform: [{ translateX: sliderAnim }] }]}
              >
                <MaterialIcons name="arrow-forward" size={28} color="#FFFFFF" />
              </Animated.View>
            </View>
          )}
        </View>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Keeps the 3 columns spread out
    position: 'relative',
    paddingRight: 10
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTimeContainer: {
    flex: 2, // Give more space to the center time
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLandscape: {

    // marginTop: 10,
    paddingBottom: 5,
  },
  headerTime: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginRight: 10,
    // backgroundColor: 'red'
  },
  emergencyContainerNew: {
    alignItems: 'flex-end',
    alignSelf: 'center',
    // marginBottom: 10,
  },
  sliderTrack: {
    width: '100%',
    maxWidth: 220,
    height: 42,
    backgroundColor: '#3A3A3C',
    borderRadius: 26,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 10
  },
  sliderLabel: {
    position: 'absolute',
    left: 0,
    right: -24,
    textAlign: 'center',
    fontSize: 13,
    marginLeft: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    pointerEvents: 'none',
  },
  sliderThumb: {
    width: 42,
    height: 38,
    backgroundColor: COLORS.emergency,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  emergencyActivatedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAB308',
    paddingVertical: 12,
    paddingHorizontal: 35,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 10,
    overflow: 'hidden',
  },
  emergencyRipple: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  emergencyActivatedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    zIndex: 1,
  },
});

export default TabHeader;
