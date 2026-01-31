/**
 * Sidebar - Clean navigation drawer
 * Settings, Brightness, Map, Message, Checklist, Proceed if Safe
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Pressable, ScrollView } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useBrightness } from '../context/BrightnessContext';

interface SidebarProps {
  navigation: any;
  onProceedIfSafe?: () => void;
  onNavPress?: () => void;
  variant?: 'compact' | 'drawer';
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
}) => {
  const { width } = Dimensions.get('window');
  const { driver, logout, serviceStatus } = useAuth();
  const { setBrightnessVisible } = useBrightness();
  const isDrawer = variant === 'drawer' || width < 600;

  const handlePower = () => {
    onNavPress?.();
    if (!driver || driver.role === 'unassigned') return;
    logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleNav = (screen: string) => {
    onNavPress?.();
    if (screen === 'Brightness') {
      setBrightnessVisible(true);
      return;
    }
    if (screen === 'Settings') {
      navigation.navigate('Settings');
      return;
    }
    navigation.navigate(screen);
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
          {SIDEBAR_ITEMS.map((item) => (
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
          ))}
        </ScrollView>
        <View style={styles.drawerFooter}>
          <Pressable
            style={[styles.powerButton, (!driver || driver.role === 'unassigned') && styles.powerButtonDisabled]}
            onPress={handlePower}
            disabled={!driver || driver.role === 'unassigned'}
            android_ripple={null}
          >
            <View style={[styles.powerIconWrap, (!driver || driver.role === 'unassigned') && styles.powerIconWrapDisabled]}>
              <MaterialIcons
                name="power-settings-new"
                size={22}
                color={(!driver || driver.role === 'unassigned') ? 'rgba(255,255,255,0.35)' : '#F87171'}
              />
            </View>
            <Text style={[styles.powerLabel, (!driver || driver.role === 'unassigned') && styles.powerLabelDisabled]}>
              Power
            </Text>
          </Pressable>
          <View style={[
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
          </View>
          <TouchableOpacity
            style={styles.proceedButtonDrawer}
            onPress={handleProceed}
            activeOpacity={0.7}
          >
            <Text style={styles.proceedTextDrawer}>Proceed if Safe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sidebar}>
      <View style={styles.navItems}>
        {SIDEBAR_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.navItem}
            onPress={() => handleNav(item.id)}
            activeOpacity={0.6}
          >
            <MaterialIcons name={item.icon as any} size={24} color="rgba(255,255,255,0.8)" style={styles.navIcon} />
            <Text style={styles.navLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.proceedButton}
        onPress={handleProceed}
        activeOpacity={0.7}
      >
        <Text style={styles.proceedText}>Proceed if Safe</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 72,
    backgroundColor: '#252A32',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  navItems: {
    flex: 1,
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 2,
  },
  navIcon: {
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontWeight: '500',
  },
  proceedButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  proceedText: {
    color: '#FFFFFF',
    fontSize: 10,
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
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  powerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  powerButtonDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  powerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  powerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FCA5A5',
  },
  powerLabelDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  powerIconWrapDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  proceedTextDrawer: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});

export default Sidebar;
