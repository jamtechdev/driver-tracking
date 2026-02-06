/**
 * Messaging Screen - Incoming messages (polled every 5s) + Send Message
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIncomingMessages } from '../../context/IncomingMessagesContext';
import { useMessagingModal } from '../../context/MessagingModalContext';
import { COLORS } from '../../theme/colors';
import type { IncomingMessageItem } from '../../api/incomingMessages.api';

const MessagingScreen: React.FC<{ navigation: any }> = () => {
  const insets = useSafeAreaInsets();
  const { messages, loading, error, refetch } = useIncomingMessages();
  const { open: openSendModal } = useMessagingModal();

  const renderItem = ({ item }: { item: IncomingMessageItem }) => (
    <View style={styles.messageCard}>
      {item.userName ? (
        <Text style={styles.messageSender}>{item.userName}</Text>
      ) : null}
      <Text style={styles.messageBody}>{item.message}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={openSendModal}
          activeOpacity={0.8}
        >
          <MaterialIcons name="campaign" size={22} color="#FFF" />
          <Text style={styles.sendButtonText}>Send message</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.messageID ?? String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            loading && messages.length === 0 ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading messages…</Text>
              </View>
            ) : (
              <View style={styles.centered}>
                <MaterialIcons name="mail-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No incoming messages</Text>
                <Text style={styles.emptySubtext}>Messages refresh every 5 seconds</Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={loading && messages.length > 0}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  messageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  messageBody: {
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textMuted,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.emergency,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.accentBlue,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});

export default MessagingScreen;
