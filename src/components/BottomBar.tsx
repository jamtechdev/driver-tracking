/**
 * Bottom Bar - Driver | Vehicle | Route | Logout
 * Dark gray, vertical separators, lime for status text, device-size adjustable
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useDriverModal } from '../context/DriverModalContext';
import SelectRouteModal from './SelectRouteModal';
import VehicleSelectModal from './VehicleSelectModal';

const BOTTOM_BAR_LIME = '#ADFF2F';
const BOTTOM_BAR_SECONDARY = 'rgba(255,255,255,0.7)';

interface BottomBarProps {
  navigation: any;
  onDriverPress?: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ navigation, onDriverPress }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { open: openDriverModal } = useDriverModal();
  const { driver, vehicleId, vehicleName, selectedRoute, serviceStatus, logout } = useAuth();

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
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };
  const isLoggedOut = !driver || driver.role === 'unassigned';
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const driverName = driver && driver.role !== 'unassigned' ? driver.name : 'Unassigned';
  const vehicleDisplay = vehicleId || '—';
  const routeDisplay = selectedRoute || 'Out of Service';
  const showLimeDriver = isLoggedOut;
  const showLimeRoute = serviceStatus === 'out_of_service';

  return (
    <View style={styles.outer}>
      <View style={[styles.container, { borderTopColor: COLORS.navBarSeparator, paddingBottom: bottomPadding }]}>
        <View style={styles.inner}>
          {/* Driver - icon above label (ss1) */}
          <Pressable
            style={[styles.item, isLoggedOut && styles.itemDisabled]}
            onPress={handleDriverPress}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="person"
              size={iconSize}
              color={COLORS.navBarIcon}
              style={styles.itemIcon}
            />
            <Text
              style={[
                styles.itemLabel,
                { fontSize: labelSize },
                showLimeDriver && styles.labelLime,
                isLoggedOut && styles.itemLabelDisabled,
              ]}
              numberOfLines={1}
            >
              {driverName}
            </Text>
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Bus - icon above label */}
          <Pressable
            style={[styles.item, isLoggedOut && styles.itemDisabled]}
            onPress={() => !isLoggedOut && setShowVehicleModal(true)}
            disabled={isLoggedOut}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="directions-bus"
              size={iconSize}
              color={isLoggedOut ? COLORS.navBarIconDisabled : COLORS.navBarIcon}
              style={styles.itemIcon}
            />
            <Text
              style={[styles.itemLabel, styles.labelSecondary, { fontSize: labelSize }, isLoggedOut && styles.itemLabelDisabled]}
              numberOfLines={1}
            >
              {vehicleDisplay}
            </Text>
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Route - icon above label */}
          <Pressable
            style={[styles.item, isLoggedOut && styles.itemDisabled]}
            onPress={() => !isLoggedOut && setShowRouteModal(true)}
            disabled={isLoggedOut}
            android_ripple={null}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons
              name="route"
              size={iconSize}
              color={isLoggedOut ? COLORS.navBarIconDisabled : COLORS.navBarIcon}
              style={styles.itemIcon}
            />
            <Text
              style={[
                styles.itemLabel,
                { fontSize: labelSize },
                showLimeRoute && !isLoggedOut && styles.labelLime,
                isLoggedOut && styles.itemLabelDisabled,
              ]}
              numberOfLines={1}
            >
              {routeDisplay}
            </Text>
          </Pressable>

          <View style={[styles.divider, { height: dividerHeight }]} />

          {/* Logout - icon above label */}
          <Pressable
            style={[styles.item, isLoggedOut && styles.itemDisabled]}
            onPress={handleLogout}
            disabled={isLoggedOut}
            android_ripple={null}
          >
            <MaterialIcons
              name="logout"
              size={iconSize}
              color={isLoggedOut ? COLORS.navBarIconDisabled : COLORS.navBarIcon}
              style={styles.itemIcon}
            />
            <Text
              style={[styles.itemLabel, styles.labelSecondary, { fontSize: labelSize }, isLoggedOut && styles.itemLabelDisabled]}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  itemIcon: {
    marginBottom: 4,
  },
  itemLabel: {
    color: COLORS.navBarText,
    fontWeight: '500',
    textAlign: 'center',
  },
  labelLime: {
    color: BOTTOM_BAR_LIME,
    fontWeight: '600',
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
