/**
 * Sidebar - Clean navigation drawer
 * Settings, Brightness, Map, Message, Checklist, Proceed if Safe
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, ScrollView, Pressable } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { useBrightness } from '../context/BrightnessContext';
import { useMessagingModal } from '../context/MessagingModalContext';
import { useSettingsModal } from '../context/SettingsModalContext';
import { useMapModal } from '../context/MapModalContext';
import { useChecklistModal } from '../context/ChecklistModalContext';

interface SidebarProps {
  navigation: any;
  onProceedIfSafe?: () => void;
  onNavPress?: () => void;
  variant?: 'compact' | 'drawer';
  isTablet?: boolean;
}

const SIDEBAR_ITEMS = [
  { id: 'Settings', label: 'Settings', icon: 'settings' },
  { id: 'Brightness', label: 'Brightness', icon: 'wb-sunny' },
  { id: 'Map', label: 'Map', icon: 'map' },
  { id: 'Messaging', label: 'Messages', icon: 'campaign' },
  { id: 'PreTrip', label: 'Checklist', icon: 'assignment' },
];

const Sidebar: React.FC<SidebarProps> = ({
  navigation,
  onProceedIfSafe,
  onNavPress,
  variant,
  isTablet,
}) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { driver, serviceStatus } = useAuth();
  const { setBrightnessVisible, brightnessVisible } = useBrightness();
  const { open: openMessagingModal, visible: messagingModalVisible } = useMessagingModal();
  const { open: openSettingsModal, visible: settingsModalVisible } = useSettingsModal();
  const { open: openMapModal, visible: mapModalVisible } = useMapModal();
  const { open: openChecklistModal, visible: checklistModalVisible } = useChecklistModal();
  const isDrawer = variant === 'drawer' || width < 600;
  const isLoggedOut = !driver || driver.role === 'unassigned';

  const handlePower = () => {
    onNavPress?.();
    if (isLoggedOut) return;
    // Power = device/shift control - separate from logout (placeholder for power-off MDT, etc.)
  };

  const currentRoute = useNavigationState((state) => {
    const route = state?.routes?.[state.index];
    return route?.name ?? '';
  });

  const handleNav = (screen: string) => {
    onNavPress?.();
    if (screen === 'Brightness') {
      setBrightnessVisible(true);
      return;
    }
    if (screen === 'Messaging') {
      openMessagingModal();
      return;
    }
    if (screen === 'Settings') {
      openSettingsModal();
      return;
    }
    if (screen === 'Map') {
      navigation.navigate('Map');
      return;
    }
    if (screen === 'PreTrip') {
      openChecklistModal();
      return;
    }
  };

  const handleProceed = () => {
    onNavPress?.();
    (onProceedIfSafe || (() => navigation.navigate('RouteSelection')))();
  };

  if (isDrawer) {
    return (
      <View style={styles.drawer}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Menu</Text>
        </View>
        <ScrollView style={styles.drawerNav} showsVerticalScrollIndicator={false}>
          {SIDEBAR_ITEMS.map((item) => {
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.drawerItem}
                onPress={() => handleNav(item.id)}
                activeOpacity={0.6}
              >
                <MaterialIcons name={item.icon as any} size={24} color="rgba(255,255,255,0.9)" style={styles.drawerIcon} />
                <Text style={styles.drawerLabel}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.25)" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.drawerFooter}>
          <TouchableOpacity
            style={styles.proceedButtonDrawer}
            onPress={handleProceed}
            activeOpacity={0.7}
          >
            <Text style={styles.proceedTextDrawer}>Proceed if Safe</Text>
          </TouchableOpacity>
          {/* <View style={[
            styles.serviceStatusRow,
            serviceStatus === 'in_service' ? styles.serviceStatusInService : styles.serviceStatusOutOfService,
          ]}>
            <MaterialIcons
              name={serviceStatus === 'in_service' ? 'check-circle' : 'route'}
              size={22}
              color={serviceStatus === 'in_service' ? COLORS.primary : COLORS.emergency}
            />
            <Text style={[
              styles.serviceStatusText,
              serviceStatus === 'out_of_service' && styles.serviceStatusTextOut,
            ]}>
              {serviceStatus === 'out_of_service' ? 'Out of Service' : 'In Service'}
            </Text>
          </View> */}
          <Pressable
            style={[styles.powerButtonSidebar, isLoggedOut && styles.powerButtonSidebarDisabled]}
            onPress={handlePower}
            disabled={isLoggedOut}
            android_ripple={null}
          >
            <MaterialIcons
              name="power-settings-new"
              size={32}
              color={isLoggedOut ? 'rgba(255,255,255,0.3)' : '#FFFFFF'}
              style={styles.powerIcon}
            />
            <Text style={[styles.powerLabel, isLoggedOut && styles.powerLabelDisabled]}>Power</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.sidebar, isTablet && styles.sidebarTablet, isLandscape && styles.sidebarLandscape]}>
      <View style={styles.navItems}>
        {SIDEBAR_ITEMS.map((item) => {
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.navItem,
                isTablet && styles.navItemTablet,
                isLandscape && styles.navItemLandscape,
              ]}
              onPress={() => handleNav(item.id)}
              activeOpacity={0.6}
            >
              <MaterialIcons
                name={item.icon as any}
                size={isTablet ? 36 : 32}
                color="#FFFFFF"
                style={styles.navIcon}
              />
              <Text style={[styles.navLabel, isTablet && styles.navLabelTablet]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.proceedPowerColumn}>
        <TouchableOpacity
          style={[styles.proceedButton, isTablet && styles.proceedButtonTablet]}
          onPress={handleProceed}
          activeOpacity={0.7}
        >
          <Text style={[styles.proceedText, isTablet && styles.proceedTextTablet]}>Proceed if Safe</Text>
        </TouchableOpacity>
        <Pressable
          style={[styles.powerButtonSidebarCompact, isLoggedOut && styles.powerButtonSidebarDisabled]}
          onPress={handlePower}
          disabled={isLoggedOut}
          android_ripple={null}
        >
          <MaterialIcons
            name="power-settings-new"
            size={32}
            color={isLoggedOut ? 'rgba(255,255,255,0.3)' : '#FFFFFF'}
            style={styles.powerIcon}
          />
          <Text style={[styles.powerLabel, isLoggedOut && styles.powerLabelDisabled]}>Power</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 88,
    backgroundColor: '#232931',
    paddingTop: 20,
    paddingBottom: 0,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  sidebarTablet: {
    width: '100%',
    flex: 1,
    paddingTop: 24,
    paddingBottom: 0,
  },
  sidebarLandscape: {
    height: '40%',
  },
  navItemTablet: {
    paddingVertical: 20,
    marginBottom: 6,
  },
  navItemLandscape: {
    paddingVertical: 5,
  },
  navLabelTablet: {
    fontSize: 14,
  },
  proceedButtonTablet: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proceedTextTablet: {
    fontSize: 14,
  },
  navItems: {
    flex: 1,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 4,
  },
  navIcon: {
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  proceedPowerColumn: {
    marginTop: 'auto',
    alignSelf: 'stretch',
    gap: 0,
    marginBottom: 8,
  },
  proceedButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  powerButtonSidebarCompact: {
    width: '100%',
    height: BOTTOM_BAR_HEIGHT,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 14,
    backgroundColor: '#232931',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: -12,
  },
  powerIcon: {
    marginBottom: 6,
  },
  powerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  powerLabelDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  proceedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  drawer: {
    flex: 1,
    width: 280,
    minHeight: '100%',
    backgroundColor: '#0D1117',
    paddingTop: 28,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  drawerNav: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  drawerIcon: {
    marginRight: 16,
  },
  drawerLabel: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  drawerFooter: {
    padding: 18,
    paddingBottom: 36,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  serviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1.5,
  },
  serviceStatusInService: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  serviceStatusOutOfService: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  serviceStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  serviceStatusTextOut: {
    color: COLORS.emergency,
  },
  proceedButtonDrawer: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    marginBottom: 4,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  powerButtonSidebar: {
    width: '100%',
    height: BOTTOM_BAR_HEIGHT,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 14,
    backgroundColor: '#232931',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
    marginHorizontal: -18,
  },
  powerButtonSidebarDisabled: {
    backgroundColor: '#232931',
    opacity: 0.6,
  },
  proceedTextDrawer: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

export default Sidebar;
