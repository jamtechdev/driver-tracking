/**
 * Settings Screen - Coming Soon
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView } from 'react-native';

const SettingsScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const features = [
    { icon: '🔔', text: 'Notification preferences' },
    { icon: '🌙', text: 'Dark mode toggle' },
    { icon: '🔒', text: 'Privacy & security' },
    { icon: '📱', text: 'App preferences' },
    { icon: 'ℹ️', text: 'About & support' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚙️</Text>
        </View>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Coming Soon</Text>
        <Text style={styles.description}>
          Customize your app experience{'\n'}
          and manage preferences
        </Text>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features:</Text>
          {features.map((item, index) => (
            <Animated.View
              key={index}
              style={[
                styles.featureCard,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.featureIcon}>{item.icon}</Text>
              <Text style={styles.featureText}>{item.text}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    alignItems: 'center',
    padding: 30,
    paddingTop: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  icon: {
    fontSize: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#95A5A6',
    fontWeight: '600',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresContainer: {
    width: '100%',
    maxWidth: 350,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 20,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  featureText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
});

export default SettingsScreen;

