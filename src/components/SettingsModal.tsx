import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Switch,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  FlatList,
  ScrollView,
  Linking,
  useColorScheme,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo, { isTablet } from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { COLORS } from '../theme/colors';
import { useSettingsModal } from '../context/SettingsModalContext';
import { useAuth } from '../context/AuthContext';
import { useDriverModel } from '../context/DriverModelContext';
import { useDriverData } from '../context/DriverDataContext';
import { PEAK_DEFAULT_PARAMS } from '../config/env';
import { APP_CONSTANTS } from '@/utils/constants';
import { calculateDistance, calculateBearing, parseRoutePoints } from '../utils/helpers';

const MDT_ID_KEY = '@driver_tracking:mdt_id';
const { version } = require('../../package.json');
const APP_VERSION = `${version}`;

// ─── Debug sub-components ─────────────────────────────────────────────
const DebugSection: React.FC<{ title: string }> = React.memo(({ title }) => (
  <View style={debugStyles.sectionHeader}>
    <Text style={debugStyles.sectionHeaderText}>{title}</Text>
  </View>
));

const DebugRow: React.FC<{ label: string; value: string }> = React.memo(({ label, value }) => (
  <View style={debugStyles.row}>
    <Text style={debugStyles.rowLabel}>{label}</Text>
    <Text style={debugStyles.rowValue} numberOfLines={1} ellipsizeMode="tail">
      {value}
    </Text>
  </View>
));

interface DebugInfo {
  uuid: string;
  serial: string;
  osVersion: string;
  agencyId: string;
  agencyName: string;
  vehicleId: string;
  vehicleName: string;
  connectionType: string;
  ssid: string;
  gpsHorizontal: string;
  gpsVertical: string;
  cpuUsage: string;
  memUsage: string;
  appVersion: string;
  buildNumber: string;
  batteryLevel: string;
  batteryState: string;
  deviceName: string;
  deviceModel: string;
}

