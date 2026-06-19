/**
 * Bottom Bar - Driver | Vehicle | Route | Logout
 * Dark gray, vertical separators, lime for status text, device-size adjustable
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, useColorScheme, Animated, Easing, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useDriverModal } from '../context/DriverModalContext';
import { useEmergency } from '../context/EmergencyContext';
import SelectRouteModal from './SelectRouteModal';
import VehicleSelectModal from './VehicleSelectModal';

const BOTTOM_BAR_LIME = '#ADFF2F';
const BOTTOM_BAR_SECONDARY = 'rgba(255,255,255,0.7)';

interface BottomBarProps {
  navigation: any;
  onDriverPress?: () => void;
}

const MarqueeText: React.FC<{ text: string; style: any; threshold?: number }> = ({ text, style, threshold = 15 }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const isScrolling = containerWidth > 0 && textWidth > containerWidth + 5;

  const lastText = useRef(text);

  useEffect(() => {
    if (lastText.current !== text) {
      lastText.current = text;
      scrollAnim.stopAnimation();
      scrollAnim.setValue(0);
    }
  }, [text]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isScrolling) {
      const scrollDistance = (textWidth - containerWidth) + 30;
      const duration = Math.max(3000, scrollDistance * 60);

      animation = Animated.loop(
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(scrollAnim, {
            toValue: -scrollDistance,
            duration: duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(1500),
          Animated.timing(scrollAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      scrollAnim.stopAnimation();
      Animated.timing(scrollAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [text, textWidth, containerWidth, isScrolling]);

  return (
    <View
      style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: isScrolling ? 'flex-start' : 'center',
          alignItems: 'center',
        }}
      >
        <Animated.Text
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && w !== textWidth) setTextWidth(w);
          }}
          style={[
            style,
            {
              transform: [{ translateX: scrollAnim }],
              maxWidth: undefined,
              textAlign: isScrolling ? 'left' : 'center',
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {text}
        </Animated.Text>
      </ScrollView>
    </View>
  );
};

const BottomBar: React.FC<BottomBarProps> = ({ navigation, onDriverPress }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const dynamicIconColor = isDarkMode ? '#000000' : '#ffffff';

  const { open: openDriverModal } = useDriverModal();
  const { emergencyActivated } = useEmergency();
  const { driver, driverTabLabel, driverForTab, vehicleId, vehicleName, routeTabLabel, serviceStatus, logout } = useAuth();
  const isLandscape = width > height;
  const scale = Math.min(width / 380, 1.3);
  // Match sidebar sizing: same icon + text scale
  const iconSize = Math.max(24, Math.round(28 * scale));
  const labelSize = Math.max(12, Math.round(12 * scale));
  const dividerHeight = Math.max(36, Math.round(44 * scale));
  const bottomPadding = Math.max(4, insets.bottom - 4);

  const handleDriverPress = () => {
    (onDriverPress || openDriverModal)();
  };
  const handleLogout = () => {
    logout();
  };
  const isLoggedOut = !driverForTab || driverForTab.role === 'unassigned';
  const effectiveLoggedOut = isLoggedOut;
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const driverName = driverTabLabel;
  const vehicleDisplay = vehicleName || 'Unassigned';
  const routeDisplay = routeTabLabel;
  const showLimeDriver = effectiveLoggedOut;
  const showLimeRoute = serviceStatus === 'out_of_service' || emergencyActivated;

  return (
    <View style={styles.outer}>
      <View style={[styles.container, { borderTopColor: COLORS.navBarSeparator, paddingBottom: bottomPadding }]}>
        <View style={styles.inner}>
          {/* Driver - icon above label (ss1) */}
          <Pressable
            style={[styles.item, effectiveLoggedOut && styles.itemDisabled, isLandscape && styles.itemRow]}
            onPress={handleDriverPress}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="person"
              size={iconSize}
              color={dynamicIconColor}
              style={isLandscape ? undefined : styles.itemIcon}
            />
            <MarqueeText
              key={`driver-${isLandscape}-${driverName}`}
              text={driverName}
              style={[
                styles.itemLabel,
                { fontSize: labelSize },
                showLimeDriver && styles.labelLime,
                effectiveLoggedOut && !isLoggedOut && styles.labelLime,
              ]}
              threshold={15}
            />
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Bus - icon above label */}
          <Pressable
            style={[styles.item, (effectiveLoggedOut || driver?.role !== 'supervisor') && styles.itemDisabled, isLandscape && styles.itemRow]}
            onPress={() => !effectiveLoggedOut && driver?.role === 'supervisor' && setShowVehicleModal(true)}
            disabled={effectiveLoggedOut || driver?.role !== 'supervisor'}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="directions-bus"
              size={iconSize}
              color={effectiveLoggedOut ? COLORS.navBarIconDisabled : dynamicIconColor}
              style={isLandscape ? undefined : styles.itemIcon}
            />
            <MarqueeText
              key={`vehicle-${isLandscape}-${vehicleDisplay}`}
              text={vehicleDisplay}
              style={[styles.itemLabel, styles.labelSecondary, { fontSize: labelSize }, effectiveLoggedOut && styles.itemLabelDisabled]}
              threshold={15}
            />
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Route - icon above label */}
          <Pressable
            style={[styles.item, isLandscape && styles.itemRow]}
            onPress={() => setShowRouteModal(true)}
            // disabled={isLoggedOut}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="route"
              size={iconSize}
              color={dynamicIconColor}
              style={isLandscape ? undefined : styles.itemIcon}
            />
            <MarqueeText
              key={`route-${isLandscape}-${routeDisplay}`}
              text={routeDisplay}
              style={[
                styles.itemLabel,
                { fontSize: labelSize },
                showLimeRoute && isLoggedOut && styles.labelLime,
              ]}
              threshold={15}
            />
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Logout - icon above label */}
          <Pressable
            style={[styles.item, effectiveLoggedOut && styles.itemDisabled, isLandscape && styles.itemRow]}
            onPress={handleLogout}
            disabled={effectiveLoggedOut}
            android_ripple={null}
          >
            <MaterialIcons
              name="logout"
              size={iconSize}
              color={effectiveLoggedOut ? COLORS.navBarIconDisabled : dynamicIconColor}
              style={isLandscape ? undefined : styles.itemIcon}
            />
            <Text
              style={[
                styles.itemLabel,
                styles.labelSecondary,
                { fontSize: labelSize },
                effectiveLoggedOut && styles.itemLabelDisabled,
                isLandscape && { flex: 1 }
              ]}
              numberOfLines={1}
            >
              Logout
            </Text>
          </Pressable>
        </View>
      </View>

      <SelectRouteModal
        visible={showRouteModal}
        onClose={() => setShowRouteModal(false)}
      />
      <VehicleSelectModal
        visible={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'transparent',
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    backgroundColor: COLORS.navBarBackground,
    borderTopWidth: 1,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    elevation: 9999,
  },
  inner: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    minWidth: 100
  },
  itemIcon: {
    marginBottom: 4,
  },
  itemLabel: {
    color: COLORS.navBarText,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: '100%',
  },
  labelLime: {
    color: COLORS.early,
    fontWeight: '400',
  },
  labelSecondary: {
    color: BOTTOM_BAR_SECONDARY,
  },
  itemLabelDisabled: {
    color: COLORS.navBarIconDisabled,
  },
  itemDisabled: {
    opacity: 0.6,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 0,
  },
});

export default BottomBar;
