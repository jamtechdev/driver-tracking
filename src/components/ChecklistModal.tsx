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
  KeyboardAvoidingView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { COLORS } from '../theme/colors';
import { useChecklistModal } from '../context/ChecklistModalContext';
import { useAuth } from '../context/AuthContext';
import { useDriverData } from '../context/DriverDataContext';
import { PEAK_DEFAULT_PARAMS } from '../config/env';
import {
  getChecklist,
  submitChecklist,
  getChecklistItemsArray,
  getChecklistItemsKey,
  patchChecklistItemById,
  normalizePeakChecklistItemType,
  peakChecklistItemIsBoolean,
  injectDriverNameIntoChecklistDocument,
  applyChecklistDateTimeDefaults,
  formatChecklistDateValue,
  formatChecklistTimeValue12h,
  isPeakChecklistDriverNameTextItem,
  isPeakVehicleInspectionChecklistDocument,
  type ChecklistItemApi,
  type ChecklistSubmissionApi,
  type PeakChecklistDocument,
  type PeakNormalizedItemType,
} from '../api/checklist.api';
import ChecklistVehicleDamageDiagram from './checklist/ChecklistVehicleDamageDiagram';
import { parseChecklistDamageMarks } from '../utils/checklistDamageMarks';

type ItemStatus = 'pass' | 'fail' | 'na';

export type ChecklistItemType = PeakNormalizedItemType;

interface ChecklistItem {
  id: string;
  name: string;
  itemType: ChecklistItemType;
  sequence: number;
  category?: string;
  status: ItemStatus;
  value: string;
  /** API `required === '1'` — must be answered before submit. */
  required: boolean;
  /** Vehicle damage diagram asset id / URL (normalized `Vehicle Damage Image` row). */
  itemUnit?: string;
}

function isChecklistItemRequiredFlag(required: unknown): boolean {
  if (required === 1 || required === true) return true;
  return String(required ?? '').trim() === '1';
}

/** Row id must match `patchChecklistItemById` / view `item.id`. */
function checklistRowId(row: ChecklistItemApi, index: number): string {
  return String(row.itemID ?? row.id ?? index + 1);
}

/**
 * Returns map of row id → error message for items with `required: '1'` that are still empty / unset.
 */
