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
  const { brightnessVisible, setBrightnessVisible, brightness, setBrightness } = useBrightness();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

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

  return (
    <SidebarProvider value={sidebarApi}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          {brightnessVisible && (
            <View style={styles.brightnessSection}>
              <View style={styles.brightnessHeader}>
                <MaterialIcons name="wb-sunny" size={24} color={COLORS.primary} />
                <Text style={styles.brightnessTitle}>Brightness</Text>
                <TouchableOpacity
                  onPress={() => setBrightnessVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <Slider
                style={styles.brightnessSlider}
                minimumValue={0}
                maximumValue={100}
                value={brightness}
                onValueChange={setBrightness}
                minimumTrackTintColor={COLORS.accentBlue}
                maximumTrackTintColor="#374151"
                thumbTintColor="#FFFFFF"
                step={1}
              />
              {Platform.OS === 'android' && (
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
          )}
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
        </View>

        <View style={styles.bottomBarWrapper}>
          <BottomBar
            navigation={navigation}
            onDriverPress={openDriverModal}
          />
        </View>
        <SelectDriverModal
          visible={driverModalVisible}
          onClose={closeDriverModal}
          navigation={navigation}
        />

        {isMobile && showSidebar && (
          <Modal
            visible={sidebarVisible}
            transparent
            animationType="none"
            statusBarTranslucent={Platform.OS === 'android'}
            onRequestClose={() => setSidebarVisible(false)}
          >
            <View style={styles.drawerOverlay}>
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
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingTop: 56,
    paddingBottom: 72,
    overflow: 'visible',
  },
  brightnessSection: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    backgroundColor: '#252A32',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brightnessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  brightnessTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  brightnessSlider: {
    width: '100%',
    height: 40,
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
    flex: 1,
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
