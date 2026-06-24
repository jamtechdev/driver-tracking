import React, { useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function StopsView({ route, navigation }: any) {
  const stops = route?.params?.stops || [];
  const lastLocation = route?.params?.lastLocation;

  const ARRIVAL_THRESHOLD = 60; // meters

  // -------------------------------
  // 1. Find nearest stop index
  // -------------------------------
  const nearestIndex = useMemo(() => {
    if (!lastLocation || stops.length === 0) return 0;

    let bestIndex = 0;
    let bestDist = Infinity;

    stops.forEach((s: any, i: number) => {
      const d = distanceMeters(
        lastLocation.latitude,
        lastLocation.longitude,
        s.lat,
        s.lng
      );

      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    });

    return bestIndex;
  }, [stops, lastLocation]);

  // -------------------------------
  // 2. Assign stop status
  // -------------------------------
  const enrichedStops = useMemo(() => {
    return stops.map((s: any, i: number) => {
      let status: 'passed' | 'current' | 'future' = 'future';

      if (i < nearestIndex) status = 'passed';
      else if (i === nearestIndex) status = 'current';
      else status = 'future';

      return { ...s, status };
    });
  }, [stops, nearestIndex]);

  // -------------------------------
  // 3. UI Render
  // -------------------------------
  const renderItem = ({ item, index }: any) => {
    return (
      <View style={styles.row}>
        {/* LEFT RAIL */}
        <View style={styles.rail}>
          <View
            style={[
              styles.dot,
              item.status === 'passed' && { backgroundColor: '#666' },
              item.status === 'current' && { backgroundColor: '#00ff88', transform: [{ scale: 1.3 }] },
              item.status === 'future' && { backgroundColor: '#4DA3FF' },
            ]}
          />
          {index !== stops.length - 1 && <View style={styles.line} />}
        </View>

        {/* CARD */}
        <View
          style={[
            styles.card,
            item.status === 'current' && styles.currentCard,
          ]}
        >
          <Text style={styles.title}>{item.longName}</Text>

          <Text style={styles.meta}>
            {item.status === 'current'
              ? '🟢 Current / Nearest Stop'
              : item.status === 'passed'
              ? '✔ Passed'
              : '🔵 Upcoming'}
          </Text>
        </View>
      </View>
    );
  };

  // -------------------------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.header}>Live Tracking</Text>
      </View>

      {/* LIST */}
      <FlatList
        data={enrichedStops}
        keyExtractor={(i) => i.stopID?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </View>
  );
}

// -------------------------------
// STYLES
// -------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070D',
    paddingHorizontal: 20,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 10,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
  },

  header: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
  },

  rail: {
    width: 30,
    alignItems: 'center',
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 16,
  },

  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#1f2937',
    marginTop: 4,
  },

  card: {
    flex: 1,
    backgroundColor: '#0B1220',
    padding: 14,
    marginBottom: 14,
    borderRadius: 14,
  },

  currentCard: {
    borderWidth: 1,
    borderColor: '#00ff88',
  },

  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  meta: {
    marginTop: 6,
    color: '#9CA3AF',
    fontSize: 12,
  },
});