// ─── Debug Screen using FlatList ──────────────────────────────────────
const DebugScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { vehicleId, vehicleName, selectedRouteId } = useAuth();
  const { lastLocation, minsLate, nextStop, schedule, linkAverages, currentStopGeofence } =
    useDriverModel();
  const { agency, routes } = useDriverData();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const themeTextColor = isDarkMode ? '#FFFFFF' : '#1E293B';
  const themeSecondaryText = isDarkMode ? COLORS.textSecondary : '#64748B';
  const themeSurface = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.05)';
  const themeBorder = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.08)';

  const [info, setInfo] = useState<DebugInfo>({
    uuid: '—',
    serial: 'N/A',
    osVersion: '—',
    agencyId: String(PEAK_DEFAULT_PARAMS.agencyID),
    agencyName: '—',
    vehicleId: '—',
    vehicleName: '—',
    connectionType: '—',
    ssid: '—',
    gpsHorizontal: '—',
    gpsVertical: '—',
    cpuUsage: '—',
    memUsage: '—',
    appVersion: APP_VERSION,
    buildNumber: '—',
    batteryLevel: '—',
    batteryState: '—',
    deviceName: '—',
    deviceModel: '—',
  });

  // ─── Memoized calculations
  const atLink = useMemo(() => {
    if (!lastLocation || !selectedRouteId || !routes?.length) return -1;
    const currentRoute = routes.find(r => String(r.routeID) === String(selectedRouteId));
    if (!currentRoute?.points) return -1;
    const points = parseRoutePoints(currentRoute.points);
    if (!points.length) return -1;

    let closestIdx = -1;
    let minScore = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        points[i].latitude,
        points[i].longitude
      );
      let score = dist;
      const heading = lastLocation.heading;
      if (heading !== undefined && i < points.length - 1) {
        let bearingDiff = Math.abs(
          heading -
          calculateBearing(
            points[i].latitude,
            points[i].longitude,
            points[i + 1].latitude,
            points[i + 1].longitude
          )
        );
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        if (lastLocation.speed && lastLocation.speed > 1) score += bearingDiff * 0.5;
      }
      if (score < minScore) {
        minScore = score;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [lastLocation, selectedRouteId, routes]);

  const scheduledStop = useMemo(() => {
    if (!nextStop || !schedule?.length) return null;
    const idx = schedule.findIndex(s => s.link === nextStop.link && s.blockID === nextStop.blockID);
    for (let i = idx + 1; i < schedule.length; i++) {
      if (schedule[i].blockID === nextStop.blockID) return schedule[i];
    }
    return null;
  }, [nextStop, schedule]);

  const expectedLink = useMemo(() => {
    if (!schedule?.length || !nextStop) return -1;
    const now = new Date();
    const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const blockStops = schedule.filter(s => s.blockID === nextStop.blockID);
    const stop = blockStops.find(s => s.departureTime > seconds);
    return stop?.link ?? -1;
  }, [schedule, nextStop]);

  const calcTime = useCallback(
    (endLink: number) => {
      if (!linkAverages?.length || atLink === -1 || endLink === -1) return -1;
      let sum = 0;
      if (atLink <= endLink) {
        for (let i = atLink; i < endLink; i++) sum += linkAverages[i] || 0;
      } else {
        for (let i = atLink; i < linkAverages.length; i++) sum += linkAverages[i] || 0;
        for (let i = 0; i < endLink; i++) sum += linkAverages[i] || 0;
      }
      return sum;
    },
    [atLink, linkAverages]
  );

  const timeToNextStop = useMemo(() => calcTime(nextStop?.link ?? -1), [calcTime, nextStop]);
  const timeToScheduledStop = useMemo(
    () => calcTime(scheduledStop?.link ?? -1),
    [calcTime, scheduledStop]
  );

  // ─── Fetch Device Info
  const fetchInfo = useCallback(async () => {
    try {
      const [uuid, net, power, name, model, build] = await Promise.all([
        AsyncStorage.getItem(MDT_ID_KEY),
        NetInfo.fetch(),
        DeviceInfo.getPowerState(),
        DeviceInfo.getDeviceName(),
        DeviceInfo.getModel(),
        DeviceInfo.getBuildNumber(),
      ]);
      setInfo(prev => ({
        ...prev,
        uuid: uuid ?? DeviceInfo.getUniqueIdSync(),
        serial: DeviceInfo.getUniqueIdSync(),
        osVersion: `${Platform.OS} ${DeviceInfo.getSystemVersion()}`,
        agencyName: agency?.agencyName ?? '—',
        vehicleId: vehicleId ?? '—',
        vehicleName: vehicleName ?? '—',
        connectionType: net.type ?? '—',
        ssid: net?.details?.ssid ?? '—',
        gpsHorizontal: lastLocation?.accuracy?.toString() ?? '—',
        gpsVertical: lastLocation?.altitude?.toString() ?? '—',
        batteryLevel: `${Math.round((power.batteryLevel ?? 0) * 100)}%`,
        batteryState: power.batteryState ?? '—',
        deviceName: name,
        deviceModel: model,
        buildNumber: build,
      }));
    } catch (e) {
      console.warn('Debug fetch failed', e);
    }
  }, [agency, vehicleId, vehicleName, lastLocation]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const data = useMemo(
    () => [
      { type: 'section', title: 'IDENTIFIERS' },
      { type: 'row', label: 'UUID', value: info.uuid },
      { type: 'row', label: 'Serial #', value: info.serial },
      { type: 'row', label: 'OS Version', value: info.osVersion },
      { type: 'row', label: 'Agency ID', value: info.agencyId },
      { type: 'row', label: 'Agency Name', value: info.agencyName },
      { type: 'row', label: 'Vehicle ID', value: info.vehicleId },
      { type: 'row', label: 'Vehicle Name', value: info.vehicleName },

      { type: 'section', title: 'CONNECTIVITY' },
      { type: 'row', label: 'Connection Type', value: info.connectionType },
      { type: 'row', label: 'SSID', value: info.ssid },
      { type: 'row', label: 'GPS Horizontal', value: info.gpsHorizontal },
      { type: 'row', label: 'GPS Vertical', value: info.gpsVertical },

      { type: 'section', title: 'LINK CALCULATION' },
      { type: 'row', label: 'At Link', value: String(atLink) },
      { type: 'row', label: 'Expected Link', value: String(expectedLink) },
      { type: 'row', label: 'Driver Model Mins Late', value: minsLate?.toString() ?? 'N/A' },

      // { type: 'section', title: 'STOP GEOFENCE' },
      // { type: 'row', label: 'Inside Geofence', value: currentStopGeofence?.name ?? 'N/A' },
      // { type: 'row', label: 'Geofence ID', value: currentStopGeofence?.geofenceID ?? 'N/A' },

      { type: 'section', title: 'NEXT STOP' },
      { type: 'row', label: 'Name', value: nextStop?.longName ?? 'N/A' },
      {
        type: 'row',
        label: 'Time To Stop (s)',
        value: timeToNextStop >= 0 ? String(timeToNextStop) : 'N/A',
      },

      { type: 'section', title: 'SCHEDULED STOP' },
      { type: 'row', label: 'Name', value: scheduledStop?.longName ?? 'N/A' },
      {
        type: 'row',
        label: 'Time To Stop (s)',
        value: timeToScheduledStop >= 0 ? String(timeToScheduledStop) : 'N/A',
      },
    ],
    [
      info,
      atLink,
      expectedLink,
      nextStop,
      scheduledStop,
      timeToNextStop,
      timeToScheduledStop,
      minsLate,
      currentStopGeofence,
    ]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) =>
      item.type === 'section' ? (
        <View style={[debugStyles.sectionHeader, { backgroundColor: themeSurface }]}>
          <Text style={[debugStyles.sectionHeaderText, { color: themeSecondaryText }]}>{item.title}</Text>
        </View>
      ) : (
        <View style={[debugStyles.row, { borderBottomColor: themeBorder }]}>
          <Text style={[debugStyles.rowLabel, { color: themeTextColor }]}>{item.label}</Text>
          <Text style={[debugStyles.rowValue, { color: themeSecondaryText }]} numberOfLines={1} ellipsizeMode="tail">
            {item.value}
          </Text>
        </View>
      ),
    [themeSurface, themeSecondaryText, themeTextColor, themeBorder]
  );

  return (
    <>
      <View style={[debugStyles.header, { borderBottomColor: themeBorder }]}>
        <TouchableOpacity style={debugStyles.backBtn} onPress={onBack}>
          <MaterialIcons name="chevron-left" size={22} color={COLORS.accentBlue} />
          <Text style={debugStyles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[debugStyles.headerTitle, { color: themeTextColor }]}>Debug</Text>
        <View style={{ width: 100 }} />
      </View>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(_: any, i: number) => i.toString()}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </>
  );
};

