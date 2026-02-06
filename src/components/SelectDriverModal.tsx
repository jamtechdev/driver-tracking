/**
 * Select Driver Modal - Choose driver from list (centered, light style)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  useWindowDimensions,
  Platform,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRIVERS, type Driver } from '../data/drivers';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_WIDTH = 120;

interface SelectDriverModalProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

const SelectDriverModal: React.FC<SelectDriverModalProps> = ({
  visible,
  onClose,
  navigation,
}) => {
  const { driver: currentDriver, login } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const handleSelectDriver = (driver: Driver) => {
    onClose();
    if (driver.role === 'unassigned') {
      login(driver);
      return;
    }
    if (driver.requiresPin) {
      navigation.navigate('PinEntry', { driver });
    } else {
      login(driver);
    }
  };

  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const contentWidth = isTablet ? width - SIDEBAR_WIDTH : width;
  const modalWidth = Math.min(contentWidth - 48, isTablet ? 340 : 440);
  const maxModalHeight = height - insets.top - insets.bottom - 48;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.overlayWrapper, isTablet && styles.rootTablet]}>
          {isTablet && (
            <Pressable style={styles.sidebarBackdrop} onPress={onClose} />
          )}
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={[
              styles.modal,
              { width: modalWidth, maxHeight: maxModalHeight },
              isTablet && styles.modalCompact,
            ]}>
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Select Driver</Text>
                <View style={styles.headerSpacer} />
              </View>
              <FlatList
                data={DRIVERS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = currentDriver?.id === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.driverItem,
                        isSelected && styles.driverItemSelected,
                      ]}
                      onPress={() => handleSelectDriver(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.driverName}>{item.name}</Text>
                      {isSelected && (
                        <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                style={[styles.list, isTablet ? styles.listCompact : { maxHeight: maxModalHeight - 80 }]}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  rootTablet: {
    flexDirection: 'row',
  },
  sidebarBackdrop: {
    width: SIDEBAR_WIDTH,
  },
  modalCompact: {
    maxHeight: 420,
  },
  listCompact: {
    maxHeight: 320,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#252A32',
    borderRadius: 16,
    maxHeight: 420,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.accentBlue,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: 60,
  },
  list: {
    maxHeight: 340,
  },
  driverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  driverItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  driverName: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});

export default SelectDriverModal;
