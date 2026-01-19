/**
 * Login Screen
 * Placeholder - to be implemented in Week 2
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LoginScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Login Screen - To be implemented</Text>
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

export default LoginScreen;