// ─── Sub-page header ───────────────────────────────────────────────
const SubPageHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const themeTextColor = isDarkMode ? '#FFFFFF' : '#1E293B';
  return (
    <View style={debugStyles.header}>
      <TouchableOpacity style={debugStyles.backBtn} onPress={onBack}>
        <MaterialIcons name="chevron-left" size={22} color={COLORS.accentBlue} />
        <Text style={debugStyles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={[debugStyles.headerTitle, { color: themeTextColor }]}>{title}</Text>
    </View>
  );
};

// ─── Changelog ───────────────────────────────────────────────
const CHANGELOG_DATA = [
  {
    version: '2.6.0',
    date: 'January 12, 2023',
    items: ['minor bug fixes', 'Removed deprecated API calls'],
  },
  {
    version: '2.4.3',
    date: 'January 9, 2018',
    items: ['minor bug fixes'],
  },
  {
    version: '2.4.1',
    date: 'January 9, 2018',
    items: [
      'full compatibility with the new "Devices" page in the Admin Portal',
      'manage your MDTs remotely',
      'supervisor authentication required for vehicle assignment',
      '24 - hour clock option',
      'UI improvements and bugfixes',
    ],
  },
  {
    version: '2.3.3',
    date: 'November 28, 2017',
    items: ['support for all iOS tablet screen sizes', 'B2B distribution support', 'bugfixes'],
  },
  {
    version: '2.3.2',
    date: 'October 13, 2017',
    items: ['release version for UMN'],
  },
  {
    version: '2.3.1',
    date: 'October 13, 2017',
    items: ['improved crash reports', 'UI icon refresh', 'bugfixes'],
  },
  {
    version: '2.3.0',
    date: 'October 5, 2017',
    items: ['stability improvements', 'iOS 11 support'],
  },
];

const ChangelogScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const themeTextColor = isDarkMode ? '#FFFFFF' : '#1E293B';
  const themeSecondaryText = isDarkMode ? COLORS.textSecondary : '#64748B';
  const themeMutedText = isDarkMode ? COLORS.textMuted : '#94A3B8';
  const themeBorder = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.08)';

  return (
    <>
      <SubPageHeader title="Changelog" onBack={onBack} />
      <ScrollView
        style={debugStyles.scroll}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        nestedScrollEnabled>
        {CHANGELOG_DATA.map((item, idx) => (
          <View key={idx} style={[changelogStyles.versionBlock, { borderBottomColor: themeBorder }]}>
            <View style={changelogStyles.header}>
              <Text style={[changelogStyles.versionText, { color: themeTextColor }]}>{item.version}</Text>
              <Text style={[changelogStyles.dateText, { color: themeMutedText }]}>{item.date}</Text>
            </View>
            <View style={changelogStyles.content}>
              {item.items.map((change, cIdx) => (
                <View key={cIdx} style={changelogStyles.itemRow}>
                  <Text style={[changelogStyles.bullet, { color: isDarkMode ? COLORS.backgroundSecondary : '#CCC' }]}>-</Text>
                  <Text style={[changelogStyles.itemText, { color: themeSecondaryText }]}>{change}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
};

const changelogStyles = StyleSheet.create({
  versionBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 17,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 13,
  },
  content: {
    paddingLeft: 4,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 14,
    color: COLORS.backgroundSecondary,
    marginRight: 8,
    marginTop: 2,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});

// ─── Acknowledgements ───────────────────────────────────────────────
const ACKNOWLEDGEMENTS_DATA = [
  {
    name: 'InAppSettingsKit',
    info: 'Copyright (c) 2009-2014:\nLuc Vandal, Edovia Inc., http://www.edovia.com\nOrtwin Gentz, FutureTap GmbH, http://www.futuretap.com\nAll rights reserved.',
    url: 'https://github.com/futuretap/InAppSettingsKit',
  },
  {
    name: 'EDSemver',
    info: 'Copyright (c) 2013 Andrew Sliwinski',
    url: 'https://github.com/thisandagain/semver',
  },
  {
    name: 'Reachability',
    info: 'Copyright (c) 2011-2013, Tony Million.\nAll rights reserved.',
    url: 'https://github.com/tonymillion/Reachability',
  },
  {
    name: 'CocoaAsyncSocket',
    info: 'Public Domain',
    url: 'https://github.com/robbiehanson/CocoaAsyncSocket',
  },
  {
    name: 'LTHPasscodeViewController',
    info: 'Copyright (c) 2013 Roland Leth',
    url: 'https://github.com/rolandleth/LTHPasscodeViewController',
  },
  {
    name: 'Toast',
    info: 'Copyright (c) 2011-2017 Charles Scalesse.',
    url: 'https://github.com/scalessec/Toast',
  },
];

const AcknowledgementsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const isDarkMode = useColorScheme() === 'dark';
  const themeTextColor = isDarkMode ? '#FFFFFF' : '#1E293B';
  const themeSecondaryText = isDarkMode ? COLORS.textSecondary : '#64748B';
  const themeBorder = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.08)';

  const handlePressLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
  };

  return (
    <>
      <SubPageHeader title="Acknowledgements" onBack={onBack} />
      <ScrollView
        style={debugStyles.scroll}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        nestedScrollEnabled>
        <View style={[ackStyles.intro, { borderBottomColor: themeBorder }]}>
          <Text style={[ackStyles.introText, { color: themeSecondaryText }]}>
            This application uses Open Source components. You can find the source code of their open
            source projects along with license information below. We acknowledge and are grateful to
            these developers for their contributions to open source.
          </Text>
        </View>

        {ACKNOWLEDGEMENTS_DATA.map((item, idx) => (
          <View key={idx} style={[ackStyles.row, { borderBottomColor: themeBorder }]}>
            <View style={ackStyles.rowTop}>
              <Text style={[ackStyles.libName, { color: themeTextColor }]}>{item.name}</Text>
              <TouchableOpacity onPress={() => handlePressLink(item.url)}>
                <MaterialIcons name="open-in-new" size={18} color={COLORS.accentBlue} />
              </TouchableOpacity>
            </View>
            <Text style={[ackStyles.libInfo, { color: themeSecondaryText }]}>{item.info}</Text>
            <TouchableOpacity onPress={() => handlePressLink(item.url)}>
              <Text style={ackStyles.linkText}>{item.url}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
};

// ─── Main Settings Modal ───────────────────────────────────────────────
const SettingsModal: React.FC = () => {
  const [mdtId, setMdtId] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<
    'main' | 'debug' | 'changelog' | 'acknowledgements'
  >('main');
  const { visible, anchorY, close, use24HourClock, setUse24HourClock } = useSettingsModal();
  const { width, height } = useWindowDimensions();

  const SIDEBAR_WIDTH = 88;
  const MODAL_WIDTH = Math.min(400, width - SIDEBAR_WIDTH - 16);
  const MODAL_HEIGHT = height * 0.85;
  const computedTop =
    anchorY !== null
      ? Math.max(8, Math.min(anchorY - 30, height - MODAL_HEIGHT - 8))
      : height * 0.08;

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const modalBg = isDarkMode ? COLORS.background : '#FFFFFF';
  const themeTextColor = isDarkMode ? '#FFFFFF' : '#1E293B';
  const themeSecondaryText = isDarkMode ? COLORS.textSecondary : '#64748B';
  const themeSurface = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.05)';
  const themeBorder = isDarkMode ? COLORS.surface : 'rgba(0,0,0,0.08)';

  useEffect(() => {
    if (!visible) {
      setCurrentPage('main');
      return;
    }
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(MDT_ID_KEY);
        let result = storedId?.endsWith('-') ? storedId.slice(0, -1) : storedId;
        if (result) setMdtId(result);
        else {
          const uniqueId = await DeviceInfo.getUniqueId();
          const cleanId = uniqueId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          setMdtId(
            `BPT-${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(
              12,
              16
            )}-${cleanId.slice(16, 20)}`
          );
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (mdtId) AsyncStorage.setItem(MDT_ID_KEY, mdtId);
  }, [mdtId]);

  const handle24HourToggle = (value: boolean) => setUse24HourClock(value);

  const navItems = [
    { id: 'Debug', label: 'Debug' },
    { id: 'Changelog', label: 'Changelog' },
    { id: 'Acknowledgements', label: 'Acknowledgements' },
  ];

  const handleNavItem = (id: string) => {
    if (id === 'Debug') setCurrentPage('debug');
    else if (id === 'Changelog') setCurrentPage('changelog');
    else if (id === 'Acknowledgements') setCurrentPage('acknowledgements');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape-left',
        'landscape-right',
      ]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <View
          style={[styles.arrowLeft, { top: computedTop + 52, left: SIDEBAR_WIDTH + 1, borderRightColor: modalBg }]}
          pointerEvents="none"
        />
        <Pressable
          style={[
            styles.modalContent,
            {
              top: computedTop,
              left: isTablet() ? SIDEBAR_WIDTH + 14 : 15,
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              backgroundColor: modalBg,
              shadowColor: isDarkMode ? '#000' : '#888',
            },
          ]}
          onPress={() => { }}>
          {currentPage === 'debug' ? (
            <DebugScreen onBack={() => setCurrentPage('main')} />
          ) : currentPage === 'changelog' ? (
            <ChangelogScreen onBack={() => setCurrentPage('main')} />
          ) : currentPage === 'acknowledgements' ? (
            <AcknowledgementsScreen onBack={() => setCurrentPage('main')} />
          ) : (
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: themeTextColor }]}>MDT Settings</Text>
                <TouchableOpacity onPress={close}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeSecondaryText }]}>DISPLAY</Text>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: themeTextColor }]}>Use a 24-hour clock</Text>
                  <Switch
                    value={use24HourClock}
                    onValueChange={handle24HourToggle}
                    trackColor={{ false: themeSurface, true: COLORS.primary }}
                    thumbColor={COLORS.primary}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeSecondaryText }]}>DEVICE INFORMATION</Text>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: themeTextColor }]}>MDT ID</Text>
                  <Text style={[styles.rowValue, { fontSize: 14, color: themeSecondaryText }]}>{mdtId || '—'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, { color: themeTextColor }]}>App Version</Text>
                  <Text style={[styles.rowValue, { fontSize: 14, color: themeSecondaryText }]}>{APP_VERSION}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeSecondaryText }]}>NAVIGATION</Text>
                {navItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.navItem, { borderBottomColor: themeBorder }]}
                    onPress={() => handleNavItem(item.id)}>
                    <Text style={[styles.navLabel, { color: themeTextColor }]}>{item.label}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={isDarkMode ? '#fff' : '#1E293B'} />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default SettingsModal;

// ─── STYLES ───────────────────────────────────────────────
const styles = StyleSheet.create({
  modalContent: {
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.background,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  doneText: { color: COLORS.accentBlue, fontSize: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: COLORS.textSecondary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, color: COLORS.textSecondary },
  navItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: COLORS.surface,
    borderBottomWidth: 1,
  },
  navLabel: { fontSize: 16 },
  arrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    borderRightWidth: 10,
    position: 'absolute',
  },
});

// ─── Debug Screen Styles ───────────────────────────────────────────────
const debugStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 15 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 4, color: COLORS.accentBlue },
  headerTitle: { fontWeight: '600', fontSize: 18 },
  scroll: { flex: 1 },
  sectionHeader: { paddingVertical: 6, paddingHorizontal: 12 },
  sectionHeaderText: { fontWeight: '700', color: COLORS.textSecondary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomColor: COLORS.surface,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, color: COLORS.textSecondary },
});

const ackStyles = StyleSheet.create({
  intro: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  libName: {
    fontSize: 16,
    fontWeight: '700',
  },
  libInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  linkText: {
    fontSize: 12,
    color: COLORS.accentBlue,
    textDecorationLine: 'underline',
  },
});
