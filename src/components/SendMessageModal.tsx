/**
 * Send Message Modal - Canned messages from driver data API (dark theme, search)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '../theme/colors';
import { useEmergency } from '../context/EmergencyContext';
import { useMessagingModal } from '../context/MessagingModalContext';
import { getDriverData, type DriverDataMessage } from '../api/driverData.api';
import { useDriverData } from '@/context/DriverDataContext';

const SendMessageModal: React.FC = () => {
  // const [messages, setMessages] = useState<DriverDataMessage[]>([]);
  const { messages } = useDriverData();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const { sendCannedMessage } = useEmergency();
  const { visible, close } = useMessagingModal();

  // useEffect(() => {
  //   if (!visible) return;
  //   setLoading(true);
  //   setMessages([]);
  //   setSearch('');
  //   setSelectedMessage(null);
  //   getDriverData()
  //     .then((data) => {
  //       const list = data?.messages;
  //       setMessages(Array.isArray(list) ? list : []);
  //     })
  //     .catch(() => setMessages([]))
  //     .finally(() => setLoading(false));
  // }, [visible]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((item) => item.message?.toLowerCase().includes(q));
  }, [messages, search]);

  const handleSelectMessage = useCallback((message: string) => {
    setSelectedMessage(message);
  }, []);

  const handleSendMessage = useCallback((selectedMessage: string) => {
    if (selectedMessage) {
      sendCannedMessage(selectedMessage);
      close();
      setSelectedMessage(null);
    }
  }, [sendCannedMessage, close]);

  const handleCancel = useCallback(() => {
    close();
    setSelectedMessage(null);
  }, [close]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent={Platform.OS === 'android'}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={[StyleSheet.absoluteFill, styles.modalOverlay]} onPress={handleCancel}>
        <Pressable style={styles.modalContent} onPress={() => { }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Send Message</Text>
            <View style={styles.modalTitleSpacer} />
          </View>
          {!loading && (
            <View style={styles.searchRow}>
              <MaterialIcons
                name="search"
                size={20}
                color={COLORS.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                placeholder="Search messages"
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading messages…</Text>
            </View>
          ) : filteredMessages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {search.trim() ? 'No messages match your search' : 'No messages'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.messageList}
              showsVerticalScrollIndicator={false}
            >
              {filteredMessages.map((item) => (
                <TouchableOpacity
                  key={item.messageID}
                  style={[
                    styles.messageItem,
                    // selectedMessage === item.message && styles.messageItemSelected,
                  ]}
                  onPress={() => handleSendMessage(item.message)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.messageText,
                      selectedMessage === item.message && styles.messageTextSelected,
                    ]}
                  >
                    {item.message}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {/* {selectedMessage && !loading && (
            <TouchableOpacity
              style={styles.sendConfirmButton}
              onPress={handleSendMessage}
              activeOpacity={0.7}
            >
              <Text style={styles.sendConfirmText}>Send</Text>
            </TouchableOpacity>
          )} */}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: '70%',
    maxHeight: '80%',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.accentBlue,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalTitleSpacer: {
    width: 60,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
  loadingContainer: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  emptyWrap: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  messageList: {
    maxHeight: 340,
    paddingVertical: 8,
  },
  messageItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  messageItemSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 2,
    borderColor: COLORS.emergency,
    borderRadius: 8,
  },
  messageText: {
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  messageTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  sendConfirmButton: {
    margin: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default SendMessageModal;
