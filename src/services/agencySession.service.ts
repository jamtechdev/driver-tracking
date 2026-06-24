/**
 * Persisted Peak Transit user session — agency ID from login `defaultAgency`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const AGENCY_ID_STORAGE_KEY = '@driver_tracking:agency_id';
export const PEAK_USER_STORAGE_KEY = '@driver_tracking:peak_user';

export interface PeakLoginUser {
  userID: number;
  requirepwchange: number;
  name: string;
  defaultAgency: number;
  PTadmin: number;
  email: string;
  userHash: string;
}

let cachedAgencyId: string | null = null;
let cachedUser: PeakLoginUser | null = null;

export function getAgencyIdSync(): string | null {
  return cachedAgencyId;
}

export function getAgencyId(): string {
  if (!cachedAgencyId) {
    throw new Error('Agency ID is not set. User must log in first.');
  }
  return cachedAgencyId;
}

export function getPeakUserSync(): PeakLoginUser | null {
  return cachedUser;
}

export function setAgencySession(agencyId: string, user?: PeakLoginUser | null): void {
  cachedAgencyId = String(agencyId);
  cachedUser = user ?? null;
}

export async function persistAgencySession(
  agencyId: string,
  user: PeakLoginUser,
): Promise<void> {
  setAgencySession(agencyId, user);
  await AsyncStorage.multiSet([
    [AGENCY_ID_STORAGE_KEY, String(agencyId)],
    [PEAK_USER_STORAGE_KEY, JSON.stringify(user)],
  ]);
}

export async function loadAgencySessionFromStorage(): Promise<{
  agencyId: string | null;
  user: PeakLoginUser | null;
}> {
  try {
    const [agencyId, userJson] = await AsyncStorage.multiGet([
      AGENCY_ID_STORAGE_KEY,
      PEAK_USER_STORAGE_KEY,
    ]);

    const storedAgencyId = agencyId[1]?.trim() || null;
    let user: PeakLoginUser | null = null;

    if (userJson[1]) {
      try {
        user = JSON.parse(userJson[1]) as PeakLoginUser;
      } catch {
        user = null;
      }
    }

    if (storedAgencyId) {
      setAgencySession(storedAgencyId, user);
    } else {
      cachedAgencyId = null;
      cachedUser = null;
    }

    return { agencyId: storedAgencyId, user };
  } catch {
    cachedAgencyId = null;
    cachedUser = null;
    return { agencyId: null, user: null };
  }
}

export async function clearAgencySession(): Promise<void> {
  cachedAgencyId = null;
  cachedUser = null;
  await AsyncStorage.multiRemove([AGENCY_ID_STORAGE_KEY, PEAK_USER_STORAGE_KEY]);
}
