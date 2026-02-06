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
import Slider from '@react-native-community/slider';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SidebarProvider } from '../context/SidebarContext';
import Sidebar from './Sidebar';
import BottomBar from './BottomBar';
import SelectDriverModal from './SelectDriverModal';
import { useDriverModal } from '../context/DriverModalContext';
import { useBrightness } from '../context/BrightnessContext';
import { COLORS } from '../theme/colors';

interface MainLayoutProps {
  children: React.ReactNode;
  navigation: any;
  showSidebar?: boolean;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  navigation,
  showSidebar = true,
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
          style={styles.menuButton}
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
          <View style={[styles.brightnessOverlay, isTablet && styles.brightnessOverlayTablet]}>
            <View style={styles.brightnessCard}>
              <View style={styles.brightnessHeader}>
                <View style={styles.brightnessTitleRow}>
                  <MaterialIcons name="brightness-6" size={20} color={COLORS.primary} />
                  <Text style={styles.brightnessTitle}>Screen brightness</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setBrightnessVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.brightnessCloseBtn}
                >
                  <MaterialIcons name="close" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.brightnessValueRow}>
                <TouchableOpacity
                  style={styles.brightnessStepBtn}
                  onPress={() => setBrightness(Math.max(0, brightness - 10))}
                  disabled={brightness <= 0}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="remove"
                    size={22}
                    color={brightness <= 0 ? COLORS.textMuted : COLORS.textPrimary}
                  />
                </TouchableOpacity>
                <Text style={styles.brightnessPercent}>{Math.round(brightness)}%</Text>
                <TouchableOpacity
                  style={styles.brightnessStepBtn}
                  onPress={() => setBrightness(Math.min(100, brightness + 10))}
                  disabled={brightness >= 100}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="add"
                    size={22}
                    color={brightness >= 100 ? COLORS.textMuted : COLORS.textPrimary}
                  />
                </TouchableOpacity>
              </View>
              <Slider
                style={styles.brightnessSlider}
                minimumValue={0}
                maximumValue={100}
                value={brightness}
                onValueChange={(v) => setBrightness(typeof v === 'number' ? v : Number(v))}
                minimumTrackTintColor={COLORS.primary}
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor="#FFFFFF"
                step={1}
              />
              <View style={styles.brightnessLabels}>
                <Text style={styles.brightnessLabelText}>Dim</Text>
                <Text style={styles.brightnessLabelText}>Bright</Text>
              </View>
              {brightnessSupported === false && (
                <Text style={styles.brightnessUnsupportedText}>
                  Brightness control isn’t available. Rebuild the app from Xcode or Android Studio and run again.
                </Text>
              )}
              {Platform.OS === 'ios' && brightnessSupported !== false && (
                <Text style={styles.brightnessSimulatorHint}>
                  In the iOS Simulator, brightness won’t change. Use a real iPhone or iPad to test.
                </Text>
              )}
              {Platform.OS === 'android' && brightnessSupported !== false && (
                <TouchableOpacity
                  style={styles.brightnessHint}
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.brightnessHintText}>
                    Not working? Enable "Modify system settings" in App Settings
                  </Text>
                </TouchableOpacity>
              )}
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
                  { transform: [{ translateX: slideAnim }] },
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
    backgroundColor: '#232931',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  tabletMain: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    flex: 1,
    paddingBottom: 72,
    overflow: 'visible',
  },
  contentTop: {
    paddingTop: 0,
  },
  brightnessOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 200,
    elevation: 200,
  },
  brightnessOverlayTablet: {
    left: 136,
    right: 16,
  },
  brightnessCard: {
    padding: 12,
    backgroundColor: 'rgba(37, 42, 50, 0.88)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  brightnessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brightnessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brightnessTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  brightnessCloseBtn: {
    padding: 2,
  },
  brightnessValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  brightnessStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brightnessPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 48,
    textAlign: 'center',
  },
  brightnessSlider: {
    width: '100%',
    height: 32,
  },
  brightnessLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  brightnessLabelText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  brightnessUnsupportedText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  brightnessSimulatorHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  brightnessHint: {
    marginTop: 8,
  },
  brightnessHintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
  },
  menuButton: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 9999,
    elevation: 9999,
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#252A32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  drawerOverlay: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  drawerContent: {
    width: 280,
    height: '100%',
    backgroundColor: '#0D1117',
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
