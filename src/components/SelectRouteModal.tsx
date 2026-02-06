/**
 * Select Route Modal - Choose route or Out of Service (centered, light style)
 * Routes are loaded once from the driver data API (same response that includes vehicles).
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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getDriverData } from '../api/driverData.api';

const SIDEBAR_WIDTH = 120;

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
  const [search, setSearch] = useState('');

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
    if (visible) {
      setSearch('');
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

  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allOptions;

    const match = (r: DriverRouteItem) => {
      const shortName = (r.shortName || '').toString().toLowerCase();
      const longName = (r.longName || '').toString().toLowerCase();
      const desc = (r.description || '').toString().toLowerCase();
      return shortName.includes(query) || longName.includes(query) || desc.includes(query);
    };

    return {
      outOfService: allOptions.outOfService.filter((o) =>
        'out of service'.includes(query)
      ),
      enabled: allOptions.enabled.filter((o) => match(o.route)),
      disabled: allOptions.disabled.filter((o) => match(o.route)),
    };
  }, [allOptions, search]);

  const combinedList = useMemo(() => {
    type Row =
      | { type: 'fixed'; key: string; label: string }
      | { type: 'route'; key: string; route: DriverRouteItem; disabled: boolean };

    const rows: Row[] = [];

    filteredRoutes.outOfService.forEach((o) => {
      rows.push({ type: 'fixed', key: 'out-of-service', label: o.label });
    });

    filteredRoutes.enabled.forEach(({ route }) => {
      rows.push({
        type: 'route',
        key: route.routeID,
        route,
        disabled: false,
      });
    });

    filteredRoutes.disabled.forEach(({ route }) => {
      rows.push({
        type: 'route',
        key: `${route.routeID}-disabled`,
        route,
        disabled: true,
      });
    });

    return rows;
  }, [filteredRoutes]);

  const getRouteLabel = (route: DriverRouteItem) => {
    if (route.shortName && route.longName && route.longName !== route.shortName) {
      return `${route.shortName} – ${route.longName}`;
    }
    return route.shortName || route.longName || route.routeID;
  };

  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || width >= 600;
  const contentWidth = isTablet ? width - SIDEBAR_WIDTH : width;
  const modalWidth = Math.min(contentWidth - 48, isTablet ? 380 : 460);
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
              <View>
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
                <View style={styles.searchRow}>
                  <MaterialIcons
                    name="search"
                    size={20}
                    color={COLORS.textSecondary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    placeholder="Search by route name"
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
                  <Text style={styles.emptyText}>No routes match your search</Text>
                </View>
              ) : (
                <FlatList
                  data={combinedList}
                  keyExtractor={(row) => row.key}
                  renderItem={({ item }) => {
                    if (item.type === 'fixed') {
                      const isSelected = selectedRoute === item.label;
                      const isOutOfService = item.label === 'Out of Service';
                      return (
                        <TouchableOpacity
                          style={[
                            styles.routeItem,
                            isSelected && styles.routeItemSelected,
                            isOutOfService && styles.routeItemOutOfService,
                          ]}
                          onPress={() => handleSelect(item.label, null)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.routeName,
                              isOutOfService && styles.routeNameOutOfService,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={22}
                              color={isOutOfService ? COLORS.emergency : COLORS.accentBlue}
                            />
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
                        <View style={styles.routeLabelRow}>
                          <Text
                            style={[
                              styles.routeName,
                              disabled && styles.routeNameDisabled,
                            ]}
                          >
                            {label}
                          </Text>
                        </View>
                        {disabled && (
                          <Text style={styles.disabledTag}>Disabled</Text>
                        )}
                        {isSelected && !disabled && (
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
  routeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  routeItemSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  routeItemOutOfService: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.emergency,
  },
  routeItemDisabled: {
    opacity: 0.5,
  },
  routeName: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  routeNameOutOfService: {
    color: COLORS.emergency,
    fontWeight: '600',
  },
  routeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routeNameDisabled: {
    color: COLORS.textMuted,
  },
  disabledTag: {
    marginLeft: 8,
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
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
});

export default SelectRouteModal;
