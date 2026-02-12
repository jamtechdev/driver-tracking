/**
 * Select Route Modal - Popover above "Out of Service" / Route tab with bottom pointer.
 * Same design as Select Driver: white card, Cancel + title, list with checkmarks.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getDriverData } from '../api/driverData.api';
import { BOTTOM_BAR_HEIGHT } from '../utils/constants';

const MIN_MODAL_WIDTH = 280;
const MAX_MODAL_WIDTH = 440;
const EDGE_PADDING_RATIO = 0.04;
const MIN_EDGE_PADDING = 12;
const MODAL_BG = '#FFFFFF';

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

// In-memory cache so we only hit the driver data API once per app session.
let cachedRoutes: DriverRouteItem[] | null = null;
let routesPromise: Promise<DriverRouteItem[]> | null = null;

const loadRoutesOnce = async (): Promise<DriverRouteItem[]> => {
  if (cachedRoutes) return cachedRoutes;
  if (routesPromise) return routesPromise;

  routesPromise = (async () => {
    try {
      const data = await getDriverData();
      const list = data.route;
      const normalized = Array.isArray(list) ? list : [];
      cachedRoutes = normalized;
      return normalized;
    } finally {
      routesPromise = null;
    }
  })();

  return routesPromise;
};

interface SelectRouteModalProps {
  visible: boolean;
  onClose: () => void;
}

const SelectRouteModal: React.FC<SelectRouteModalProps> = ({ visible, onClose }) => {
  const { selectedRoute, selectRouteOrStatus } = useAuth();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [routes, setRoutes] = useState<DriverRouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadRoutesOnce();
      setRoutes(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load routes';
      setError(message);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && !routes.length && !loading && !error) {
      loadRoutes();
    }
  }, [visible, loadRoutes, routes.length, loading, error]);

  const handleSelect = (value: string, routeId?: string | null) => {
    selectRouteOrStatus(value, routeId);
    onClose();
  };

  const allOptions = useMemo(() => {
    // "Out of Service" is always first, then enabled routes, then disabled routes.
    const outOfService = [{ kind: 'fixed' as const, label: 'Out of Service' }];

    const enabled: { kind: 'route'; route: DriverRouteItem }[] = [];
    const disabled: { kind: 'route'; route: DriverRouteItem }[] = [];

    routes.forEach((r) => {
      const isDisabled =
        r.disabled === true ||
        r.disabled === 1 ||
        r.disabled === '1';
      const target = isDisabled ? disabled : enabled;
      target.push({ kind: 'route', route: r });
    });

    return { outOfService, enabled, disabled };
  }, [routes]);

  const combinedList = useMemo(() => {
    type Row =
      | { type: 'fixed'; key: string; label: string }
      | { type: 'route'; key: string; route: DriverRouteItem; disabled: boolean };

    const rows: Row[] = [];

    allOptions.outOfService.forEach((o) => {
      rows.push({ type: 'fixed', key: 'out-of-service', label: o.label });
    });

    allOptions.enabled.forEach(({ route }) => {
      rows.push({
        type: 'route',
        key: route.routeID,
        route,
        disabled: false,
      });
    });

    allOptions.disabled.forEach(({ route }) => {
      rows.push({
        type: 'route',
        key: `${route.routeID}-disabled`,
        route,
        disabled: true,
      });
    });

    return rows;
  }, [allOptions]);

  const getRouteLabel = (route: DriverRouteItem) => {
    if (route.shortName && route.longName && route.longName !== route.shortName) {
      return `${route.shortName} – ${route.longName}`;
    }
    return route.shortName || route.longName || route.routeID;
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
  // Route tab is 3rd of 4: center at 5/8 width
  const routeTabCenterX = (5 / 8) * width;
  const minLeft = 0;
  const maxRight = width - modalWidth - edgePadding;
  const baseLeft = routeTabCenterX - modalWidth / 2;
  const modalLeft = Math.max(minLeft, Math.min(baseLeft, maxRight));

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
              <Text style={styles.title}>Select Route</Text>
              <View style={styles.headerSpacer} />
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.accentBlue} />
                <Text style={styles.loadingText}>Loading routes…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorWrap}>
                <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadRoutes}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : combinedList.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No routes available</Text>
              </View>
            ) : (
              <FlatList
                data={combinedList}
                keyExtractor={(row) => row.key}
                renderItem={({ item }) => {
                  if (item.type === 'fixed') {
                    const isSelected = selectedRoute === item.label;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.routeItem,
                          isSelected && styles.routeItemSelected,
                        ]}
                        onPress={() => handleSelect(item.label, null)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.routeName}>{item.label}</Text>
                        {isSelected && (
                          <MaterialIcons name="check" size={22} color={COLORS.accentBlue} />
                        )}
                      </TouchableOpacity>
                    );
                  }

                  const label = getRouteLabel(item.route);
                  const isSelected = selectedRoute === label;
                  const disabled = item.disabled;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.routeItem,
                        isSelected && styles.routeItemSelected,
                        disabled && styles.routeItemDisabled,
                      ]}
                      onPress={() => {
                        if (disabled) return;
                        handleSelect(label, item.route.routeID);
                      }}
                      activeOpacity={disabled ? 1 : 0.7}
                      disabled={disabled}
                    >
                      <Text
                        style={[
                          styles.routeName,
                          disabled && styles.routeNameDisabled,
                        ]}
                      >
                        {label}
                      </Text>
                      {isSelected && !disabled && (
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
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  routeItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  routeItemDisabled: {
    opacity: 0.5,
  },
  routeName: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  routeNameDisabled: {
    color: '#8E8E93',
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

export default SelectRouteModal;
