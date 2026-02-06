/**
 * Vehicle Select Modal - Fetch vehicles from driver data API, list them, call select API on choose.
 * Uses agencyID 121 from config. Vehicle data from api.peaktransit.com controller=driver&action=data.
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
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import Toast from 'react-native-toast-message';
import { API_CONFIG, DRIVER_VEHICLE_SELECT_BASE_URL } from '../config/api.config';
import { getDriverData } from '../api/driverData.api';
import axios from 'axios';

const SIDEBAR_WIDTH = 120;

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
  const [search, setSearch] = useState('');

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
      setSearch('');
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

  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const contentWidth = isTablet ? width - SIDEBAR_WIDTH : width;
  const modalWidth = Math.min(contentWidth - 48, isTablet ? 380 : 460);
  const maxModalHeight = height - insets.top - insets.bottom - 48;

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

  const filteredVehicles = vehicles.filter((item) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    const label = (
      (item.vehicleName as string | undefined) ||
      (item.vehicleNumber as string | undefined) ||
      (item.vehicleID as string | undefined) ||
      ''
    ).toString().toLowerCase();
    return label.includes(query);
  });

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
            <View
              style={[
                styles.modal,
                { width: modalWidth, maxHeight: maxModalHeight },
                isTablet && styles.modalCompact,
              ]}
            >
              <View>
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
                <View style={styles.searchRow}>
                  <MaterialIcons
                    name="search"
                    size={20}
                    color={COLORS.textSecondary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    placeholder="Search by vehicle name or ID"
                    placeholderTextColor={COLORS.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    style={styles.searchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
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
              ) : filteredVehicles.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No vehicles match your search</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredVehicles}
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
                        <MaterialIcons
                          name="directions-bus"
                          size={22}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.vehicleName}>{displayLabel(item)}</Text>
                        {isSelected && (
                          <MaterialIcons
                            name="check"
                            size={22}
                            color={COLORS.accentBlue}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  style={[
                    styles.list,
                    isTablet ? styles.listCompact : { maxHeight: maxModalHeight - 80 },
                  ]}
                  showsVerticalScrollIndicator={false}
                />
              )}
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
    maxHeight: 520,
  },
  listCompact: {
    maxHeight: 420,
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
    maxHeight: 520,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  searchIcon: {
    marginTop: 1,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#1F242C',
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  list: {
    maxHeight: 440,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  errorWrap: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
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
    color: COLORS.textMuted,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  vehicleItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  vehicleName: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});

export default VehicleSelectModal;
