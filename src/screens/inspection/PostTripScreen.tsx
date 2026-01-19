/**
 * Post-Trip Inspection Screen
 * Placeholder - to be implemented in Week 8
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PostTripScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Post-Trip Inspection Screen - To be implemented</Text>
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

export default PostTripScreen;

