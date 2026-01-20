/**
 * Route Selection Screen
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface RouteSelectionScreenProps {
  navigation: any;
}

const RouteSelectionScreen: React.FC<RouteSelectionScreenProps> = ({ navigation }) => {
  const handleRouteSelect = (routeId: string) => {
    // TODO: Implement route selection logic
    navigation.navigate('RouteDetails', { routeId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Route</Text>
      <Text style={styles.subtitle}>Choose a route to view details</Text>
      
      <TouchableOpacity 
        style={styles.routeItem}
        onPress={() => handleRouteSelect('route1')}
      >
        <Text style={styles.routeText}>Route 1</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.routeItem}
        onPress={() => handleRouteSelect('route2')}
      >
        <Text style={styles.routeText}>Route 2</Text>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 30,
  },
  routeItem: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  routeText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '500',
  },
  arrow: {
    fontSize: 20,
    color: '#007AFF',
  },
});

export default RouteSelectionScreen;

