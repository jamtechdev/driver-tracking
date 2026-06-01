import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import VehicleInfoCallout from './VehicleInfoCallout';

type VehicleInfoOverlayProps = {
  vehicle: Record<string, unknown>;
  onClose: () => void;
};

const TOP_PORTRAIT = 300;
const TOP_LANDSCAPE = 112;

/** Floating vehicle info panel at the top of the map. */
const VehicleInfoOverlay: React.FC<VehicleInfoOverlayProps> = ({ vehicle, onClose }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const positionStyle = useMemo(
    () => ({
      top: isLandscape ? TOP_LANDSCAPE : TOP_PORTRAIT,
    }),
    [isLandscape],
  );

  return (
    <View style={styles.host} pointerEvents="box-none">
      <View style={[styles.centered, positionStyle]} pointerEvents="auto">
        <VehicleInfoCallout vehicle={vehicle} onClose={onClose} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  centered: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
});

export default VehicleInfoOverlay;
