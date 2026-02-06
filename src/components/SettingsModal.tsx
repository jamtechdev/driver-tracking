/**
 * Settings Modal - MDT Settings in modal overlay
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';
import { useSettingsModal } from '../context/SettingsModalContext';

const MDT_ID_KEY = '@driver_tracking:mdt_id';
const TIME_FORMAT_KEY = '@driver_tracking:time_format';

const generateMdtId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `BPT-${segment(4)}-${segment(6)}`;
};

const { version } = require('../../package.json');
const APP_VERSION = `${version} (746)`;

const SettingsModal: React.FC = () => {
  const [mdtId, setMdtId] = useState<string>('');
  const [use24HourClock, setUse24HourClock] = useState(false);
  const { visible, close } = useSettingsModal();

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={[StyleSheet.absoluteFill, styles.overlay]} onPress={close}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>MDT Settings</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
                  trackColor={{ false: COLORS.surface, true: COLORS.primary }}
                  thumbColor={COLORS.primary}
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
                  <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.footer}>Copyright © 2023 Bishop Peak Technology, Inc.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '85%',
    backgroundColor: '#252A32',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accentBlue,
  },
  content: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  navItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  footer: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 20,
    paddingVertical: 20,
    textAlign: 'center',
  },
});

export default SettingsModal;
