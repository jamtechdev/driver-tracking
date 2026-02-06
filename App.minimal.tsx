/**
 * Minimal App - Debug bootstrap (shows if React/JS loads)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Driver Tracking</Text>
      <Text style={styles.sub}>JS loaded</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2228',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { fontSize: 24, fontWeight: '600', color: '#FFF' },
  sub: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
});
