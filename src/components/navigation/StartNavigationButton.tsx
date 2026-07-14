/**
 * Start Mapbox turn-by-turn navigation button for the map screen.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { COLORS } from '@/theme/colors';

export const MDT_TURN_BY_TURN_CTA =
  'Turn-by-turn navigation is not enabled for this agency. Contact your administrator to enable MDT Turn-by-Turn.';

interface StartNavigationButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  stopCount: number;
  /** When false, button stays disabled and shows CTA instead of stop count. */
  featureEnabled?: boolean;
  featureLoading?: boolean;
  ctaText?: string;
}

export default function StartNavigationButton({
  onPress,
  disabled = false,
  loading = false,
  stopCount,
  featureEnabled = true,
  featureLoading = false,
  ctaText = MDT_TURN_BY_TURN_CTA,
}: StartNavigationButtonProps) {
  const blockedByFeature = !featureLoading && !featureEnabled;
  const isBusy = loading || featureLoading;
  const isDisabled = disabled || isBusy || blockedByFeature;

  const subtitle = blockedByFeature
    ? ctaText
    : featureLoading
      ? 'Checking navigation access…'
      : stopCount > 0
        ? `${stopCount} stop${stopCount === 1 ? '' : 's'} in route order`
        : 'Waiting for assigned stops';

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Start navigation"
      accessibilityState={{ disabled: isDisabled }}
    >
      <View style={styles.content}>
        {isBusy ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <MaterialIcons
            name={blockedByFeature ? 'lock' : 'navigation'}
            size={22}
            color="#FFF"
          />
        )}
        <View style={styles.textWrap}>
          <Text style={styles.title}>Start Navigation</Text>
          <Text
            style={[styles.subtitle, blockedByFeature && styles.ctaText]}
            numberOfLines={blockedByFeature ? 3 : 2}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  ctaText: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
    lineHeight: 16,
  },
});