function computeRequiredFieldErrorsFromDocument(doc: PeakChecklistDocument | null): Record<string, string> {
  if (!doc) return {};
  const list = getChecklistItemsArray(doc);
  const out: Record<string, string> = {};
  list.forEach((raw, index) => {
    const row = raw as ChecklistItemApi;
    if (!isChecklistItemRequiredFlag(row.required)) return;
    const id = checklistRowId(row, index);
    const t = normalizePeakChecklistItemType(row.itemType);
    if (t === 'group') return;

    if (t === 'boolean') {
      const v = String(row.value ?? '');
      if (v !== '0' && v !== '1') {
        out[id] = 'Please select Pass or Fail before submitting.';
      }
      return;
    }
    if (t === 'image') {
      if (parseChecklistDamageMarks(row.value).length === 0) {
        out[id] = 'Please mark the vehicle diagram (at least one damage point) before submitting.';
      }
      return;
    }
    if (t === 'string' || t === 'number' || t === 'date' || t === 'time') {
      if (!String(row.value ?? '').trim()) {
        out[id] = 'This field is required.';
      }
    }
  });
  return out;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function mapApiItemsToView(apiItems: ChecklistItemApi[], driverName?: string): ChecklistItem[] {
  const mapped = apiItems.map((a, index) => {
    const id = checklistRowId(a, index);
    const name = decodeHtmlEntities(String(a.itemName ?? a.name ?? 'Item'));
    const itemType = normalizePeakChecklistItemType(a.itemType);
    const seq = typeof a.sequence === 'number' ? a.sequence : parseInt(String(a.sequence ?? index), 10) || index;

    let status: ItemStatus = 'na';
    if (itemType === 'boolean') {
      const v = String(a.value ?? '');
      if (v === '0') status = 'pass';
      else if (v === '1') status = 'fail';
    }

    let value = String(a.value ?? '');
    if (itemType === 'string' && isPeakChecklistDriverNameTextItem(a) && driverName) {
      value = driverName;
    }
    if (itemType === 'number' && value === '') value = '';

    let imageDamageValue = '';
    if (itemType === 'image') {
      const v = String(a.value ?? '').trim();
      const looksLegacyPhoto =
        v.startsWith('data:') || v.startsWith('file') || /^https?:\/\//i.test(v) || (/^[A-Za-z0-9+/=]+$/.test(v) && v.length > 80);
      imageDamageValue = looksLegacyPhoto ? '' : String(a.value ?? '');
    }

    return {
      id,
      name,
      itemType,
      sequence: Number.isNaN(seq) ? index : seq,
      status,
      value: itemType === 'image' ? imageDamageValue : value,
      required: isChecklistItemRequiredFlag(a.required),
      itemUnit: typeof a.itemUnit === 'string' ? a.itemUnit : String(a.itemUnit ?? ''),
    };
  });
  return mapped.sort((a, b) => a.sequence - b.sequence);
}

function documentToViewItems(doc: PeakChecklistDocument | null, driverName?: string): ChecklistItem[] {
  if (!doc) return [];
  return mapApiItemsToView(getChecklistItemsArray(doc), driverName);
}

const ChecklistModal: React.FC = () => {
  const { visible, close } = useChecklistModal();
  const { vehicleId, driver } = useAuth();
  const { drivers } = useDriverData();
  const [checklistDoc, setChecklistDoc] = useState<PeakChecklistDocument | null>(null);
  const [submissions, setSubmissions] = useState<ChecklistSubmissionApi[]>([]);
  const [showSubmissionsView, setShowSubmissionsView] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklistType, setChecklistType] = useState<'pre' | 'post'>('pre');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { width } = Dimensions.get('window');
  const isTablet = width >= 600;
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  /** Prefer auth name; else match `driver.id` to agency driver list (`driverName`) so checklist POST includes a real name for admin. */
  const driverName = React.useMemo(() => {
    const fromAuth = (driver?.name ?? (driver as { displayName?: string })?.displayName ?? '').trim();
    if (fromAuth && fromAuth !== 'Unassigned') return fromAuth;
    if (driver?.id) {
      const row = drivers.find((d) => String(d.driverID) === String(driver.id));
      const apiName = row?.driverName != null ? String(row.driverName).trim() : '';
      if (apiName) return apiName;
    }
    return fromAuth;
  }, [driver, drivers]);

  const items = React.useMemo(
    () => documentToViewItems(checklistDoc, driverName),
    [checklistDoc, driverName],
  );

  const fetchChecklist = useCallback(() => {
    const vid = vehicleId?.trim() || '';
    if (!vid) {
      setChecklistDoc(null);
      setError('Select a vehicle first');
      return;
    }
    setError(null);
    setLoading(true);
    getChecklist(vid, agencyID)
      .then((data) => {
        console.log('Checklist data:', data);
        let doc = injectDriverNameIntoChecklistDocument(data.document, driverName);
        if (!isPeakVehicleInspectionChecklistDocument(doc)) {
          setError('Invalid checklist (expected checklistName and items from server).');
          setChecklistDoc(null);
          setSubmissions([]);
          return;
        }
        doc = applyChecklistDateTimeDefaults(doc);
        setChecklistDoc(doc);
        setSubmissions(data.results ?? []);
        setExpandedIds({});
        setFieldErrors({});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load checklist');
        setChecklistDoc(null);
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, [vehicleId, agencyID, driverName]);

  // When modal opens, fetch checklist; when it closes, reset submissions view
  useEffect(() => {
    if (!visible) {
      setShowSubmissionsView(false);
      setChecklistDoc(null);
      setFieldErrors({});
      return;
    }
    fetchChecklist();
  }, [visible, fetchChecklist]);

  const handleClear = useCallback(() => {
    setChecklistDoc((prev) => {
      if (!prev) return prev;
      const key = getChecklistItemsKey(prev);
      if (!key) return prev;
      const list = (prev[key] as ChecklistItemApi[]).map((row) => {
        const copy = { ...row };
        const t = normalizePeakChecklistItemType(copy.itemType);
        if (t === 'boolean') {
          copy.value = '';
        } else if (t === 'date') {
          copy.value = formatChecklistDateValue();
        } else if (t === 'time') {
          copy.value = formatChecklistTimeValue12h();
        } else if (t === 'string' || t === 'number') {
          const isDriverName = isPeakChecklistDriverNameTextItem(copy);
          if (t === 'string' && isDriverName && driverName) {
            copy.value = driverName;
          } else {
            copy.value = '';
          }
        } else if (t === 'image') {
          copy.value = '';
        }
        return copy;
      });
      return { ...prev, [key]: list };
    });
    setFieldErrors({});
  }, [driverName]);

  const clearFieldError = useCallback((id: string) => {
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!driver || driver.role === 'unassigned') {
      close();
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: 'Driver should login.',
      });
      return;
    }
    if (!vehicleId?.trim()) {
      close();
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: 'Vehicle should be selected',
      });
      return;
    }
    if (!checklistDoc) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No checklist loaded',
      });
      return;
    }
    const docToSubmit = applyChecklistDateTimeDefaults(
      injectDriverNameIntoChecklistDocument(checklistDoc, driverName),
    );
    const requiredErrors = computeRequiredFieldErrorsFromDocument(docToSubmit);
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      setExpandedIds((prev) => {
        const next = { ...prev };
        Object.keys(requiredErrors).forEach((id) => {
          next[id] = true;
        });
        return next;
      });
      // Toast.show({
      //   type: 'error',
      //   text1: 'Required items',
      //   text2: 'Please complete all required fields before submitting.',
      // });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await submitChecklist(vehicleId.trim(), String(driver.id), agencyID, docToSubmit);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `${checklistType === 'pre' ? 'Pre-Trip' : 'Post-Trip'} checklist submitted`,
        });
        close();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Submit rejected',
          text2: typeof result.raw === 'object' && result.raw !== null
            ? JSON.stringify(result.raw).slice(0, 200)
            : 'Server returned success: false',
        });
      }
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: e instanceof Error ? e.message : 'Submit failed',
      });
    } finally {
      setSubmitting(false);
    }
  }, [vehicleId, driver, agencyID, checklistDoc, close, checklistType, driverName]);

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
    clearFieldError(id);
    setChecklistDoc((prev) => {
      if (!prev) return prev;
      return patchChecklistItemById(prev, id, (it) => {
        if (!peakChecklistItemIsBoolean(it)) return;
        if (status === 'pass') it.value = '0';
        else if (status === 'fail') it.value = '1';
        else it.value = '';
      });
    });
  };

  const setItemValue = (id: string, value: string) => {
    clearFieldError(id);
    setChecklistDoc((prev) => {
      if (!prev) return prev;
      return patchChecklistItemById(prev, id, (it) => {
        it.value = value;
      });
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

  const checklistName =
    checklistDoc && typeof checklistDoc.checklistName === 'string'
      ? (checklistDoc.checklistName as string)
      : null;

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          style={[styles.modalContent, isTablet && styles.modalContentTablet]}
          enabled={true}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => { }}
          >
            <View style={styles.modalInner}>
              <View style={styles.header}>
                <View style={styles.headerTop}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.headerTitle}>Inspection Checklist</Text>
                    {checklistName ? (
                      <Text style={styles.headerSubtitle} numberOfLines={2}>
                        {checklistName}
                      </Text>
                    ) : null}
                  </View>
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
                automaticallyAdjustKeyboardInsets={true}
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
                            <Text style={styles.accordionHeaderText} numberOfLines={1}>
                              {item.name}
                              {item.required ? <Text style={styles.requiredMark}> *</Text> : null}
                            </Text>
                            <MaterialIcons
                              name={expanded ? 'expand-less' : 'expand-more'}
                              size={24}
                              color={COLORS.textSecondary}
                            />
                          </TouchableOpacity>
                          {expanded ? (
                            <View style={styles.accordionBody}>
                              {item.itemType === 'boolean' && (
                                <>
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
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                              {item.itemType === 'number' && (
                                <>
                                  <TextInput
                                    style={[styles.input, fieldErrors[item.id] ? styles.inputError : null]}
                                    value={item.value}
                                    onChangeText={(v) => setItemValue(item.id, v)}
                                    placeholder="0"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="number-pad"
                                  />
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                              {item.itemType === 'date' && (
                                <>
                                  <TextInput
                                    style={[styles.input, fieldErrors[item.id] ? styles.inputError : null]}
                                    value={item.value}
                                    onChangeText={(v) => setItemValue(item.id, v)}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={COLORS.textMuted}
                                  />
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                              {item.itemType === 'time' && (
                                <>
                                  <TextInput
                                    style={[styles.input, fieldErrors[item.id] ? styles.inputError : null]}
                                    value={item.value}
                                    onChangeText={(v) => setItemValue(item.id, v)}
                                    placeholder="hh:mm AM/PM"
                                    placeholderTextColor={COLORS.textMuted}
                                  />
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                              {item.itemType === 'string' && (
                                <>
                                  <TextInput
                                    style={[styles.input, fieldErrors[item.id] ? styles.inputError : null]}
                                    value={item.value}
                                    onChangeText={(v) => setItemValue(item.id, v)}
                                    placeholder={`Enter ${item.name.toLowerCase()}`}
                                    placeholderTextColor={COLORS.textMuted}
                                  />
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                              {item.itemType === 'image' && (
                                <>
                                  <ChecklistVehicleDamageDiagram
                                    itemUnit={item.itemUnit}
                                    value={item.value}
                                    onChangeValue={(serialized) => setItemValue(item.id, serialized)}
                                  />
                                  {fieldErrors[item.id] ? (
                                    <Text style={styles.fieldErrorText}>{fieldErrors[item.id]}</Text>
                                  ) : null}
                                </>
                              )}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {/* Bottom spacer to ensure last field is never covered */}
                    {/* <View style={{ height: 40 }} /> */}
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
        </KeyboardAvoidingView>
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 4,
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
  requiredMark: {
    color: '#f87171',
    fontWeight: '700',
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
  inputError: {
    borderColor: 'rgba(248, 113, 113, 0.85)',
    borderWidth: 1,
  },
  fieldErrorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#f87171',
    fontWeight: '500',
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
    paddingBottom: 150,
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
