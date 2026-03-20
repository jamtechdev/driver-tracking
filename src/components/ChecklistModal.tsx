/**
 * Checklist Modal - Pre/Post inspection checklist (all item types, bottom bar)
 * Fetches checklist from API when opened; submits via API on Submit.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { launchImageLibrary } from 'react-native-image-picker';
import { COLORS } from '../theme/colors';
import { useChecklistModal } from '../context/ChecklistModalContext';
import { useAuth } from '../context/AuthContext';
import { PEAK_DEFAULT_PARAMS } from '../config/env';
import {
  getChecklist,
  submitChecklist,
  type ChecklistItemApi,
  type ChecklistSubmissionApi,
} from '../api/checklist.api';

type ItemStatus = 'pass' | 'fail' | 'na';

export type ChecklistItemType = 'boolean' | 'number' | 'date' | 'string' | 'image' | 'group';

interface ChecklistItem {
  id: string;
  name: string;
  itemType: ChecklistItemType;
  sequence: number;
  category?: string;
  status: ItemStatus;
  value: string;
  imageUri?: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function mapApiToItems(apiItems: ChecklistItemApi[], driverName?: string): ChecklistItem[] {
  const mapped = apiItems.map((a, index) => {
    const id = String(a.itemID ?? a.id ?? index + 1);
    const name = decodeHtmlEntities(a.itemName ?? a.name ?? 'Item');
    const itemType = (a.itemType ?? 'string') as ChecklistItemType;
    const seq = typeof a.sequence === 'number' ? a.sequence : parseInt(String(a.sequence ?? index), 10) || index;
    const isDriverName = /driver\s*name/i.test(name);
    const value = itemType === 'string' && isDriverName && driverName ? driverName : '';
    return {
      id,
      name,
      itemType,
      sequence: Number.isNaN(seq) ? index : seq,
      status: 'na' as ItemStatus,
      value,
    };
  });
  return mapped.sort((a, b) => a.sequence - b.sequence);
}

const ChecklistModal: React.FC = () => {
  const { visible, close } = useChecklistModal();
  const { vehicleId, driver } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [submissions, setSubmissions] = useState<ChecklistSubmissionApi[]>([]);
  const [showSubmissionsView, setShowSubmissionsView] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklistType, setChecklistType] = useState<'pre' | 'post'>('pre');
  const { width } = Dimensions.get('window');
  const isTablet = width >= 600;
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  const driverName = driver?.name ?? (driver as { displayName?: string })?.displayName ?? '';

  const fetchChecklist = useCallback(() => {
    const vid = vehicleId?.trim() || '';
    if (!vid) {
      setItems([]);
      setError('Select a vehicle first');
      return;
    }
    setError(null);
    setLoading(true);
    getChecklist(vid, agencyID)
      .then((data) => {
        setItems(mapApiToItems(data.items, driverName));
        setSubmissions(data.results ?? []);
        setExpandedIds({}); // start all collapsed so all question titles are visible
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load checklist');
        setItems([]);
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [vehicleId, agencyID, driverName, checklistType]);

  // When modal opens, fetch checklist; when it closes, reset submissions view
  useEffect(() => {
    if (!visible) {
      setShowSubmissionsView(false);
      return;
    }
    fetchChecklist();
  }, [visible, fetchChecklist]);

  const handleClear = useCallback(() => {
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        status: 'na' as ItemStatus,
        value: /driver\s*name/i.test(i.name) ? driverName : '',
        imageUri: undefined,
      }))
    );
  }, [driverName]);

  const handleSubmit = useCallback(async () => {
    if (!vehicleId || !driver?.id) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Vehicle and driver required' });
      return;
    }
    const payload = items.map((i) => {
      const entry: { itemID: string; status?: number; value?: string | number } = {
        itemID: i.id,
      };
      if (i.itemType === 'boolean') {
        entry.status = i.status === 'pass' ? 1 : i.status === 'fail' ? 0 : -1;
      }
      if (i.itemType === 'string' || i.itemType === 'number' || i.itemType === 'date') {
        if (i.value !== '') entry.value = i.itemType === 'number' ? Number(i.value) || 0 : i.value;
      }
      return entry;
    });
    const hasFail = items.some((i) => i.status === 'fail') ? 1 : 0;
    setSubmitting(true);
    try {
      await submitChecklist(vehicleId, driver.id, agencyID, hasFail as 0 | 1, payload);
      Toast.show({ type: 'success', text1: 'Success', text2: `${checklistType === 'pre' ? 'Pre-Trip' : 'Post-Trip'} checklist submitted` });
      close();
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: e instanceof Error ? e.message : 'Submit failed',
      });
    } finally {
      setSubmitting(false);
    }
  }, [vehicleId, driver?.id, agencyID, items, close]);

  const handleSubmissions = () => {
    setShowSubmissionsView(true);
  };

  const handleBackFromSubmissions = () => {
    setShowSubmissionsView(false);
  };

  const formatReceivedDate = (received?: string) => {
    if (!received) return '—';
    try {
      const d = new Date(received.replace(' ', 'T'));
      return isNaN(d.getTime()) ? received : d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return received;
    }
  };

  const handleDashboard = () => {
    close();
  };

  const setItemStatus = (id: string, status: ItemStatus) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const setItemValue = (id: string, value: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, value } : i)));
  };

  const setItemImage = (id: string, imageUri: string | undefined) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, imageUri } : i)));
  };

  const pickImage = (itemId: string) => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, (res) => {
      if (res.didCancel || !res.assets?.[0]?.uri) return;
      setItemImage(itemId, res.assets[0].uri);
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    items.forEach((i) => {
      if (i.itemType !== 'group') all[i.id] = true;
    });
    setExpandedIds(all);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  const statusText = loading
    ? 'Loading…'
    : error
      ? 'Error'
      : items.length > 0
        ? `${items.length} item(s)`
        : 'Empty (no vehicle or API returned nothing)';

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
        <Pressable
          style={[styles.modalContent, isTablet && styles.modalContentTablet]}
          onPress={() => { }}
        >
          <View style={styles.modalInner}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <Text style={styles.headerTitle}>Inspection Checklist</Text>
                <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, checklistType === 'pre' && styles.tabActive]}
                  onPress={() => setChecklistType('pre')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, checklistType === 'pre' && styles.tabTextActive]}>Pre-Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, checklistType === 'post' && styles.tabActive]}
                  onPress={() => setChecklistType('post')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, checklistType === 'post' && styles.tabTextActive]}>Post-Trip</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statusBar}>
              <Text style={styles.statusBarText} numberOfLines={1}>
                Vehicle: {vehicleId || 'none'} · {statusText}
              </Text>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {showSubmissionsView ? (
                <View style={styles.submissionsView}>
                  <TouchableOpacity style={styles.submissionsBackRow} onPress={handleBackFromSubmissions}>
                    <MaterialIcons name="arrow-back" size={22} color={COLORS.primary} />
                    <Text style={styles.submissionsBackText}>Back to checklist</Text>
                  </TouchableOpacity>
                  <Text style={styles.submissionsTitle}>Previous submissions</Text>
                  {submissions.length === 0 ? (
                    <View style={styles.emptySubmissionsWrap}>
                      <MaterialIcons name="history" size={40} color={COLORS.textMuted} />
                      <Text style={styles.emptySubmissionsText}>No previous submissions for this vehicle.</Text>
                    </View>
                  ) : (
                    <View style={styles.submissionsList}>
                      {submissions.map((s, index) => (
                        <View key={s.resultID ?? index} style={styles.submissionRow}>
                          <View style={styles.submissionRowLeft}>
                            <Text style={styles.submissionCode}>{s.code ?? `#${s.resultID ?? index + 1}`}</Text>
                            <Text style={styles.submissionReceived}>{formatReceivedDate(s.received)}</Text>
                          </View>
                          {s.resultID ? (
                            <Text style={styles.submissionId}>ID: {s.resultID}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading checklist…</Text>
                </View>
              ) : error ? (
                <View style={styles.errorWrap}>
                  <MaterialIcons name="error-outline" size={40} color={COLORS.emergency} />
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={fetchChecklist}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : items.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <MaterialIcons name="assignment" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No checklist items</Text>
                  <Text style={styles.emptySubtext}>
                    No items returned for this vehicle. Select a vehicle and retry.
                  </Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={fetchChecklist}>
                    <Text style={styles.retryBtnText}>Retry API</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.itemsList}>
                  <View style={styles.accordionToolbar}>
                    <TouchableOpacity onPress={expandAll} style={styles.accordionToolbarBtn}>
                      <Text style={styles.accordionToolbarText}>Expand all</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={collapseAll} style={styles.accordionToolbarBtn}>
                      <Text style={styles.accordionToolbarText}>Collapse all</Text>
                    </TouchableOpacity>
                  </View>
                  {items.map((item) => {
                    if (item.itemType === 'group') {
                      return (
                        <View key={item.id} style={styles.groupHeader}>
                          <Text style={styles.groupHeaderText}>{item.name}</Text>
                        </View>
                      );
                    }
                    const expanded = expandedIds[item.id];
                    return (
                      <View key={item.id} style={styles.accordionItem}>
                        <TouchableOpacity
                          style={styles.accordionHeader}
                          onPress={() => toggleExpanded(item.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.accordionHeaderText} numberOfLines={1}>{item.name}</Text>
                          <MaterialIcons
                            name={expanded ? 'expand-less' : 'expand-more'}
                            size={24}
                            color={COLORS.textSecondary}
                          />
                        </TouchableOpacity>
                        {expanded ? (
                          <View style={styles.accordionBody}>
                            {item.itemType === 'boolean' && (
                              <View style={styles.itemActions}>
                                <TouchableOpacity
                                  style={[styles.statusBtn, item.status === 'pass' && styles.statusBtnPass]}
                                  onPress={() => setItemStatus(item.id, 'pass')}
                                >
                                  <Text style={[styles.statusBtnText, item.status === 'pass' && styles.statusBtnTextActive]}>Pass</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.statusBtn, item.status === 'fail' && styles.statusBtnFail]}
                                  onPress={() => setItemStatus(item.id, 'fail')}
                                >
                                  <Text style={[styles.statusBtnText, item.status === 'fail' && styles.statusBtnTextActive]}>Fail</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.statusBtn, item.status === 'na' && styles.statusBtnNa]}
                                  onPress={() => setItemStatus(item.id, 'na')}
                                >
                                  <Text style={[styles.statusBtnText, item.status === 'na' && styles.statusBtnTextActive]}>N/A</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            {item.itemType === 'number' && (
                              <TextInput
                                style={styles.input}
                                value={item.value}
                                onChangeText={(v) => setItemValue(item.id, v)}
                                placeholder="0"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="number-pad"
                              />
                            )}
                            {item.itemType === 'date' && (
                              <TextInput
                                style={styles.input}
                                value={item.value}
                                onChangeText={(v) => setItemValue(item.id, v)}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={COLORS.textMuted}
                              />
                            )}
                            {item.itemType === 'string' && (
                              <TextInput
                                style={styles.input}
                                value={item.value}
                                onChangeText={(v) => setItemValue(item.id, v)}
                                placeholder={`Enter ${item.name.toLowerCase()}`}
                                placeholderTextColor={COLORS.textMuted}
                              />
                            )}
                            {item.itemType === 'image' && (
                              <>
                                <TouchableOpacity style={styles.imageButton} onPress={() => pickImage(item.id)}>
                                  <MaterialIcons name="add-a-photo" size={24} color={COLORS.textSecondary} />
                                  <Text style={styles.imageButtonText}>{item.imageUri ? 'Change photo' : 'Add photo'}</Text>
                                </TouchableOpacity>
                                {item.imageUri ? (
                                  <Image source={{ uri: item.imageUri }} style={styles.imageThumbnail} resizeMode="cover" />
                                ) : null}
                              </>
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalBottomBar}>
              <Pressable style={styles.modalBarItem} onPress={handleClear} disabled={loading || submitting}>
                <MaterialIcons name="delete-outline" size={32} color="rgba(255,255,255,0.95)" />
                <Text style={styles.modalBarLabel}>Clear</Text>
              </Pressable>
              <View style={styles.modalBarDivider} />
              <Pressable
                style={styles.modalBarItem}
                onPress={handleSubmit}
                disabled={loading || submitting || items.length === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <MaterialIcons name="check-circle" size={32} color={COLORS.primary} />
                )}
                <Text style={[styles.modalBarLabel, styles.modalBarLabelPrimary]}>Submit</Text>
              </Pressable>
              <View style={styles.modalBarDivider} />
              <Pressable style={styles.modalBarItem} onPress={handleSubmissions}>
                <MaterialIcons name="list" size={32} color="rgba(255,255,255,0.95)" />
                <Text style={styles.modalBarLabel}>Submissions</Text>
              </Pressable>
              <View style={styles.modalBarDivider} />
              <Pressable style={styles.modalBarItem} onPress={handleDashboard}>
                <MaterialIcons name="speed" size={32} color="rgba(255,255,255,0.95)" />
                <Text style={styles.modalBarLabel}>Dashboard</Text>
              </Pressable>
            </View>
          </View>
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
    maxWidth: 480,
    height: '88%',
    maxHeight: '90%',
    backgroundColor: '#252A32',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalContentTablet: {
    maxWidth: 560,
  },
  modalInner: {
    flex: 1,
    minHeight: 0, /* allow flex child to shrink so bottom bar stays visible */
  },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1F242C',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  groupHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  groupHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  accordionItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  accordionHeaderText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  accordionBody: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  accordionToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  accordionToolbarBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  accordionToolbarText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  itemRowVertical: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  imageThumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 8,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusBarText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  loadingWrap: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  retryBtnText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  sampleBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sampleBtnText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  submissionsView: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  submissionsBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  submissionsBackText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submissionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  emptySubmissionsWrap: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySubmissionsText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  submissionsList: {
    gap: 0,
  },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  submissionRowLeft: {
    flex: 1,
  },
  submissionCode: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  submissionReceived: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  submissionId: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  bodyScroll: {
    flex: 1,
    minHeight: 0,
  },
  bodyScrollContent: {
    paddingBottom: 24,
  },
  itemsList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusBtnPass: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: COLORS.primary,
  },
  statusBtnFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: COLORS.emergency,
  },
  statusBtnNa: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statusBtnTextActive: {
    color: COLORS.textPrimary,
  },
  modalBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#232931',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    minHeight: 76,
    flexShrink: 0,
  },
  modalBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalBarLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    marginTop: 6,
  },
  modalBarLabelPrimary: {
    color: COLORS.primary,
  },
  modalBarDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
  },
});

export default ChecklistModal;
