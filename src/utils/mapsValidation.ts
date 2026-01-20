/**
 * Maps Validation Utilities
 * Handles validation and error suppression for Google Maps API
 */

import { MAPS_CONFIG, isMapsApiKeyValid } from '@/config/maps.config';

/**
 * Check if maps are available and configured
 */
export const validateMapsAvailability = (): {
  available: boolean;
  reason?: string;
} => {
  if (!isMapsApiKeyValid()) {
    return {
      available: false,
      reason: 'Google Maps API key is not configured. Please add your API key to android/gradle.properties',
    };
  }

  return { available: true };
};

/**
 * Get a user-friendly message about maps availability
 */
export const getMapsAvailabilityMessage = (): string => {
  const validation = validateMapsAvailability();
  if (!validation.available) {
    return validation.reason || 'Maps are not available';
  }
  return 'Maps are available';
};

/**
 * Suppress maps-related errors in development
 */
export const suppressMapsErrors = (): void => {
  if (__DEV__) {
    // In development, we can suppress maps errors if no key is configured
    const originalError = console.error;
    console.error = (...args: any[]) => {
      const errorMessage = args.join(' ');
      // Suppress Google Maps license validation errors
      if (
        errorMessage.includes('LICENSE VALIDATION FAILURE') ||
        errorMessage.includes('Failed to find license key') ||
        errorMessage.includes('AndroidManifest')
      ) {
        console.warn(
          '[Maps] License validation error suppressed. Maps features are disabled until API key is configured.'
        );
        return;
      }
      originalError.apply(console, args);
    };
  }
};

