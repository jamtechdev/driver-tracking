/**
 * Geofence alert overlay — iOS PrimaryViewController recvGeofenceAlert / blinkGeofence.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GeofenceAlertState } from '@/context/DriverModelContext';

interface GeofenceAlertBannerProps {
  alert: GeofenceAlertState;
}

const GeofenceAlertBanner: React.FC<GeofenceAlertBannerProps> = ({ alert }) => {
  const [blinkOn, setBlinkOn] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setBlinkOn((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  const isWarning = alert.isWarning;
  const primaryBg = isWarning ? '#FFFF00' : '#FF0000';
  const primaryText = isWarning ? '#000000' : '#FFFFFF';
  const altBg = isWarning ? '#000000' : '#FFFFFF';
  const altText = isWarning ? '#FFFF00' : '#FF0000';

  const backgroundColor = blinkOn ? primaryBg : altBg;
  const color = blinkOn ? primaryText : altText;

  const title = isWarning ? 'Geofence Warning' : 'GEOFENCE ALERT';

  return (
    <View style={[styles.banner, { backgroundColor }]}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      <Text style={[styles.name, { color }]} numberOfLines={3}>
        {alert.name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default GeofenceAlertBanner;
