/**
 * Vehicle Checklist API — Peak Transit `getchecklist` (GET) & `submitchecklist` (POST).
 *
 * Pattern: `https://api.peaktransit.com/v5/index.php/?app_id=DR&key=<KEY>&controller=driver&action=...`
 * Confirm `app_id` / `key` / `agencyID` with backend for each environment (see `src/config/env.ts`).
 */

import axios from 'axios';
import { API_CONFIG, CHECKLIST_GET_BASE_URL, CHECKLIST_SUBMIT_BASE_URL } from '@/config/api.config';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

/** Checklist row from API (`items` / `checklist` array). */
export interface ChecklistItemApi {
  itemID?: string;
  itemName?: string;
  /**
   * Display/control kind from agency admin or Peak API.
   * Admin labels include: Pass/Fail, Number, Time, Date, Text, Vehicle Damage Image, Group Header.
   * Use `normalizePeakChecklistItemType()` for UI and `hasFail` logic.
   */
  itemType?: string;
  itemUnit?: string;
  required?: string;
  sequence?: string | number;
  checklistID?: string;
  id?: string;
  name?: string;
  category?: string;
  value?: string | number;
  [key: string]: unknown;
}

/** Previous submission from `getchecklist` (`results` array). */
export interface ChecklistSubmissionApi {
  resultID?: string;
  agencyID?: string;
  code?: string;
  received?: string;
  [key: string]: unknown;
}

/** Full checklist JSON from GET (keep shape for POST body after edits). */
export type PeakChecklistDocument = Record<string, unknown>;

/**
 * Normalized item kinds used by the app UI (matches agency admin checklist builder).
 * Admin labels: Pass/Fail, Number, Time, Date, Text, Vehicle Damage Image, Group Header.
 */
export type PeakNormalizedItemType =
  | 'boolean'
  | 'number'
  | 'date'
  | 'string'
  | 'time'
  | 'image'
  | 'group';

/**
 * Map Peak/agency `itemType` strings (admin labels or legacy API tokens) to a fixed set.
 */
export function normalizePeakChecklistItemType(raw: unknown): PeakNormalizedItemType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'string';

  // Agency admin UI (Pass/Fail, …)
  if (s === 'pass/fail' || s === 'pass fail' || s === 'passfail' || s === 'pass-fail') return 'boolean';
  if (s === 'number' || s === 'numeric') return 'number';
  if (s === 'time') return 'time';
  if (s === 'date') return 'date';
  if (s === 'text' || s === 'string' || s === 'textarea') return 'string';
  if (
    s === 'vehicle damage image' ||
    s.includes('damage image') ||
    s === 'vehicle damage' ||
    s === 'damageimage'
  ) {
    return 'image';
  }
  if (s === 'group header' || s === 'group' || s === 'header' || s === 'section') return 'group';

  // Legacy / API tokens
  if (s === 'boolean') return 'boolean';
  if (s === 'image' || s === 'photo' || s === 'picture') return 'image';

  return 'string';
}

export function peakChecklistItemIsBoolean(item: ChecklistItemApi): boolean {
  return normalizePeakChecklistItemType(item.itemType) === 'boolean';
}

export function peakChecklistItemIsImage(item: ChecklistItemApi): boolean {
  return normalizePeakChecklistItemType(item.itemType) === 'image';
}

