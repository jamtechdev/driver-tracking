/**
 * Select Route Modal - Popover above "Out of Service" / Route tab with bottom pointer.
 * Same design as Select Driver: white card, Cancel + title, list with checkmarks.
 * Tabs: Route | Block
 */

import React, { useMemo, useState, useCallback } from 'react';
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
  useColorScheme,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';
import { useDriverData } from '@/context/DriverDataContext';
import {
  getAvailableBlockManifests,
  getManifestsForToday,
  assignBlockToVehicle,
  getManifestAssignmentsByVehicle,
  deleteManifestAssignment,
  releaseVehicleForOutOfService,
  type BlockManifest,
} from '@/api/manifests.api';
import { selfUpdateAssignment } from '@/api/position.api';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { isAssignedRouteId } from '@/utils/helpers';
import Toast from 'react-native-toast-message';

const MIN_MODAL_WIDTH = 280;
const MAX_MODAL_WIDTH = 440;
const EDGE_PADDING_RATIO = 0.04;
const MIN_EDGE_PADDING = 12;

interface DriverRouteItem {
  routeID: string;
  agencyID?: string;
  shortName?: string;
  longName?: string;
  description?: string;
  disabled?: string | number | boolean;
  hidden?: string | number | boolean;
  [key: string]: unknown;
}

interface SelectRouteModalProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = 'route' | 'block';

