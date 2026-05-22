/**
 * Static gauge PNG requires (Metro must see literal require paths).
 * Import from here — do not use dynamic require() keys.
 */

import type { ImageSourcePropType } from 'react-native';

export const GAUGE_ASSETS = {
  onTime: require('../assets/gauge/on_time.png') as ImageSourcePropType,
  noStatus: require('../assets/gauge/no_status.png') as ImageSourcePropType,
  early1: require('../assets/gauge/1_early.png') as ImageSourcePropType,
  early2: require('../assets/gauge/2_early.png') as ImageSourcePropType,
  early3: require('../assets/gauge/3_early.png') as ImageSourcePropType,
  early4: require('../assets/gauge/4_early.png') as ImageSourcePropType,
  early5: require('../assets/gauge/5_early.png') as ImageSourcePropType,
  early6: require('../assets/gauge/6_early.png') as ImageSourcePropType,
  early7: require('../assets/gauge/7_early.png') as ImageSourcePropType,
  early8: require('../assets/gauge/8_early.png') as ImageSourcePropType,
  early9: require('../assets/gauge/9_early.png') as ImageSourcePropType,
  early10: require('../assets/gauge/10_early.png') as ImageSourcePropType,
  late1: require('../assets/gauge/1_late.png') as ImageSourcePropType,
  late2: require('../assets/gauge/2_late.png') as ImageSourcePropType,
  late3: require('../assets/gauge/3_late.png') as ImageSourcePropType,
  late4: require('../assets/gauge/4_late.png') as ImageSourcePropType,
  late5: require('../assets/gauge/5_late.png') as ImageSourcePropType,
  late6: require('../assets/gauge/6_late.png') as ImageSourcePropType,
  late7: require('../assets/gauge/7_late.png') as ImageSourcePropType,
  late8: require('../assets/gauge/8_late.png') as ImageSourcePropType,
  late9: require('../assets/gauge/9_late.png') as ImageSourcePropType,
  late10: require('../assets/gauge/10_late.png') as ImageSourcePropType,
  late11: require('../assets/gauge/11_late.png') as ImageSourcePropType,
  late12: require('../assets/gauge/12_late.png') as ImageSourcePropType,
  late13: require('../assets/gauge/13_late.png') as ImageSourcePropType,
  late14: require('../assets/gauge/14_late.png') as ImageSourcePropType,
  late15: require('../assets/gauge/15_late.png') as ImageSourcePropType,
  late16: require('../assets/gauge/16_late.png') as ImageSourcePropType,
  late17: require('../assets/gauge/17_late.png') as ImageSourcePropType,
  late18: require('../assets/gauge/18_late.png') as ImageSourcePropType,
  late19: require('../assets/gauge/19_late.png') as ImageSourcePropType,
  late20: require('../assets/gauge/20_late.png') as ImageSourcePropType,
} as const;
