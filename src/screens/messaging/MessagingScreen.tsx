/**
 * Messaging Screen
 * Placeholder - to be implemented in Week 7
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MessagingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Messaging Screen - To be implemented</Text>
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

export default MessagingScreen;

