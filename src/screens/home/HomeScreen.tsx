/**
 * Home Screen - Driver Dashboard
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const menuItems = [
    { title: 'Route Selection', screen: 'RouteSelection', icon: '🚌', color: '#4A90E2' },
    { title: 'Map', screen: 'Map', icon: '🗺️', color: '#50C878' },
    { title: 'Pre-Trip Inspection', screen: 'PreTrip', icon: '✅', color: '#FF6B6B' },
    { title: 'Post-Trip Inspection', screen: 'PostTrip', icon: '📋', color: '#FFA500' },
    { title: 'Passenger Fare', screen: 'PassengerFare', icon: '💰', color: '#9B59B6' },
    { title: 'Messaging', screen: 'Messaging', icon: '💬', color: '#3498DB' },
    { title: 'Settings', screen: 'Settings', icon: '⚙️', color: '#95A5A6' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.profileCircle}>
            <Text style={styles.profileIcon}>👤</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Good Morning</Text>
            <Text style={styles.driverName}>Driver #1234</Text>
          </View>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Active</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <Animated.View
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.statCard}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Routes Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>8h</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>45</Text>
          <Text style={styles.statLabel}>Passengers</Text>
        </View>
      </Animated.View>

      {/* Menu Grid */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuCard, { borderLeftColor: item.color }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={styles.menuCardText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#1E3A5F',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2C5282',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileIcon: {
    fontSize: 30,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#B8D4F0',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C5282',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  menuContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  menuCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A5F',
    lineHeight: 20,
  },
});

export default HomeScreen;

