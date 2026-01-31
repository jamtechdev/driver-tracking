/**
 * MDT Settings Screen - Display, Device Info, Debug, Changelog, Acknowledgements
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../theme/colors';

const MDT_ID_KEY = '@driver_tracking:mdt_id';
const TIME_FORMAT_KEY = '@driver_tracking:time_format';

const generateMdtId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BPT-${segment(4)}-${segment(6)}`;
};

const { version } = require('../../../package.json');
const APP_VERSION = `${version} (746)`;

const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [mdtId, setMdtId] = useState<string>('');
  const [use24HourClock, setUse24HourClock] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedId, storedFormat] = await Promise.all([
          AsyncStorage.getItem(MDT_ID_KEY),
          AsyncStorage.getItem(TIME_FORMAT_KEY),
        ]);
        setMdtId(storedId || generateMdtId());
        setUse24HourClock(storedFormat === '24h');
      } catch {
        setMdtId(generateMdtId());
      }
    })();
  }, []);

  useEffect(() => {
    if (mdtId) {
      AsyncStorage.setItem(MDT_ID_KEY, mdtId);
    }
  }, [mdtId]);

  const handle24HourToggle = async (value: boolean) => {
    setUse24HourClock(value);
    await AsyncStorage.setItem(TIME_FORMAT_KEY, value ? '24h' : '12h');
  };

  const navItems = [
    { id: 'Debug', label: 'Debug' },
    { id: 'Changelog', label: 'Changelog' },
    { id: 'Acknowledgements', label: 'Acknowledgements' },
  ];

  const handleNavItem = (id: string) => {
    Alert.alert(id, 'Coming soon');
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['left']}>
      <View style={styles.container}>
        <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MDT Settings</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DISPLAY</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Use a 24-hour clock</Text>
                <Switch
                  value={use24HourClock}
                  onValueChange={handle24HourToggle}
                  trackColor={{ false: '#CBD5E1', true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DEVICE INFORMATION</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>MDT ID</Text>
                <Text style={styles.rowValue}>{mdtId || '—'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>App Version</Text>
                <Text style={styles.rowValue}>{APP_VERSION}</Text>
              </View>
            </View>

            <View style={styles.section}>
              {navItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.navItem}
                  onPress={() => handleNavItem(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.navLabel}>{item.label}</Text>
                  <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.footer}>
            Copyright © 2023 Bishop Peak Technology, Inc.
          </Text>
        </View>
        <Pressable style={styles.overlay} onPress={() => navigation.goBack()} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
  },
  panel: {
    width: '75%',
    maxWidth: 400,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
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
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accentBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  navItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  footer: {
    fontSize: 12,
    color: '#94A3B8',
    paddingHorizontal: 20,
    paddingVertical: 20,
    textAlign: 'center',
  },
});

export default SettingsScreen;
