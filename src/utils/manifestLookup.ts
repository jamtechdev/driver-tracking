/**
 * In-memory today's manifest list for block name lookups in the bottom bar.
 */

import { getManifestsForToday, type BlockManifest } from '@/api/manifests.api';

let todayManifests: BlockManifest[] = [];
const rosterListeners = new Set<() => void>();

export function setTodayManifests(
  list: BlockManifest[],
  options?: { notify?: boolean },
): void {
  todayManifests = Array.isArray(list) ? list : [];
  if (options?.notify === false) return;
  rosterListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('[manifestLookup] roster listener error:', e);
    }
  });
}

export function subscribeTodayManifestsUpdated(listener: () => void): () => void {
  rosterListeners.add(listener);
  return () => {
    rosterListeners.delete(listener);
  };
}

export function findBlockNameById(manifestId: number | null | undefined): string | null {
  if (manifestId == null) return null;
  const match = todayManifests.find((m) => m.manifestID === manifestId);
  const name = match?.name && String(match.name).trim();
  return name || null;
}

export async function lookupBlockNameById(manifestId: number): Promise<string | null> {
  const cached = findBlockNameById(manifestId);
  if (cached) return cached;

  try {
    const list = await getManifestsForToday();
    setTodayManifests(list, { notify: false });
    return findBlockNameById(manifestId);
  } catch (e) {
    console.warn('[manifestLookup] lookupBlockNameById failed:', e);
    return null;
  }
}
