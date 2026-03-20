/**
 * Select Driver Modal - Popover on left with pointer to bottom bar driver button
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Driver } from '../data/drivers';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { usePinEntryModal } from '../context/PinEntryModalContext';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';
import { useDriverData } from '@/context/DriverDataContext';

const SIDEBAR_WIDTH = 120;
const MIN_MODAL_WIDTH = 280;
const MAX_MODAL_WIDTH = 440;
const EDGE_PADDING_RATIO = 0.04; // 4% of screen min padding each side
const MIN_EDGE_PADDING = 12;

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
  const { open: openPinEntry } = usePinEntryModal();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { drivers: rawDrivers, isLoading } = useDriverData();

  // Map raw API drivers → Driver shape and prepend Unassigned
  const drivers: Driver[] = useMemo(() => {
    const mapped: Driver[] = rawDrivers.map((d) => ({
      id: String(d.driverID),
      name: d.driverName || 'Unknown Driver',
      role: (d.supervisor === 1 || d.supervisor === '1') ? 'supervisor' : 'driver',
      requiresPin: !!d.code,
      pin: d.code ?? undefined,
    }));
    return [
      { id: 'unassigned', name: 'Unassigned', role: 'unassigned', requiresPin: false },
      ...mapped,
    ];
  }, [rawDrivers]);

  const handleSelectDriver = async (driver: Driver) => {
    onClose();
    if (driver.role === 'unassigned') {
      login(driver);
      return;
    }
    if (driver.requiresPin) {
      openPinEntry(driver);
    } else {
      login(driver);
    }
  };

  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const edgePadding = Math.max(MIN_EDGE_PADDING, Math.round(width * EDGE_PADDING_RATIO));
  const bottomOffset = BOTTOM_BAR_HEIGHT + (insets.bottom || 0) ;
  const modalWidth = Math.min(
    Math.max(MIN_MODAL_WIDTH, Math.round(width * 0.88)),
    MAX_MODAL_WIDTH
  );
  const maxModalHeight = Math.min(
    height - insets.top - bottomOffset - 24,
    Math.max(400, Math.round(height * 0.6))
  );
  // Center modal and pointer on driver tab (first of 4 items); allow overlap with sidebar
  const driverTabCenterX = width / 8;
  const OFFSET_RIGHT_PX = Math.round(width * 0.05); // ~5% so scales with screen
  const minLeft = 0;
  const maxRight = width - modalWidth - edgePadding;
  const baseLeft = Math.max(minLeft, driverTabCenterX - modalWidth / 2);
  const modalLeft = Math.min(
    Math.max(minLeft, baseLeft + OFFSET_RIGHT_PX),
    maxRight
  );

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
      <View style={styles.backdropRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.popoverWrap,
            {
              bottom: bottomOffset,
              left: modalLeft,
              width: modalWidth,
            },
          ]}
        >
          <View style={[styles.modal, { width: modalWidth, maxHeight: maxModalHeight }]}>
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

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading drivers...</Text>
              </View>
            ) : (
              <FlatList
                data={drivers}
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
                style={[styles.list, { maxHeight: maxModalHeight - 56 }]}
                showsVerticalScrollIndicator={false}
              />
            )}

          </View>
          <View style={styles.pointer} />
        </View>
      </View>
    </Modal>
  );
};

const MODAL_BG = '#FFFFFF';

const styles = StyleSheet.create({
  backdropRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popoverWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  pointer: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(177, 174, 174, 0.08)',
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
    color: '#FFF',
  },
  headerSpacer: {
    width: 60,
  },
  list: {
    maxHeight: 440,
  },
  driverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(177, 174, 174, 0.08)',
  },
  driverItemSelected: {
    // backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  driverName: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
});

export default SelectDriverModal;
