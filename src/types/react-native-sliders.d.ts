declare module 'react-native-sliders' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface SliderProps {
    value?: number | number[];
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    minimumTrackStyle?: ViewStyle;
    maximumTrackStyle?: ViewStyle;
    thumbStyle?: ViewStyle | ViewStyle[];
    thumbTouchSize?: { width: number; height: number };
    style?: ViewStyle;
    trackStyle?: ViewStyle;
    onValueChange?: (value: number | number[]) => void;
    onSlidingStart?: (value: number | number[]) => void;
    onSlidingComplete?: (value: number | number[]) => void;
    disabled?: boolean;
    thumbElement?: React.ReactElement | React.ReactElement[];
    debugTouchArea?: boolean;
    animateTransitions?: boolean;
    animationType?: 'spring' | 'timing';
    animationConfig?: object;
  }

  export default class Slider extends Component<SliderProps> {}
}
