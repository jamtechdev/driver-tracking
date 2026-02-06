/**
 * Bottom Bar - Premium status bar
 * Driver, Vehicle, Route/Status (Power & Proceed if Safe in Sidebar)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import { useDriverModal } from '../context/DriverModalContext';
import SelectRouteModal from './SelectRouteModal';
import VehicleSelectModal from './VehicleSelectModal';

interface BottomBarProps {
  navigation: any;
  onDriverPress?: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ navigation, onDriverPress }) => {
  const insets = useSafeAreaInsets();
  const { open: openDriverModal } = useDriverModal();
  const { driver, vehicleId, vehicleName, selectedRoute, serviceStatus, logout } = useAuth();
  const { messageSent } = useEmergency();

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

  // When driver logs in (not unassigned), show their name; otherwise "Unassigned"
  const driverName = driver && driver.role !== 'unassigned' ? driver.name : 'Unassigned';
  const vehicleDisplay = vehicleName || vehicleId || '—';
  const bottomPadding = Math.min(insets.bottom, 8);

  return (
    <View style={styles.outer}>
      <View style={styles.container}>
        <View style={[styles.inner, { paddingBottom: 4 + bottomPadding }]}>
          <Pressable
            style={styles.item}
            onPress={handleDriverPress}
            android_ripple={null}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={[styles.iconWrap, isLoggedOut && styles.iconWrapActive]}>
              <MaterialIcons name="person" size={32} color="rgba(255,255,255,0.95)" />
            </View>
            <Text style={styles.itemLabel} numberOfLines={1}>{driverName}</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.item}
            onPress={() => setShowVehicleModal(true)}
            android_ripple={null}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View style={styles.iconWrap}>
              <MaterialIcons name="directions-bus" size={32} color="rgba(255,255,255,0.95)" />
            </View>
            <Text style={styles.itemLabel} numberOfLines={1}>{vehicleDisplay}</Text>
          </Pressable>

          <View style={styles.divider} />

          {messageSent && (
            <>
              <View style={styles.divider} />
              <View style={styles.item}>
                <View style={styles.iconWrap}>
                  <MaterialIcons name="campaign" size={32} color={COLORS.primary} />
                </View>
                <Text style={[styles.itemLabel, styles.messageSentLabel]}>Message Sent</Text>
              </View>
            </>
          )}

          <View style={styles.divider} />

          <Pressable
            style={[
              styles.item,
              isLoggedOut && styles.itemDisabled,
              serviceStatus === 'out_of_service' && styles.routeItemOutOfService,
            ]}
            onPress={() => setShowRouteModal(true)}
            android_ripple={null}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <View
              style={[
                styles.iconWrap,
                serviceStatus === 'out_of_service' && styles.routeWrapOutOfService,
              ]}
            >
                <MaterialIcons
                  name="route"
                  size={32}
                  color="rgba(255,255,255,0.95)"
                />
            </View>
            <Text
              style={[
                styles.itemLabel,
                serviceStatus === 'out_of_service' && styles.routeLabelOutOfService,
                isLoggedOut && styles.itemLabelDisabled,
              ]}
              numberOfLines={1}
            >
              {selectedRoute}
            </Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={[styles.item, isLoggedOut && styles.itemDisabled]}
            onPress={handleLogout}
            disabled={isLoggedOut}
            android_ripple={null}
          >
            <View style={[styles.iconWrap, isLoggedOut && styles.iconWrapDisabled]}>
              <MaterialIcons
                name="logout"
                size={32}
                color={isLoggedOut ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.95)'}
              />
            </View>
            <Text
              style={[styles.itemLabel, isLoggedOut && styles.itemLabelDisabled]}
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
  },
  container: {
    backgroundColor: '#232931',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inner: {
    flexDirection: 'row',
    backgroundColor: '#232931',
    paddingTop: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 44,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  iconWrapDisabled: {
    opacity: 0.5,
  },
  itemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  divider: {
    width: 1.5,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
  },
  routeItemOutOfService: {},
  routeWrapOutOfService: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  routeLabelOutOfService: {
    color: '#ADFF2F',
    fontWeight: '600',
  },
  messageSentLabel: {
    color: COLORS.primary,
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemLabelDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
});

export default BottomBar;
