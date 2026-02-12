/**
 * Vehicle Select Modal - Popover above Vehicle tab with bottom pointer.
 * Same design as Select Route / Select Driver: white card, Cancel + title, list with checkmarks.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import { API_CONFIG, DRIVER_VEHICLE_SELECT_BASE_URL } from '../config/api.config';
import { getDriverData } from '../api/driverData.api';
import axios from 'axios';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';

const MIN_MODAL_WIDTH = 280;
const MAX_MODAL_WIDTH = 440;
const EDGE_PADDING_RATIO = 0.04;
const MIN_EDGE_PADDING = 12;
const MODAL_BG = '#FFFFFF';

export interface VehicleItem {
  vehicleID?: string;
  vehicleNumber?: string;
  vehicleName?: string;
  [key: string]: unknown;
}

interface VehicleSelectModalProps {
  visible: boolean;
  onClose: () => void;
}

const VehicleSelectModal: React.FC<VehicleSelectModalProps> = ({ visible, onClose }) => {
  const { vehicleId, setVehicleId, setVehicleName, driver, selectedRouteId } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDriverData();
      const list = data?.vehicle;
      setVehicles(Array.isArray(list) ? list : []);
      // Toast is shown inside getDriverData
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load vehicles';
      setError(message);
      setVehicles([]);
      // Toast already shown in getDriverData
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchVehicles();
    }
  }, [visible, fetchVehicles]);

  const handleSelect = async (item: VehicleItem) => {
    const id = item.vehicleID ?? item.vehicleNumber ?? String(item.vehicleID ?? '');
    if (!id) return;

    try {
      const driverId = driver?.id ?? '';
      const routeID = selectedRouteId ?? '0';
      const selectUrl = `${DRIVER_VEHICLE_SELECT_BASE_URL}&routeID=${encodeURIComponent(routeID)}&vehicleID=${encodeURIComponent(id)}&driverID=${encodeURIComponent(driverId)}`;
      await axios.get(selectUrl, { timeout: API_CONFIG.TIMEOUT });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Vehicle selected',
        visibilityTime: 2000,
      });
    } catch (_e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: axios.isAxiosError(_e) ? (_e.response?.data as { errormsg?: string })?.errormsg ?? _e.message : 'Vehicle select failed',
        visibilityTime: 3000,
      });
      // Still set local state so UI updates; backend may vary
    }
    const name = item.vehicleName && String(item.vehicleName).trim().length > 0
      ? String(item.vehicleName)
      : undefined;
    const label = displayLabel(item);

    setVehicleId(id);
    setVehicleName(name ?? label);
    onClose();
  };

  const edgePadding = Math.max(MIN_EDGE_PADDING, Math.round(width * EDGE_PADDING_RATIO));
  const bottomOffset = BOTTOM_BAR_HEIGHT + (insets.bottom || 0) + 12;
  const modalWidth = Math.min(
    Math.max(MIN_MODAL_WIDTH, Math.round(width * 0.88)),
    MAX_MODAL_WIDTH
  );
  const maxModalHeight = Math.min(
    height - insets.top - bottomOffset - 24,
    Math.max(400, Math.round(height * 0.6))
  );
  // Vehicle tab is 2nd of 4: center at 3/8 width
  const vehicleTabCenterX = (3 / 8) * width;
  const minLeft = 0;
  const maxRight = width - modalWidth - edgePadding;
  const baseLeft = vehicleTabCenterX - modalWidth / 2;
  const modalLeft = Math.max(minLeft, Math.min(baseLeft, maxRight));

  const displayLabel = (item: VehicleItem) => {
    const name = item.vehicleName && String(item.vehicleName).trim().length > 0
      ? String(item.vehicleName)
      : undefined;
    const id = item.vehicleNumber ?? item.vehicleID;
    if (name && id) return `${name} (${id})`;
    if (name) return name;
    if (id) return String(id);
    return 'Vehicle';
  };

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
              <Text style={styles.title}>Select Vehicle</Text>
              <View style={styles.headerSpacer} />
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.accentBlue} />
                <Text style={styles.loadingText}>Loading vehicles…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorWrap}>
                <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicles}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : vehicles.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No vehicles available</Text>
              </View>
            ) : (
              <FlatList
                data={vehicles}
                keyExtractor={(item) =>
                  String(item.vehicleID ?? item.vehicleNumber ?? Math.random())
                }
                renderItem={({ item }) => {
                  const id = item.vehicleID ?? item.vehicleNumber ?? '';
                  const isSelected = vehicleId === id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.vehicleItem,
                        isSelected && styles.vehicleItemSelected,
                      ]}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.vehicleName}>{displayLabel(item)}</Text>
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
    backgroundColor: MODAL_BG,
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
    borderTopColor: MODAL_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
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
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 60,
  },
  list: {
    maxHeight: 440,
  },
  vehicleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  vehicleItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  vehicleName: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
  errorWrap: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
  },
});

export default VehicleSelectModal;
