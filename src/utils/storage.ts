/**
 * AsyncStorage Wrapper Utilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONSTANTS } from './constants';

/**
 * Get item from storage
 */
export const getStorageItem = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.error(`Error getting item from storage (${key}):`, error);
    return null;
  }
};

/**
 * Set item in storage
 */
export const setStorageItem = async <T>(key: string, value: T): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error setting item in storage (${key}):`, error);
    return false;
  }
};

/**
 * Remove item from storage
 */
export const removeStorageItem = async (key: string): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing item from storage (${key}):`, error);
    return false;
  }
};

/**
 * Clear all storage
 */
export const clearStorage = async (): Promise<boolean> => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};

