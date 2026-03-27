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
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';
import { useDriverData } from '@/context/DriverDataContext';
import {
  getAvailableBlockManifests,
  assignBlockManifest,
  type BlockManifest,
} from '@/api/manifests.api';
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
  const { selectedRoute, selectedManifestId, setSelectedManifestId, selectRouteOrStatus, vehicleId } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { routes, isLoading: routesLoading, error: routesError, refetch } = useDriverData();

  const [activeTab, setActiveTab] = useState<Tab>('route');

  // Block tab state
  const [blocks, setBlocks] = useState<BlockManifest[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [assigningID, setAssigningID] = useState<number | null>(null);

  const fetchBlocks = useCallback(async () => {
    setBlocksLoading(true);
    setBlocksError(null);
    try {
      const available = await getAvailableBlockManifests();
      setBlocks(available);
    } catch (e) {
      setBlocksError(e instanceof Error ? e.message : 'Failed to load blocks');
    } finally {
      setBlocksLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'block' && blocks.length === 0 && !blocksLoading) {

    }
  }, [blocks.length, blocksLoading]);

  // Reset tab when modal opens
  React.useEffect(() => {

    setActiveTab('route');
    fetchBlocks();
    setBlocksError(null);

  }, [visible]);

  const handleSelectRoute = (value: string, routeId?: string | null) => {
    selectRouteOrStatus(value, routeId);
    onClose();
  };

  const handleSelectBlock = async (block: BlockManifest) => {
    if (!vehicleId || vehicleId === '110') {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a vehicle' });
      return
    }
    setAssigningID(block.manifestID);
    try {
      const ok = await assignBlockManifest(block.manifestID, vehicleId);
      console.log('Block Assigned Resp====>>>', ok)
      if (ok) {
        // selectRouteOrStatus(block.name, String(block.manifestID));
        // setSelectedManifestId(block.manifestID);
        onClose();
        Toast.show({ type: 'success', text1: 'Success', text2: 'Block assigned successfully' });
      } else {
        setBlocksError('Assignment failed. Please try again.');
      }
    } catch (e) {
      setBlocksError(e instanceof Error ? e.message : 'Assignment failed');
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
    if (route.shortName && route.longName && route.longName !== route.shortName) {
      return `${route.shortName} – ${route.longName}`;
    }
    return route.shortName || route.longName || route.routeID;
  };

  // ── Layout ──────────────────────────────────────────────────────────────────

  const edgePadding = Math.max(MIN_EDGE_PADDING, Math.round(width * EDGE_PADDING_RATIO));
  const bottomOffset = BOTTOM_BAR_HEIGHT + (insets.bottom || 0) + 12;
  const modalWidth = Math.min(Math.max(MIN_MODAL_WIDTH, Math.round(width * 0.88)), MAX_MODAL_WIDTH);
  const maxModalHeight = Math.min(
    height - insets.top - bottomOffset - 24,
    Math.max(400, Math.round(height * 0.6))
  );
  const routeTabCenterX = (5 / 8) * width;
  const baseLeft = routeTabCenterX - modalWidth / 2;
  const modalLeft = Math.max(0, Math.min(baseLeft, width - modalWidth - edgePadding));

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderRouteItem = ({ item }: { item: typeof combinedRouteList[number] }) => {
    if (item.type === 'fixed') {
      const isSelected = selectedRoute === item.label;
      return (
        <TouchableOpacity
          style={[styles.listItem, isSelected && styles.listItemSelected]}
          onPress={() => handleSelectRoute(item.label, null)}
          activeOpacity={0.7}
        >
          <Text style={styles.itemName}>{item.label}</Text>
          {isSelected && <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />}
        </TouchableOpacity>
      );
    }
    const label = getRouteLabel(item.route);
    const isSelected = selectedRoute === label;
    return (
      <TouchableOpacity
        style={[styles.listItem, isSelected && styles.listItemSelected, item.disabled && styles.listItemDisabled]}
        onPress={() => { if (!item.disabled) handleSelectRoute(label, item.route.routeID); }}
        activeOpacity={item.disabled ? 1 : 0.7}
        disabled={item.disabled}
      >
        <Text style={[styles.itemName, item.disabled && styles.itemNameDisabled]}>{label}</Text>
        {isSelected && !item.disabled && <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />}
      </TouchableOpacity>
    );
  };

  const renderBlockItem = ({ item }: { item: BlockManifest }) => {
    // console.log('SelectedId===>>>', selectedManifestId)
    const isAssigning = assigningID === item.manifestID;
    // const isSelected = selectedManifestId === item.manifestID;
    return (
      <TouchableOpacity
        // style={[styles.listItem, isSelected && styles.listItemSelected]}
        style={[styles.listItem]}
        onPress={() => handleSelectBlock(item)}
        activeOpacity={0.7}
        disabled={assigningID !== null}
      >
        <Text style={styles.itemName}>{item.name}</Text>
        {isAssigning
          ? <ActivityIndicator size="small" color={COLORS.accentBlue} />
          // : isSelected
          //   ? <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
          : null}
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
          <View style={[styles.modal, { width: modalWidth, maxHeight: maxModalHeight }]}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Select</Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'route' && styles.tabActive]}
                onPress={() => handleTabChange('route')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === 'route' && styles.tabTextActive]}>Route</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'block' && styles.tabActive]}
                onPress={() => handleTabChange('block')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === 'block' && styles.tabTextActive]}>Block</Text>
              </TouchableOpacity>
            </View>

            {/* Route Tab Content */}
            {activeTab === 'route' && (
              routesLoading && combinedRouteList.length === 0 ? (
                <View style={styles.centerWrap}>
                  <ActivityIndicator size="large" color={COLORS.accentBlue} />
                  <Text style={styles.statusText}>Loading routes…</Text>
                </View>
              ) : routesError && combinedRouteList.length === 0 ? (
                <View style={styles.centerWrap}>
                  <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                  <Text style={styles.statusText}>{routesError}</Text>
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
                  <Text style={styles.statusText}>Loading blocks…</Text>
                </View>
              ) : blocksError ? (
                <View style={styles.centerWrap}>
                  <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                  <Text style={styles.statusText}>{blocksError}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={fetchBlocks}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : blocks.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Text style={styles.statusText}>No blocks available</Text>
                </View>
              ) : (
                <FlatList
                  data={blocks}
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
    backgroundColor: COLORS.background,
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
    borderTopColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.surface,
  },
  cancelBtn: { minWidth: 56 },
  cancelText: { color: COLORS.accentBlue, fontSize: 16 },
  title: { flex: 1, textAlign: 'center', color: COLORS.textPrimary, fontSize: 17, fontWeight: '600' },
  headerSpacer: { minWidth: 56 },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.surface,
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
    color: COLORS.textMuted,
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
    borderBottomColor: COLORS.surface,
  },
  listItemSelected: {
    backgroundColor: COLORS.surface,
  },
  listItemDisabled: {
    opacity: 0.4,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  itemNameDisabled: {
    color: COLORS.textMuted,
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
    color: COLORS.textSecondary,
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
