import React from 'react';
import { View, StyleSheet } from 'react-native';
import DirectionalArrow, {
  type DirectionalArrowBlinkMode,
} from '../DirectionalArrow';

const HIT_SIZE = 64;

type VehicleMapMarkerContentProps = {
  heading: number;
  color: string;
  blinkMode: DirectionalArrowBlinkMode;
  blinkPhase?: 0 | 1;
  size?: number;
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
}) => (
  <View style={styles.hit} collapsable={false}>
    <DirectionalArrow
      heading={heading}
      color={color}
      blinkMode={blinkMode}
      blinkPhase={blinkPhase}
      size={size}
    />
  </View>
);

const styles = StyleSheet.create({
  hit: {
    width: HIT_SIZE,
    height: HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VehicleMapMarkerContent;
