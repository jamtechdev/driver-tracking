/**
 * Route Selection Screen
 * Placeholder - to be implemented in Week 3
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const RouteSelectionScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Route Selection Screen - To be implemented</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});

export default RouteSelectionScreen;

