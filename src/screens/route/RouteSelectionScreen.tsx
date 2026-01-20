/**
 * Route Selection Screen - Professional Design
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface RouteSelectionScreenProps {
  navigation: any;
}

const RouteSelectionScreen: React.FC<RouteSelectionScreenProps> = ({ navigation }) => {
  const routes = [
    { id: 'route1', name: 'Route 101', stops: 12, duration: '45 min', status: 'Active' },
    { id: 'route2', name: 'Route 202', stops: 8, duration: '30 min', status: 'Available' },
    { id: 'route3', name: 'Route 303', stops: 15, duration: '60 min', status: 'Available' },
  ];

  const handleRouteSelect = (routeId: string) => {
    // TODO: Implement route selection logic
    navigation.navigate('RouteDetails', { routeId });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Route</Text>
        <Text style={styles.subtitle}>Choose your route for today</Text>
      </View>

      <View style={styles.routesContainer}>
        {routes.map((route) => (
          <TouchableOpacity
            key={route.id}
            style={styles.routeCard}
            onPress={() => handleRouteSelect(route.id)}
            activeOpacity={0.7}
          >
            <View style={styles.routeHeader}>
              <View style={styles.routeIconContainer}>
                <Text style={styles.routeIcon}>🚌</Text>
              </View>
              <View style={styles.routeInfo}>
                <Text style={styles.routeName}>{route.name}</Text>
                <View style={styles.routeMeta}>
                  <Text style={styles.routeMetaText}>📍 {route.stops} stops</Text>
                  <Text style={styles.routeMetaText}>⏱️ {route.duration}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.statusBadge, route.status === 'Active' && styles.statusBadgeActive]}>
              <Text style={[styles.statusText, route.status === 'Active' && styles.statusTextActive]}>
                {route.status}
              </Text>
            </View>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#1E3A5F',
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B8D4F0',
  },
  routesContainer: {
    padding: 20,
    marginTop: 10,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  routeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  routeIcon: {
    fontSize: 24,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 6,
  },
  routeMeta: {
    flexDirection: 'row',
    gap: 15,
  },
  routeMetaText: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusTextActive: {
    color: '#059669',
  },
  arrowContainer: {
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 24,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
});

export default RouteSelectionScreen;