const SelectRouteModal: React.FC<SelectRouteModalProps> = ({ visible, onClose }) => {
  const {
    driver,
    selectedRoute,
    selectedManifestId,
    serviceStatus,
    selectRouteOrStatus,
    vehicleId,
  } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { routes, isLoading: routesLoading, error: routesError, refetch } = useDriverData();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Theme colors
  const modalBg = isDarkMode ? COLORS.background : '#FFFFFF';
  const themeTextColor = isDarkMode ? COLORS.textPrimary : '#1E293B';
  const themeSecondaryText = isDarkMode ? COLORS.textSecondary : '#64748B';
  const themeSurface = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.04)';
  const themeBorder = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.08)';
  const themeMutedText = isDarkMode ? COLORS.textMuted : '#94A3B8';

  const [activeTab, setActiveTab] = useState<Tab>('route');

  // Block tab state
  const [blocks, setBlocks] = useState<BlockManifest[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [assigningID, setAssigningID] = useState<number | null>(null);
  /** Route row key while assigning: 'oos' or routeID string. */
  const [assigningRouteKey, setAssigningRouteKey] = useState<string | null>(null);
  /** Block assigned on server when auth selectedManifestId is not set yet. */
  const [resolvedActiveManifestId, setResolvedActiveManifestId] = useState<number | null>(null);
  const fetchBlocks = useCallback(async () => {
    setBlocksLoading(true);
    setBlocksError(null);
    try {
      const [available, allManifests] = await Promise.all([
        getAvailableBlockManifests(),
        getManifestsForToday(),
      ]);

      const byId = new Map<number, BlockManifest>();
      for (const block of available) {
        byId.set(block.manifestID, block);
      }

      let activeManifestId = selectedManifestId != null ? Number(selectedManifestId) : null;

      if (activeManifestId == null && vehicleId && vehicleId !== '110') {
        const assignments = await getManifestAssignmentsByVehicle(vehicleId);
        const activeAssignment = assignments.find((a) => !a.disabled);
        if (activeAssignment) {
          activeManifestId = activeAssignment.manifestID;
        }
      }
      setResolvedActiveManifestId(activeManifestId);

      if (activeManifestId != null && !byId.has(activeManifestId)) {
        const activeBlock = allManifests.find((m) => m.manifestID === activeManifestId);
        if (activeBlock) {
          byId.set(activeBlock.manifestID, activeBlock);
        }
      }

      const sorted = [...byId.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
      setBlocks(sorted);
    } catch (e) {
      setBlocksError(e instanceof Error ? e.message : 'Failed to load blocks');
    } finally {
      setBlocksLoading(false);
    }
  }, [selectedManifestId, vehicleId]);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (tab === 'block' && !blocksLoading) {
        fetchBlocks();
      }
    },
    [blocksLoading, fetchBlocks],
  );

  // Reset tab when modal opens
  React.useEffect(() => {
    if (!visible) return;
    setActiveTab('route');
    setResolvedActiveManifestId(null);
    setAssigningRouteKey(null);
    setAssigningID(null);
    fetchBlocks();
    setBlocksError(null);
  }, [visible, fetchBlocks]);

  const handleSelectRoute = async (value: string, routeId?: string | null) => {
    if (value === 'Out of Service') {
      if (!vehicleId || vehicleId === '110') {
        selectRouteOrStatus('Out of Service', null, null);
        onClose();
        return;
      }

      setAssigningRouteKey('oos');
      try {
        const result = await releaseVehicleForOutOfService({
          vehicleID: vehicleId,
          driverID: driver?.id == 'unassigned' ? '0' : String(driver?.id),
        });
        if (result.success) {
          selectRouteOrStatus('Out of Service', null, null);
          onClose();
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Vehicle is now Out of Service',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: result.errorMessage ?? 'Failed to set Out of Service',
          });
        }
      } catch (e) {
        console.error('[SelectRouteModal] Error setting Out of Service:', e);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to set Out of Service',
        });
      } finally {
        setAssigningRouteKey(null);
      }
      return;
    }

    const routeKey = routeId != null ? String(routeId) : value;
    setAssigningRouteKey(routeKey);
    try {
      if (vehicleId && vehicleId !== '110') {
        const existing = await getManifestAssignmentsByVehicle(vehicleId);
        for (const assignment of existing) {
          if (!assignment.disabled) {
            await deleteManifestAssignment(assignment.manifestAssignmentID);
          }
        }

        if (routeId != null && isAssignedRouteId(routeId)) {
          await selfUpdateAssignment({
            agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
            vehicleID: vehicleId,
            routeID: routeId,
            driverID: driver?.id == 'unassigned' ? '0' : String(driver?.id),
          });
        }
      }

      selectRouteOrStatus(value, routeId, null);
      onClose();
    } catch (e) {
      console.error('[SelectRouteModal] Error assigning route:', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to assign route',
      });
    } finally {
      setAssigningRouteKey(null);
    }
  };

  const handleSelectBlock = async (block: BlockManifest) => {
    if (!vehicleId || vehicleId === '110') {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a vehicle' });
      return;
    }

    if (block.manifestID === -1) {
      setAssigningID(-1);
      try {
        const result = await releaseVehicleForOutOfService({
          vehicleID: vehicleId,
          driverID: driver?.id == 'unassigned' ? '0' : String(driver?.id),
        });
        if (result.success) {
          selectRouteOrStatus('Out of Service', null, null);
          onClose();
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Vehicle is now Out of Service',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: result.errorMessage ?? 'Failed to set Out of Service',
          });
        }
      } catch (e) {
        console.error('[SelectRouteModal] Error setting Out of Service:', e);
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to set Out of Service' });
      } finally {
        setAssigningID(null);
      }
      return;
    }

    setAssigningID(block.manifestID);
    try {
      // ... existing logic ...
      // 1. Fetch existing assignments for this vehicle to unassign
      const existing = await getManifestAssignmentsByVehicle(vehicleId);
      console.log('Existing Assignments ===>>>', existing);
      for (const assignment of existing) {
        if (!assignment.disabled) {
          await deleteManifestAssignment(assignment.manifestAssignmentID);
        }
      }

      const result = await assignBlockToVehicle({
        block,
        vehicleID: vehicleId,
        driverID: driver?.id == 'unassigned' ? '0' : String(driver?.id),
      });

      if (result.success) {
        selectRouteOrStatus(block.name, result.routeID, block.manifestID);
        onClose();
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Block "${block.name}" assigned successfully`,
        });
      } else {
        const msg = result.errorMessage ?? 'Assignment failed. Please try again.';
        setBlocksError(msg);
        Toast.show({ type: 'error', text1: 'Error', text2: msg });
      }
    } catch (e) {
      setBlocksError(e instanceof Error ? e.message : 'Assignment failed');
      Toast.show({ type: 'error', text1: 'Error', text2: 'Assignment process failed' });
    } finally {
      setAssigningID(null);
    }
  };

  // ── Route list ──────────────────────────────────────────────────────────────

  const combinedRouteList = useMemo(() => {
    type Row =
      | { type: 'fixed'; key: string; label: string }
      | { type: 'route'; key: string; route: DriverRouteItem; disabled: boolean };

    const rows: Row[] = [{ type: 'fixed', key: 'out-of-service', label: 'Out of Service' }];

    const enabled: DriverRouteItem[] = [];
    const disabled: DriverRouteItem[] = [];
    routes.forEach((r) => {
      const isDisabled = r.disabled === true || r.disabled === 1 || r.disabled === '1';
      (isDisabled ? disabled : enabled).push(r);
    });

    enabled.forEach((route) => rows.push({ type: 'route', key: route.routeID, route, disabled: false }));
    disabled.forEach((route) => rows.push({ type: 'route', key: `${route.routeID}-d`, route, disabled: true }));

    return rows;
  }, [routes]);

  const getRouteLabel = (route: DriverRouteItem) => {
    // if (route.shortName && route.longName && route.longName !== route.shortName) {
    //   return `${route.shortName} – ${route.longName}`;
    // }
    return route.shortName || route.longName || route.routeID;
  };

  // ── Layout ──────────────────────────────────────────────────────────────────

  const edgePadding = Math.max(MIN_EDGE_PADDING, Math.round(width * EDGE_PADDING_RATIO));
  const bottomOffset = BOTTOM_BAR_HEIGHT + (insets.bottom);
  const modalWidth = Math.min(Math.max(MIN_MODAL_WIDTH, Math.round(width * 0.88)), MAX_MODAL_WIDTH);
  const maxModalHeight = Math.min(
    height - insets.top - bottomOffset - 24,
    Math.max(400, Math.round(height * 0.6))
  );
  const routeTabCenterX = (5 / 8) * width;
  const baseLeft = routeTabCenterX - modalWidth / 2;
  const modalLeft = Math.max(0, Math.min(baseLeft, width - modalWidth - edgePadding));

  // ── Render helpers ──────────────────────────────────────────────────────────

  const isAssigningAny = assigningRouteKey !== null || assigningID !== null;

  const renderRouteItem = ({ item }: { item: typeof combinedRouteList[number] }) => {
    if (item.type === 'fixed') {
      const isSelected = selectedRoute === item.label;
      const isAssigning = assigningRouteKey === 'oos';
      return (
        <TouchableOpacity
          style={[styles.listItem, isSelected && { backgroundColor: themeSurface }, { borderBottomColor: themeBorder }]}
          onPress={() => handleSelectRoute(item.label, null)}
          activeOpacity={0.7}
          disabled={isAssigningAny}
        >
          <Text style={[styles.itemName, { color: themeTextColor }]}>{item.label}</Text>
          {isAssigning ? (
            <ActivityIndicator size="small" color={COLORS.accentBlue} />
          ) : isSelected ? (
            <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
          ) : null}
        </TouchableOpacity>
      );
    }
    const label = getRouteLabel(item.route);
    const routeKey = String(item.route.routeID);
    const isSelected = selectedRoute === label;
    const isAssigning = assigningRouteKey === routeKey;
    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && { backgroundColor: themeSurface }, item.disabled && styles.listItemDisabled, { borderBottomColor: themeBorder }]}
        onPress={() => { if (!item.disabled) handleSelectRoute(label, item.route.routeID); }}
        activeOpacity={item.disabled ? 1 : 0.7}
        disabled={item.disabled || isAssigningAny}
      >
        <Text style={[styles.itemName, { color: themeTextColor }, item.disabled && { color: themeMutedText }]}>{label}</Text>
        {isAssigning ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : isSelected ? (
          <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
        ) : null}
      </TouchableOpacity>
    );
  };

  const activeBlockManifestId =
    serviceStatus === 'out_of_service'
      ? null
      : selectedManifestId != null
        ? Number(selectedManifestId)
        : resolvedActiveManifestId;

  const renderBlockItem = ({ item }: { item: BlockManifest }) => {
    const isAssigning = assigningID === item.manifestID;
    const isSelected =
      item.manifestID === -1
        ? serviceStatus === 'out_of_service'
        : activeBlockManifestId != null &&
          Number(item.manifestID) === activeBlockManifestId;

    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && { backgroundColor: themeSurface }, { borderBottomColor: themeBorder }]}
        onPress={() => handleSelectBlock(item)}
        activeOpacity={0.7}
        disabled={isAssigningAny}
      >
        <Text style={[styles.itemName, { color: themeTextColor }]}>{item.name}</Text>
        {isAssigning ? (
          <ActivityIndicator size="small" color={COLORS.accentBlue} />
        ) : isSelected ? (
          <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
        ) : null}
      </TouchableOpacity>
    );
  };

  const listMaxHeight = maxModalHeight - 56 - 40; // subtract header + tabs

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
        <View style={[styles.popoverWrap, { bottom: bottomOffset, left: modalLeft, width: modalWidth }]}>
          <View style={[styles.modal, { width: modalWidth, maxHeight: maxModalHeight, backgroundColor: modalBg }]}>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: themeBorder }]}>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: themeTextColor }]}>Select</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { borderBottomColor: themeBorder }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'route' && styles.tabActive]}
                onPress={() => handleTabChange('route')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: themeMutedText }, activeTab === 'route' && styles.tabTextActive]}>Route</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'block' && styles.tabActive]}
                onPress={() => handleTabChange('block')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: themeMutedText }, activeTab === 'block' && styles.tabTextActive]}>
                  Block
                </Text>
              </TouchableOpacity>
            </View>

            {/* Route Tab Content */}
            {activeTab === 'route' && (
              routesLoading && combinedRouteList.length === 0 ? (
                <View style={styles.centerWrap}>
                  <ActivityIndicator size="large" color={COLORS.accentBlue} />
                  <Text style={[styles.statusText, { color: themeSecondaryText }]}>Loading routes…</Text>
                </View>
              ) : routesError && combinedRouteList.length === 0 ? (
                <View style={styles.centerWrap}>
                  <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                  <Text style={[styles.statusText, { color: themeSecondaryText }]}>{routesError}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={combinedRouteList}
                  keyExtractor={(row) => row.key}
                  renderItem={renderRouteItem}
                  style={{ maxHeight: listMaxHeight }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  overScrollMode="never"
                />
              )
            )}

            {/* Block Tab Content */}
            {activeTab === 'block' && (
              blocksLoading ? (
                <View style={styles.centerWrap}>
                  <ActivityIndicator size="large" color={COLORS.accentBlue} />
                  <Text style={[styles.statusText, { color: themeSecondaryText }]}>Loading blocks…</Text>
                </View>
              ) : blocksError ? (
                <View style={styles.centerWrap}>
                  <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                  <Text style={[styles.statusText, { color: themeSecondaryText }]}>{blocksError}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={fetchBlocks}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={[{ manifestID: -1, name: 'Out of Service' } as BlockManifest, ...blocks]}
                  keyExtractor={(b) => String(b.manifestID)}
                  renderItem={renderBlockItem}
                  style={{ maxHeight: listMaxHeight }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  overScrollMode="never"
                />
              )
            )}
          </View>
          <View style={[styles.pointer, { borderTopColor: modalBg }]} />
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
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: { minWidth: 56 },
  cancelText: { color: COLORS.accentBlue, fontSize: 16 },
  title: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 17, fontWeight: '600' },
  headerSpacer: { minWidth: 56 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accentBlue,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.accentBlue,
    fontWeight: '600',
  },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemSelected: {
    // Handled dynamically
  },
  listItemDisabled: {
    opacity: 0.4,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  itemNameDisabled: {
    // Handled dynamically
  },

  // States
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SelectRouteModal;
