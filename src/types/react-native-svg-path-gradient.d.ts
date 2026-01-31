declare module 'react-native-svg-path-gradient' {
  import { Component } from 'react';
  interface GradientPathProps {
    d: string;
    colors: string[];
    strokeWidth?: number;
    precision?: number;
    roundedCorners?: boolean;
    percent?: number;
  }
  export default class GradientPath extends Component<GradientPathProps> {}
}
