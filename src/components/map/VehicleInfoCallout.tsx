import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { formatMapVehicleInfo } from '@/utils/mapVehicleInfo';

type VehicleInfoCalloutProps = {
  vehicle: Record<string, unknown>;
  onClose: () => void;
};

/** White info bubble (vehicle + route only), with bottom pointer. */
const VehicleInfoCallout: React.FC<VehicleInfoCalloutProps> = ({ vehicle, onClose }) => {
  const { vehicleId, routeLabel } = useMemo(() => formatMapVehicleInfo(vehicle), [vehicle]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Close vehicle info"
        >
          <MaterialIcons name="close" size={20} color="#4A4A4A" />
        </TouchableOpacity>
        <Text style={styles.line}>
          <Text style={styles.label}>Vehicle: </Text>
          <Text style={styles.value}>{vehicleId}</Text>
        </Text>
        <Text style={[styles.line, styles.routeLine]}>
          <Text style={styles.label}>Route: </Text>
          <Text style={styles.value}>{routeLabel}</Text>
        </Text>
      </View>
      <View style={styles.pointer} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 36,
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  line: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  routeLine: {
    marginTop: 4,
  },
  label: {
    fontWeight: '700',
  },
  value: {
    fontWeight: '400',
  },
  pointer: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});

export default VehicleInfoCallout;
