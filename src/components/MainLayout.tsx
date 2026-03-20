/**
 * Main Layout - Content + Bottom Bar + Modal sidebar
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  useWindowDimensions,
  Animated,
  Pressable,
  TouchableOpacity,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import Slider from 'react-native-sliders';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SidebarProvider } from '../context/SidebarContext';
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';
import SelectDriverModal from './SelectDriverModal';
import { useDriverModal } from '../context/DriverModalContext';
import { useBrightness } from '../context/BrightnessContext';
import { COLORS } from '../theme/colors';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';

interface MainLayoutProps {
  children: React.ReactNode;
  navigation: any;
  showSidebar?: boolean;
  currentTab?: 'home' | 'map';
  onTabChange?: (tab: 'home' | 'map') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  navigation,
  showSidebar = true,
  currentTab = 'home',
  onTabChange,
}) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { isOpen: driverModalVisible, open: openDriverModal, close: closeDriverModal } = useDriverModal();
  const { brightnessVisible, setBrightnessVisible, brightness, setBrightness, brightnessSupported } = useBrightness();
  const { width, height } = useWindowDimensions();
  // Use Platform.isPad for iPad (iPad Mini portrait = 744px, would fail width >= 768)
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const isMobile = !isTablet;
  const isLandscape = width > height;

  useEffect(() => {
    if (sidebarVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -280, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [sidebarVisible, slideAnim, fadeAnim]);

  const sidebarContent = (
    <Sidebar
      navigation={navigation}
      variant={isMobile ? 'drawer' : 'compact'}
      isTablet={isTablet}
      onNavPress={() => setSidebarVisible(false)}
      onProceedIfSafe={() => {
        setSidebarVisible(false);
        navigation.navigate('RouteSelection');
      }}
      currentTab={currentTab}
      onTabChange={onTabChange}
    />
  );

  const sidebarApi = React.useMemo(
    () => ({
      open: () => setSidebarVisible(true),
      close: () => setSidebarVisible(false),
    }),
    []
  );

  const mainContent = (
    <>
      {children}
      {isMobile && showSidebar && (
        <TouchableOpacity
          style={[styles.menuButton, isLandscape && styles.menuButtonLandscape]}
          onPress={() => setSidebarVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="menu" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <SidebarProvider value={sidebarApi}>
      <SafeAreaView
        style={styles.container}
        edges={[]}
      >
        {isTablet && showSidebar ? (
          <View style={styles.tabletRow}>
            <View style={styles.tabletSidebar}>
              {sidebarContent}
            </View>
            <View style={styles.tabletMain}>
              <View style={[styles.content, styles.contentTop]}>{mainContent}</View>
              <View style={styles.bottomBarWrapper}>
                <BottomBar
                  navigation={navigation}
                  onDriverPress={openDriverModal}
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.content, styles.contentTop]}>{mainContent}</View>
            <View style={styles.bottomBarWrapper}>
<BottomBar
              navigation={navigation}
              onDriverPress={openDriverModal}
            />
            </View>
          </>
        )}
        <SelectDriverModal
          visible={driverModalVisible}
          onClose={closeDriverModal}
          navigation={navigation}
        />

        {brightnessVisible && (
          <View style={styles.brightnessOverlayBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setBrightnessVisible(false)}
            />
            <View
              style={[
                styles.brightnessOverlay,
                isTablet && styles.brightnessOverlayTablet,
                {
                  top: Math.min(148, 80 + height * 0.12),
                  left: isTablet ? 120 : Math.max(12, width * 0.02),
                },
              ]}
            >
              <View style={styles.brightnessPillRow}>
                <View style={styles.brightnessPillPointer} />
                <View style={styles.brightnessCard}>
                  <Slider
                    value={brightness}
                    onValueChange={(v: number | number[]) => setBrightness(Array.isArray(v) ? v[0] : v)}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    minimumTrackTintColor="#007AFF"
                    maximumTrackTintColor="#8D8D8D"
                    thumbTintColor="#FFFFFF"
                    style={styles.brightnessSlider}
                    trackStyle={styles.brightnessTrack}
                    thumbStyle={styles.brightnessThumb}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {isMobile && showSidebar && (
          <Modal
            visible={sidebarVisible}
            transparent
            animationType="none"
            statusBarTranslucent={Platform.OS === 'android'}
            onRequestClose={() => setSidebarVisible(false)}
            presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
            supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
          >
            <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]}>
              <Animated.View
                style={[
                  styles.drawerContent,
                  { width: Math.min(280, Math.max(260, width * 0.85)), transform: [{ translateX: slideAnim }] },
                ]}
              >
                {sidebarContent}
              </Animated.View>
              <Pressable
                style={styles.drawerBackdrop}
                onPress={() => setSidebarVisible(false)}
              >
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.drawerBackdropBg, { opacity: fadeAnim }]}
                />
              </Pressable>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </SidebarProvider>
  );
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  tabletSidebar: {
    width: 120,
    backgroundColor: COLORS.sidebarItemBg,
    borderRightWidth: 1,
    borderRightColor: COLORS.sidebarBorder,
  },
  tabletMain: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    flex: 1,
    paddingBottom: BOTTOM_BAR_HEIGHT + 8,
    overflow: 'visible',
  },
  contentTop: {
    paddingTop: 0,
  },
  brightnessOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
  },
  brightnessOverlay: {
    position: 'absolute',
    top: 148,
    left: 16,
    alignItems: 'flex-start',
    width: '50%',
  },
  brightnessOverlayTablet: {
    left: 120,
  },
  brightnessPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    alignSelf: 'stretch',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  brightnessPillPointer: {
    width: 0,
    height: 0,
    borderTopWidth: 32,
    borderBottomWidth: 32,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#4A4A4A',
  },
  brightnessCard: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 25,
    borderRadius: 8,
    backgroundColor: '#4A4A4A',
    justifyContent: 'center',
  },
  brightnessSlider: {
    width: '100%',
    height: 24,
  },
  brightnessTrack: {
    height: 4,
    borderRadius: 2,
  },
  brightnessThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  menuButton: {
    position: 'absolute',
    top: 90,
    // left: 10,
    zIndex: 9999,
    elevation: 9999,
    width: 52,
    height: 52,
    borderRadius: 12,
    // backgroundColor: '#252A32',
    justifyContent: 'center',
    alignItems: 'center',
    // borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  menuButtonLandscape: {
    top: 12,
  },
  drawerOverlay: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: COLORS.sidebarItemBg,
  },
  drawerBackdrop: {
    flex: 1,
    height: '100%',
  },
  drawerBackdropBg: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});

export default MainLayout;
