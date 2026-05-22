/**
 * Memoized schedule gauge — re-renders only when minsLate / role / size change,
 * not on every GPS tick from DriverModel.
 */

import React, { useMemo } from 'react';
import { Image } from 'react-native';
import { getGaugeImageSource, getGaugeRenderKey } from '@/utils/gaugeImage';

export interface ScheduleGaugeImageProps {
  minsLate: number | null;
  role?: string;
  width: number;
  height: number;
}

function ScheduleGaugeImageInner({ minsLate, role, width, height }: ScheduleGaugeImageProps) {
  const renderKey = useMemo(() => getGaugeRenderKey(minsLate, role), [minsLate, role]);
  const source = useMemo(() => getGaugeImageSource(minsLate, role), [minsLate, role]);

  return (
    <Image
      key={renderKey}
      source={source}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityLabel="Schedule status gauge"
    />
  );
}

const ScheduleGaugeImage = React.memo(
  ScheduleGaugeImageInner,
  (prev, next) =>
    prev.minsLate === next.minsLate &&
    prev.role === next.role &&
    prev.width === next.width &&
    prev.height === next.height,
);

export default ScheduleGaugeImage;
