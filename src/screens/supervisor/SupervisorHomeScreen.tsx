/**
 * Supervisor Home - Assign/unassign vehicles, view map (per requirements)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MainLayout from '../../components/MainLayout';
import { COLORS } from '../../theme/colors';

interface SupervisorHomeScreenProps {
  navigation: any;
}

const SupervisorHomeScreen: React.FC<SupervisorHomeScreenProps> = ({ navigation }) => {
  return (
    <MainLayout navigation={navigation} showSidebar={true}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Supervisor Dashboard</Text>
        <Text style={styles.subtitle}>Assign vehicles and view routes</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Map')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🗺️</Text>
          <Text style={styles.cardTitle}>View Map</Text>
          <Text style={styles.cardDesc}>All routes and vehicles</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('RouteSelection')}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>🚌</Text>
          <Text style={styles.cardTitle}>Assign Vehicles</Text>
          <Text style={styles.cardDesc}>Assign or unassign vehicles from routes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('RouteDetails', { routeId: '1' })}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>📋</Text>
          <Text style={styles.cardTitle}>Route Management</Text>
          <Text style={styles.cardDesc}>Manage blocks and routes</Text>
        </TouchableOpacity>
      </ScrollView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default SupervisorHomeScreen;
