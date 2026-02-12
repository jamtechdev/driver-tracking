/**
 * Sidebar - Clean navigation drawer
 * Settings, Brightness, Map, Message, Checklist, Proceed if Safe
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;
  const { driver, serviceStatus } = useAuth();
  const { setBrightnessVisible, brightnessVisible } = useBrightness();
  const { open: openMessagingModal, visible: messagingModalVisible } = useMessagingModal();
  const { open: openSettingsModal, visible: settingsModalVisible } = useSettingsModal();
  const { open: openMapModal, visible: mapModalVisible } = useMapModal();
  const { open: openChecklistModal, visible: checklistModalVisible } = useChecklistModal();
  const isDrawer = variant === 'drawer' || width < 600;
  const isLoggedOut = !driver || driver.role === 'unassigned';

  const currentRoute = useNavigationState((state) => {
    const route = state?.routes?.[state.index];
    return route?.name ?? '';
  });

  const handleNav = (screen: string) => {
    onNavPress?.();
    if (screen === 'Brightness') {
      setBrightnessVisible(!brightnessVisible);
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

  const handlePower = () => {
    onNavPress?.();
    if (isLoggedOut) return;
    // Power / device control placeholder
  };

  const topInset = insets.top;
  const scale = Math.min(width / 380, 1.3);
  const itemIconSize = Math.max(24, Math.round(28 * scale));
  const itemFontSize = Math.max(12, Math.round(12 * scale));
  const proceedFontSize = Math.max(12, Math.round(16 * scale));
  const powerIconSize = Math.max(26, Math.round(28 * scale));

  const content = (
    <>
      <View style={styles.abovePower}>
        <View style={[styles.itemsWrap, { paddingTop: topInset }]}>
          {SIDEBAR_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemBlock}
              onPress={() => handleNav(item.id)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={item.icon as any}
                size={itemIconSize}
                color={COLORS.sidebarTextIcon}
                style={styles.itemIcon}
              />
              <Text style={[styles.itemLabel, { fontSize: itemFontSize }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.proceedSeparator} />
        <TouchableOpacity
          style={[styles.proceedBar, isLoggedOut && styles.proceedBarDisabled]}
          onPress={handleProceed}
          activeOpacity={0.85}
          disabled={isLoggedOut}
        >
          <Text style={[styles.proceedBarText, { fontSize: proceedFontSize, lineHeight: proceedFontSize + 3 }]}>
            Proceed{'\n'}if Safe
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.powerSeparator} />
      <Pressable
        style={[
          styles.powerButton,
          {
            height: BOTTOM_BAR_HEIGHT - 8 + insets.bottom,
            minHeight: BOTTOM_BAR_HEIGHT - 8 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          isLoggedOut && styles.powerButtonDisabled,
        ]}
        onPress={handlePower}
        disabled={isLoggedOut}
        android_ripple={null}
      >
        <MaterialIcons
          name="power-settings-new"
          size={powerIconSize}
          color={isLoggedOut ? COLORS.navBarIconDisabled : COLORS.sidebarTextIcon}
        />
      </Pressable>
    </>
  );

  if (isDrawer) {
    return <View style={styles.drawer}>{content}</View>;
  }

  return (
    <View style={[styles.sidebar, isTablet && styles.sidebarTablet, isLandscape && styles.sidebarLandscape]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 88,
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLORS.sidebarItemBg,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderRightWidth: 1,
    borderRightColor: COLORS.sidebarBorder,
  },
  sidebarTablet: {
    width: '100%',
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sidebarLandscape: {
    height: '40%',
  },
  abovePower: {
    flex: 1,
    minHeight: 0,
  },
  itemsWrap: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLORS.sidebarItemBg,
    minHeight: 0,
  },
  itemBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.sidebarItemBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sidebarSeparator,
    minHeight: 0,
  },
  itemIcon: {
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.sidebarTextIcon,
  },
  proceedSeparator: {
    height: 1,
    backgroundColor: COLORS.sidebarSeparator,
  },
  proceedBar: {
    height: 56,
    backgroundColor: COLORS.sidebarProceed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedBarDisabled: {
    opacity: 0.6,
  },
  proceedBarText: {
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  powerSeparator: {
    height: 1,
    backgroundColor: COLORS.sidebarSeparator,
  },
  powerButton: {
    backgroundColor: COLORS.sidebarItemBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerButtonDisabled: {
    opacity: 0.6,
  },
  drawer: {
    flex: 1,
    flexDirection: 'column',
    width: 280,
    minHeight: '100%',
    backgroundColor: COLORS.sidebarItemBg,
    paddingTop: 0,
    borderRightWidth: 1,
    borderRightColor: COLORS.sidebarBorder,
  },
});

export default Sidebar;
