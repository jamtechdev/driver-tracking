import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { formatMapVehicleInfo } from '@/utils/mapVehicleInfo';

type VehicleInfoCalloutProps = {
  vehicle: Record<string, unknown>;
  onClose: () => void;
  maxWidth?: number;
};

/** White info bubble (vehicle + route only), with bottom pointer. */
const VehicleInfoCallout: React.FC<VehicleInfoCalloutProps> = ({
  vehicle,
  onClose,
  maxWidth = 280,
}) => {
  const { vehicleId, routeLabel } = useMemo(() => formatMapVehicleInfo(vehicle), [vehicle]);
  const minWidth = Math.min(160, Math.floor(maxWidth * 0.72));

  return (
    <View style={[styles.wrapper, { maxWidth }]}>
      <View style={[styles.card, { minWidth, maxWidth }]}>
        <Pressable
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close vehicle info"
          accessibilityRole="button"
        >
          <MaterialIcons name="close" size={20} color="#4A4A4A" />
        </Pressable>
        <Text style={styles.line}>
          <Text style={styles.label}>Vehicle: </Text>
          <Text style={styles.value}>{vehicleId}</Text>
        </Text>
        <Text style={[styles.line, styles.routeLine]}>
          {/* <Text style={styles.label}>Route: </Text> */}
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
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 36,
    width: '100%',
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
