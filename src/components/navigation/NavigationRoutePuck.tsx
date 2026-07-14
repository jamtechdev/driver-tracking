/**
 * Google Maps Navigation arrow — wide rounded triangle with thick white rim.
 * Matches Maps nav token: squat chevron, soft corners, concave base scoop.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';

interface NavigationRoutePuckProps {
  size?: number;
  color?: string;
}

export default function NavigationRoutePuck({
  size = 76,
  color = '#4285F4',
}: NavigationRoutePuckProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} collapsable={false}>
      <Svg width={size} height={size} viewBox="0 0 96 88">
        <Defs>
          <LinearGradient
            id="navArrowFill"
            x1="48"
            y1="6"
            x2="48"
            y2="74"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#5B9CFF" />
            <Stop offset="0.5" stopColor={color} />
            <Stop offset="1" stopColor="#1967D2" />
          </LinearGradient>
        </Defs>

        {/* Soft drop shadow under the token */}
        <Ellipse cx="48" cy="76" rx="26" ry="7" fill="rgba(0,0,0,0.3)" />

        {/*
          Outer white body (gives thick molded rim + corner radius).
          Wide track, rounded tip, flared base tips, concave scoop.
        */}
        <Path
          d="M48 8
             C58 8 72 36 82 60
             C85 66 82 72 75 71
             C66 69 56 58 48 58
             C40 58 30 69 21 71
             C14 72 11 66 14 60
             C24 36 38 8 48 8Z"
          fill="#FFFFFF"
        />

        {/* Inner blue fill — inset for thick white border */}
        <Path
          d="M48 16
             C56 16 68 38 76 56
             C78 60 76 64 71 63.5
             C64 62 55 54 48 54
             C41 54 32 62 25 63.5
             C20 64 18 60 20 56
             C28 38 40 16 48 16Z"
          fill="url(#navArrowFill)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
