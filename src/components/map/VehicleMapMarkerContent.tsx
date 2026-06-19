import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import DirectionalArrow, {
  type DirectionalArrowBlinkMode,
} from '../DirectionalArrow';

const HIT_SIZE = 64;
const DEFAULT_ARROW_SIZE = 40;

export const VEHICLE_MARKER_HIT_SIZE = HIT_SIZE;
export const VEHICLE_MARKER_ARROW_SIZE = DEFAULT_ARROW_SIZE;

type VehicleMapMarkerContentProps = {
  heading: number;
  color: string;
  blinkMode: DirectionalArrowBlinkMode;
  blinkPhase?: 0 | 1;
  size?: number;
  /** iOS: inner Pressable is required for custom marker taps on Apple Maps. */
  onPress?: () => void;
};

/**
 * Large touch target around the arrow — improves first-tap hit on custom map markers.
 */
const VehicleMapMarkerContent: React.FC<VehicleMapMarkerContentProps> = ({
  heading,
  color,
  blinkMode,
  blinkPhase,
  size = 40,
  onPress,
}) => {
  const arrow = (
    <DirectionalArrow
      heading={heading}
      color={color}
      blinkMode={blinkMode}
      blinkPhase={blinkPhase}
      size={size}
    />
  );

  if (onPress && Platform.OS === 'ios') {
    return (
      <Pressable onPress={onPress} style={styles.hit} collapsable={false}>
        {arrow}
      </Pressable>
    );
  }

  return (
    <View style={styles.hit} collapsable={false}>
      {arrow}
    </View>
  );
};

const styles = StyleSheet.create({
  hit: {
    width: HIT_SIZE,
    height: HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VehicleMapMarkerContent;
