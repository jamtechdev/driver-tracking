/**
 * Sidebar - Clean navigation drawer
 * Settings, Brightness, Map, Message, Checklist, Proceed if Safe
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Pressable, useColorScheme, ScrollView } from 'react-native';
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
  currentTab?: 'home' | 'map';
  onTabChange?: (tab: 'home' | 'map') => void;
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
  currentTab = 'home',
  onTabChange,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const dynamicIconColor = isDarkMode ? '#000000' : '#ffffff';
  const isLandscape = height < width;
  const { driver, serviceStatus } = useAuth();
  const { setBrightnessVisible, brightnessVisible } = useBrightness();
  const { open: openMessagingModal, visible: messagingModalVisible } = useMessagingModal();
  const { open: openSettingsModal, visible: settingsModalVisible } = useSettingsModal();
  const { open: openMapModal, visible: mapModalVisible } = useMapModal();
  const { open: openChecklistModal, visible: checklistModalVisible } = useChecklistModal();
  const isDrawer = variant === 'drawer' || width < 600;
  const isLoggedOut = !driver || driver.role === 'unassigned';
  // Ref to measure the Settings icon position for anchoring the modal
  const settingsItemRef = useRef<View>(null);

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
      settingsItemRef.current?.measureInWindow((_x, y, _w, h) => {
        openSettingsModal(y + h / 2);
      });
      return;
    }
    if (screen === 'Map') {
      onTabChange?.(currentTab === 'map' ? 'home' : 'map');
      return;
    }
    if (screen === 'PreTrip') {
      openChecklistModal();
      return;
    }
  };

  const handleProceed = () => {
    // onNavPress?.();
    // (onProceedIfSafe || (() => navigation.navigate('RouteSelection')))();
  };

  const handlePower = () => {
    onNavPress?.();
    if (isLoggedOut) return;
    // Power / device control placeholder
  };

  const isMobile = width < 600 || height < 600;
  const isTabletDevice = Math.max(width, height) >= 900;
  const isCompact = variant === 'compact' || isTabletDevice;
  const topInset = insets.top + (isMobile ? 20 : 0);
  const scale = Math.min(width / 380, 1.3);
  const itemIconSize = Math.max(24, Math.round(28 * scale));
  const itemFontSize = Math.max(12, Math.round(10 * scale));
  const proceedFontSize = Math.max(12, Math.round(16 * scale));
  const powerIconSize = Math.max(26, Math.round(28 * scale));

  const content = (
    <>
      <View style={[styles.abovePower]}>

        <View style={[styles.itemsWrap, { paddingTop: topInset }]}>
          <ScrollView
            scrollEnabled={!isTabletDevice}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={isTabletDevice ? { flexGrow: 1, justifyContent: 'space-around' } : { flexGrow: 1 }}
          >
            {SIDEBAR_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.id}
                ref={item.id === 'Settings' ? settingsItemRef : undefined}
                style={[
                  styles.itemBlock,
                  isTabletDevice ? styles.itemBlockTablet : styles.itemBlockMobile,
                ]}
                onPress={() => handleNav(item.id)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={item.icon as any}
                  size={isTabletDevice ? 24 : itemIconSize}
                  color={dynamicIconColor}
                  style={[styles.itemIcon, isTabletDevice && { marginBottom: 4 }]}
                />
                <Text style={[styles.itemLabel, { fontSize: isTabletDevice ? 11 : itemFontSize }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.proceedSeparator} />
        {/* <TouchableOpacity
          style={[styles.proceedBar, isLoggedOut && styles.proceedBarDisabled]}
          onPress={handleProceed}
          activeOpacity={0.85}
          disabled={isLoggedOut}
        >
          <Text style={[styles.proceedBarText, { fontSize: proceedFontSize, lineHeight: proceedFontSize + 3 }]}>
            Proceed{'\n'}if Safe
          </Text>
        </TouchableOpacity> */}
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
        {/* <MaterialIcons
          name="power-settings-new"
          size={powerIconSize}
          color={isLoggedOut ? COLORS.navBarIconDisabled : COLORS.sidebarTextIcon}
        /> */}
      </Pressable>
    </>
  );

  if (isDrawer) {
    return <View style={[styles.drawer, { paddingLeft: insets.left }]}>{content}</View>;
  }

  return (
    <View style={[styles.sidebar, isTablet && styles.sidebarTablet, isLandscape && styles.sidebarLandscape, { paddingLeft: insets.left + 10, paddingHorizontal: 8 }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.sidebarItemBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sidebarSeparator,
  },
  itemBlockTablet: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 10,
  },
  itemBlockMobile: {
    flex: 1,
    paddingVertical: 15,
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
