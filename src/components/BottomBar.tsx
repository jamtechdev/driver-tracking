/**
 * Bottom Bar - Premium status bar
 * Driver, Vehicle, Route/Status, Logout (Power & Service Status in Sidebar)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useEmergency } from '../context/EmergencyContext';
import SelectRouteModal from './SelectRouteModal';

interface BottomBarProps {
  navigation: any;
  onDriverPress?: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ navigation, onDriverPress }) => {
  const insets = useSafeAreaInsets();
  const { driver, vehicleId, logout, selectedRoute, serviceStatus } = useAuth();
  const { messageSent } = useEmergency();
  const isLoggedOut = !driver || driver.role === 'unassigned';
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);

  const handleLogoutPress = () => {
    if (isLoggedOut) return;
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const driverName = driver?.name || 'Unassigned';
  const bottomPadding = Math.min(insets.bottom, 8);

  return (
    <View style={styles.outer}>
      <View style={styles.container}>
        <View style={[styles.inner, { paddingBottom: 4 + bottomPadding }]}>
          <Pressable style={styles.item} onPress={onDriverPress} android_ripple={null}>
            <View style={[styles.iconWrap, isLoggedOut && styles.iconWrapActive]}>
              <MaterialIcons name="person" size={20} color="rgba(255,255,255,0.95)" />
            </View>
            <Text style={styles.itemLabel} numberOfLines={1}>{driverName}</Text>
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.item}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="directions-bus" size={20} color="rgba(255,255,255,0.95)" />
            </View>
            <Text style={styles.itemLabel} numberOfLines={1}>{vehicleId || '—'}</Text>
          </View>

          <View style={styles.divider} />

          {messageSent && (
            <>
              <View style={styles.item}>
                <View style={styles.iconWrap}>
                  <MaterialIcons name="campaign" size={18} color={COLORS.primary} />
                </View>
                <Text style={[styles.itemLabel, styles.messageSentLabel]}>Message Sent</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <Pressable
            style={[
              styles.item,
              isLoggedOut && styles.itemDisabled,
              serviceStatus === 'out_of_service' && styles.routeItemOutOfService,
            ]}
            onPress={() => !isLoggedOut && setShowRouteModal(true)}
            disabled={isLoggedOut}
            android_ripple={null}
          >
            <View
              style={[
                styles.iconWrap,
                serviceStatus === 'out_of_service' && styles.routeWrapOutOfService,
              ]}
            >
              <MaterialIcons
                name="route"
                size={18}
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
            onPress={handleLogoutPress}
            disabled={isLoggedOut}
            android_ripple={null}
          >
            <View style={[styles.iconWrap, styles.logoutWrap, isLoggedOut && styles.logoutWrapDisabled]}>
              <MaterialIcons
                name="logout"
                size={18}
                color={isLoggedOut ? 'rgba(255,255,255,0.2)' : '#F87171'}
              />
            </View>
            <Text style={[styles.itemLabel, isLoggedOut && styles.itemLabelDisabled]}>Logout</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLogoutModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonLogout]}
                onPress={handleLogoutConfirm}
              >
                <Text style={styles.modalButtonLogoutText}>Logout</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SelectRouteModal
        visible={showRouteModal}
        onClose={() => setShowRouteModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'transparent',
  },
  container: {
    backgroundColor: '#252A32',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  inner: {
    flexDirection: 'row',
    backgroundColor: '#252A32',
    paddingTop: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  itemLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  divider: {
    width: 1.5,
    height: 32,
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
  logoutWrap: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  logoutWrapDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemLabelDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#252A32',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonLogout: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  modalButtonLogoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BottomBar;