/** Decode minimal HTML entities in checklist labels (admin / API). */
function decodeChecklistLabelHtml(s: string): string {
  return String(s)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * True if this row is the “driver name” Text field from the agency checklist builder.
 * Used so we can fill `value` for admin display (POST body must include the name, not only UI overlay).
 */
export function isPeakChecklistDriverNameTextItem(item: ChecklistItemApi): boolean {
  if (normalizePeakChecklistItemType(item.itemType) !== 'string') return false;
  const label = decodeChecklistLabelHtml(String(item.itemName ?? item.name ?? '')).toLowerCase();
  if (!label) return false;
  if (label === 'driver' || label === 'driver name') return true;
  if (/^driver'?s\s*name$/i.test(label)) return true;
  if (/driver\s*name/.test(label)) return true;
  if (/operator\s*name/.test(label)) return true;
  return false;
}

/**
 * Writes the signed-in driver's name into matching Text items so `submitchecklist` sends it (admin panel reads `value`).
 */
export function injectDriverNameIntoChecklistDocument(
  doc: PeakChecklistDocument,
  driverName: string,
): PeakChecklistDocument {
  const name = String(driverName).trim();
  if (!name) return doc;
  const key = getChecklistItemsKey(doc);
  if (!key) return doc;
  const list = doc[key] as ChecklistItemApi[];
  let changed = false;
  const next = list.map((row) => {
    if (!isPeakChecklistDriverNameTextItem(row)) return row;
    if (String(row.value ?? '').trim() === name) return row;
    changed = true;
    return { ...row, value: name };
  });
  if (!changed) return doc;
  return { ...doc, [key]: next };
}

export interface GetChecklistResult {
  /** Deep clone of API JSON; item list lives under `items` or `checklist` (see `getChecklistItemsKey`). */
  document: PeakChecklistDocument;
  results: ChecklistSubmissionApi[];
}

export function deepCloneChecklist<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Which top-level key holds the editable item array. */
export function getChecklistItemsKey(doc: PeakChecklistDocument | null | undefined): 'items' | 'checklist' | null {
  if (!doc || typeof doc !== 'object') return null;
  if (Array.isArray(doc.items)) return 'items';
  if (Array.isArray(doc.checklist)) return 'checklist';
  return null;
}

/** Mutable reference to the items array inside `document` (same array as in document). */
export function getChecklistItemsArray(doc: PeakChecklistDocument): ChecklistItemApi[] {
  const key = getChecklistItemsKey(doc);
  if (!key) return [];
  return doc[key] as ChecklistItemApi[];
}

/**
 * `hasFail` query param: any Pass/Fail (boolean) item with `value === "1"` (fail) → 1, else 0.
 */
export function computeHasFailFromChecklistDocument(doc: PeakChecklistDocument | null | undefined): 0 | 1 {
  const items = getChecklistItemsArray(doc ?? {});
  for (const raw of items) {
    const it = raw as ChecklistItemApi;
    if (!peakChecklistItemIsBoolean(it)) continue;
    if (String(it.value ?? '') === '1') return 1;
  }
  return 0;
}

/** Current local date for checklist `date` items: `yyyy-MM-dd`. */
export function formatChecklistDateValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Current local time for checklist `time` items: 12-hour `hh:mm` with AM/PM (en-US). */
export function formatChecklistTimeValue12h(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Fills empty `date` / `time` item `value` fields with current date/time strings for display and POST body.
 */
export function applyChecklistDateTimeDefaults(
  doc: PeakChecklistDocument,
  at: Date = new Date(),
): PeakChecklistDocument {
  const key = getChecklistItemsKey(doc);
  if (!key) return doc;
  const defaultDate = formatChecklistDateValue(at);
  const defaultTime = formatChecklistTimeValue12h(at);
  let changed = false;
  const next = (doc[key] as ChecklistItemApi[]).map((row) => {
    const t = normalizePeakChecklistItemType(row.itemType);
    if (t === 'date' && !String(row.value ?? '').trim()) {
      changed = true;
      return { ...row, value: defaultDate };
    }
    if (t === 'time' && !String(row.value ?? '').trim()) {
      changed = true;
      return { ...row, value: defaultTime };
    }
    return row;
  });
  if (!changed) return doc;
  return { ...doc, [key]: next };
}

export function patchChecklistItemById(
  doc: PeakChecklistDocument,
  itemId: string,
  mutator: (item: ChecklistItemApi) => void,
): PeakChecklistDocument {
  const key = getChecklistItemsKey(doc);
  if (!key) return doc;
  const list = doc[key] as ChecklistItemApi[];
  const idx = list.findIndex((it) => String(it.itemID ?? it.id) === itemId);
  if (idx < 0) return doc;
  const next = list.map((it, i) => {
    if (i !== idx) return it;
    const copy = { ...it } as ChecklistItemApi;
    mutator(copy);
    return copy;
  });
  return { ...doc, [key]: next };
}

function normalizeGetChecklistPayload(data: unknown): PeakChecklistDocument {
  if (Array.isArray(data)) {
    return { items: deepCloneChecklist(data) };
  }
  if (data && typeof data === 'object') {
    const doc = deepCloneChecklist(data) as PeakChecklistDocument;
    const key = getChecklistItemsKey(doc);
    if (!key) {
      const fallback =
        doc.checklistItems ??
        doc.data ??
        doc.result;
      const arr = Array.isArray(fallback) ? fallback : [];
      return { ...doc, items: deepCloneChecklist(arr) };
    }
    return doc;
  }
  return { items: [] };
}

/**
 * Vehicle inspection API returns `items` for mutability; some payloads only have `checklist`.
 * Copy to `items` so `checklistName` + `items` shape matches legacy POST expectations.
 */
export function ensurePeakVehicleInspectionItems(doc: PeakChecklistDocument): PeakChecklistDocument {
  if (!Array.isArray(doc.items) && Array.isArray(doc.checklist)) {
    return { ...doc, items: deepCloneChecklist(doc.checklist) };
  }
  return doc;
}

/** Valid vehicle inspection checklist: non-empty checklistName + `items` array (possibly empty rows). */
export function isPeakVehicleInspectionChecklistDocument(
  doc: PeakChecklistDocument | null | undefined,
): doc is PeakChecklistDocument & { checklistName: string; items: ChecklistItemApi[] } {
  if (!doc || typeof doc !== 'object') return false;
  const name = doc.checklistName;
  const itemsUnknown = doc.items;
  return typeof name === 'string' && name.trim().length > 0 && Array.isArray(itemsUnknown);
}

/**
 * Fetch checklist for a vehicle. Returns the **full** JSON object (clone) for in-memory edits and POST body.
 * GET … `controller=driver` & `action=getchecklist` & `vehicleID` & `agencyID` & app_id & key
 */
export async function getChecklist(
  vehicleID: string,
  agencyID?: string,
): Promise<GetChecklistResult> {
  const vid = String(vehicleID).trim();
  if (!vid) {
    return { document: { items: [] }, results: [] };
  }
  const aid = agencyID ?? String(PEAK_DEFAULT_PARAMS.agencyID);
  const url = `${CHECKLIST_GET_BASE_URL}&vehicleID=${encodeURIComponent(vid)}&agencyID=${encodeURIComponent(aid)}`;
  if (__DEV__) {
    console.log('[Checklist API] GET getchecklist', url);
  }
  const response = await axios.get<unknown>(url, {
    timeout: API_CONFIG.TIMEOUT,
  });
  const data = response.data;
  if (__DEV__) {
    console.log('[Checklist API] getchecklist response keys', data && typeof data === 'object' ? Object.keys(data as object) : typeof data);
  }

  let document = normalizeGetChecklistPayload(data);
  document = ensurePeakVehicleInspectionItems(document);
  const rawResults = (document as { results?: unknown }).results;
  const results: ChecklistSubmissionApi[] = Array.isArray(rawResults) ? (rawResults as ChecklistSubmissionApi[]) : [];
  return { document, results };
}

export interface SubmitChecklistResult {
  success: boolean;
  raw?: unknown;
}

/** Treat empty body or missing / unknown `success` as OK; explicit `success: false` fails. */
export function isSubmitChecklistResponseSuccess(raw: unknown): boolean {
  if (raw == null || raw === '') return true;
  if (typeof raw === 'object' && raw !== null) {
    const s = (raw as { success?: unknown }).success;
    if (s === false || s === 'false') return false;
  }
  return true;
}
function redactQueryKeyParam(u: string): string {
  return u.replace(/([?&]key=)[^&]*/gi, '$1<redacted>');
}

/**
 * Submit checklist: POST with query params + **raw JSON body** = full checklist object (same structure as GET + user edits).
 * `hasFail` is computed from boolean `value === "1"` unless you pass `hasFailOverride` (tests only).
 */
export async function submitChecklist(
  vehicleID: string,
  driverID: string,
  agencyID: string | undefined,
  document: PeakChecklistDocument,
  options?: { hasFailOverride?: 0 | 1 },
): Promise<SubmitChecklistResult> {
  const vid = String(vehicleID).trim();
  const did = String(driverID).trim();
  if (!vid || !did) {
    throw new Error('vehicleID and driverID are required to submit checklist');
  }
  const aid = agencyID ?? String(PEAK_DEFAULT_PARAMS.agencyID);
  const hasFail = options?.hasFailOverride ?? computeHasFailFromChecklistDocument(document);
  const url = `${CHECKLIST_SUBMIT_BASE_URL}&vehicleID=${encodeURIComponent(vid)}&driverID=${encodeURIComponent(did)}&agencyID=${encodeURIComponent(aid)}&hasFail=${hasFail}`;

  const body = deepCloneChecklist(document);

  if (__DEV__) {
    const itemsKey = getChecklistItemsKey(body);
    const items = getChecklistItemsArray(body);
    const imagePayloadRows = items
      .filter((row) => peakChecklistItemIsImage(row as ChecklistItemApi))
      .map((row) => {
        const it = row as ChecklistItemApi;
        return {
          itemID: it.itemID ?? it.id,
          itemType: it.itemType,
          itemName: it.itemName ?? it.name,
          itemUnit: it.itemUnit,
          value: typeof it.value === 'string' ? it.value : String(it.value ?? ''),
        };
      });
    console.log('[Checklist API] submitchecklist PRE-SEND', {
      url: redactQueryKeyParam(url),
      hasFail,
      itemsArrayKey: itemsKey,
      itemsCount: items.length,
      vehicleDamageImageItems: imagePayloadRows,
    });
    try {
      console.log('[Checklist API] submitchecklist body JSON:', JSON.stringify(body));
    } catch (e) {
      console.warn('[Checklist API] submitchecklist could not stringify body', e);
    }
  }

  const response = await axios.post<unknown>(url, body, {
    timeout: API_CONFIG.TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
  const raw = response.data;
  const success = isSubmitChecklistResponseSuccess(raw);
  return { success, raw };
}
