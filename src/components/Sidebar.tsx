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
import ForgetPassword from '@/screens/auth/ForgetPassword';

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
  //  { id: 'forget', label: 'Forget', icon: 'assignment' },
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
  const brightnessItemRef = useRef<View>(null);

  const currentRoute = useNavigationState((state) => {
    const route = state?.routes?.[state.index];
    return route?.name ?? '';
  });

  const handleNav = (screen: string) => {
    onNavPress?.();
    if (screen === 'Brightness') {
      brightnessItemRef.current?.measureInWindow((_x, y, _w, h) => {
        setBrightnessVisible(!brightnessVisible, y + h / 2);
      });
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

  // ── Responsive icon & text sizing ──
  // Available height for sidebar items (subtract top inset, power button, separators)
  const sidebarAvailableHeight = height - topInset - BOTTOM_BAR_HEIGHT - 20;
  const itemCount = SIDEBAR_ITEMS.length;
  const perItemHeight = sidebarAvailableHeight / Math.max(itemCount, 1);

  // Scale based on per-item available height AND sidebar width
  const sidebarWidth = isTabletDevice ? 120 : (isMobile ? 280 : 88);
  const heightScale = Math.min(perItemHeight / 80, 1.6);   // 80px = baseline per-item height
  const widthScale = Math.min(sidebarWidth / 100, 1.4);     // 100px = baseline width
  const combinedScale = Math.min(heightScale, widthScale);

  let itemIconSize: number;
  let itemFontSize: number;
  let proceedFontSize: number;
  let powerIconSize: number;

  if (isTabletDevice) {
    if (isLandscape) {
      // Tablet landscape: generous width, less height
      itemIconSize = Math.round(Math.min(Math.max(20, 26 * combinedScale), 36));
      itemFontSize = Math.round(Math.min(Math.max(10, 11 * combinedScale), 15));
    } else {
      // Tablet portrait: lots of vertical space
      itemIconSize = Math.round(Math.min(Math.max(22, 28 * combinedScale), 40));
      itemFontSize = Math.round(Math.min(Math.max(11, 12 * combinedScale), 16));
    }
    proceedFontSize = Math.round(Math.min(Math.max(12, 14 * combinedScale), 18));
    powerIconSize = Math.round(Math.min(Math.max(24, 28 * combinedScale), 36));
  } else {
    // Phone
    if (isLandscape) {
      // Phone landscape: very limited height
      itemIconSize = Math.round(Math.min(Math.max(18, 24 * combinedScale), 30));
      itemFontSize = Math.round(Math.min(Math.max(9, 10 * combinedScale), 13));
    } else {
      // Phone portrait: standard
      itemIconSize = Math.round(Math.min(Math.max(22, 28 * combinedScale), 34));
      itemFontSize = Math.round(Math.min(Math.max(11, 12 * combinedScale), 15));
    }
    proceedFontSize = Math.round(Math.min(Math.max(12, 16 * combinedScale), 18));
    powerIconSize = Math.round(Math.min(Math.max(22, 28 * combinedScale), 32));
  }

  const content = (
    <>
      <View style={[styles.abovePower]}>

        <View style={[styles.itemsWrap, { paddingTop: topInset }]}>
          <ScrollView
            scrollEnabled={!isTabletDevice}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={isTabletDevice ? { flexGrow: 1, justifyContent: 'space-around' } : { flexGrow: 1 }}
          >
            {SIDEBAR_ITEMS.map((item) => {
              const iconMarginBottom = isLandscape
                ? Math.max(2, Math.round(4 * combinedScale))
                : Math.max(4, Math.round(8 * combinedScale));
              const itemPaddingVertical = isLandscape
                ? Math.max(4, Math.round(8 * combinedScale))
                : (isTabletDevice ? Math.max(8, Math.round(10 * combinedScale)) : Math.max(10, Math.round(15 * combinedScale)));

              return (
                <TouchableOpacity
                  key={item.id}
                  ref={
                    item.id === 'Settings'
                      ? settingsItemRef
                      : item.id === 'Brightness'
                      ? brightnessItemRef
                      : undefined
                  }
                  style={[
                    styles.itemBlock,
                    isTabletDevice ? styles.itemBlockTablet : styles.itemBlockMobile,
                    { paddingVertical: itemPaddingVertical },
                  ]}
                  onPress={() => handleNav(item.id)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={item.icon as any}
                    size={itemIconSize}
                    color={dynamicIconColor}
                    style={[styles.itemIcon, { marginBottom: iconMarginBottom }]}
                  />
                  <Text style={[styles.itemLabel, { fontSize: itemFontSize }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
    <View style={[styles.sidebar, isTablet && styles.sidebarTablet, isLandscape && styles.sidebarLandscape, { padding: insets.left, paddingHorizontal: 8 }]}>
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
  sidebarLandscape: {},
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
  },
  itemBlockMobile: {
    flex: 1,
  },
  itemIcon: {},
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
