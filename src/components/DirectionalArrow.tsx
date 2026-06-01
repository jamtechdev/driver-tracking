import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';

const ARROW_PATH = 'M12 2L19 21L12 17L5 21L12 2Z';

export type DirectionalArrowBlinkMode = 'none' | 'unassigned' | 'alert';

export interface DirectionalArrowProps {
  color: string;
  /** Bearing in degrees (0 = north). Applied via transform — Marker.rotation does not work with custom children. */
  heading?: number;
  /** @deprecated Use blinkMode instead */
  unassigned?: boolean;
  blinkMode?: DirectionalArrowBlinkMode;
  size?: number;
  /**
   * Driven by parent map screen (arrowBlink); requires Marker tracksViewChanges when blinking.
   * When omitted and blinking, toggles locally (non-map use).
   */
  blinkPhase?: 0 | 1;
}

const DirectionalArrow: React.FC<DirectionalArrowProps> = ({
  color,
  heading = 0,
  unassigned = false,
  blinkMode: blinkModeProp,
  size = 40,
  blinkPhase: blinkPhaseProp,
}) => {
  const blinkMode: DirectionalArrowBlinkMode =
    blinkModeProp ?? (unassigned ? 'unassigned' : 'none');
  const shouldBlink = blinkMode === 'unassigned' || blinkMode === 'alert';

  const [internalPhase, setInternalPhase] = useState<0 | 1>(0);
  const phase = blinkPhaseProp ?? internalPhase;

  useEffect(() => {
    if (!shouldBlink || blinkPhaseProp !== undefined) {
      return;
    }
    const timer = setInterval(() => {
      setInternalPhase(p => (p === 0 ? 1 : 0));
    }, 600);
    return () => clearInterval(timer);
  }, [shouldBlink, blinkPhaseProp]);

  let fill = color;
  let stroke = 'white';
  if (blinkMode === 'alert') {
    fill = phase === 0 ? COLORS.emergency : '#FFFFFF';
    stroke = phase === 0 ? '#FFFFFF' : COLORS.emergency;
  } else if (blinkMode === 'unassigned') {
    fill = phase === 0 ? '#000000' : '#FFFFFF';
    stroke = phase === 0 ? '#FFFFFF' : '#000000';
  }

  const rotation = ((heading % 360) + 360) % 360;

  return (
    <View
      style={{
        width: size + 10,
        height: size + 10,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${rotation}deg` }],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d={ARROW_PATH}
          fill={fill}
          stroke={stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

export default DirectionalArrow;
