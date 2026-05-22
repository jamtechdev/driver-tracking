import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { COLORS } from '../theme/colors';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <Image
        source={require('../assets/app-logo.png')}
        style={[styles.logo, isLandscape ? styles.logoLandscape : styles.logoPortrait]}
        resizeMode="contain"
      />
      <Text style={styles.subtitle}>
        {"\u00A9"} {new Date().getFullYear()} Peak Transit. All rights reserved.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logo: {
    maxHeight: '70%',
  },
  logoPortrait: {
    width: '90%',
  },
  logoLandscape: {
    width: '55%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    paddingHorizontal: 20,
  },
});

export default SplashScreen;
