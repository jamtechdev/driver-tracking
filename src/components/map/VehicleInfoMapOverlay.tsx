import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import VehicleInfoCallout from './VehicleInfoCallout';
import { VEHICLE_MARKER_ARROW_SIZE } from './VehicleMapMarkerContent';
import {
  computeCalloutScreenPosition,
  estimateMapPoint,
  fetchMapPointForCoordinate,
  resolveCalloutWidth,
  type MapCoordinate,
  type MapPoint,
} from '@/utils/mapOverlayPosition';

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type VehicleInfoMapOverlayProps = {
  mapRef: React.RefObject<{ pointForCoordinate?: (c: MapCoordinate) => Promise<MapPoint> | MapPoint } | null>;
  mapReady: boolean;
  regionTick: number;
  region: MapRegion;
  mapLayout: { width: number; height: number };
  coordinate: MapCoordinate;
  vehicle: Record<string, unknown>;
  onClose: () => void;
};

/** Fallback until onLayout reports the real bubble height. */
const ESTIMATED_CALLOUT_HEIGHT = 78;
/** Gap between pointer tip and top of the arrow icon. */
const POINTER_GAP = 4;

/** Map-attached vehicle info bubble — rendered above MapView so the close button receives taps. */
const VehicleInfoMapOverlay: React.FC<VehicleInfoMapOverlayProps> = ({
  mapRef,
  mapReady,
  regionTick,
  region,
  mapLayout,
  coordinate,
  vehicle,
  onClose,
}) => {
  const [calloutHeight, setCalloutHeight] = useState(ESTIMATED_CALLOUT_HEIGHT);
  const [nativeAnchor, setNativeAnchor] = useState<MapPoint | null>(null);

  const calloutWidth = useMemo(
    () => resolveCalloutWidth(mapLayout.width),
    [mapLayout.width],
  );

  const estimatedAnchor = useMemo(
    () => estimateMapPoint(coordinate, region, mapLayout),
    [
      coordinate.latitude,
      coordinate.longitude,
      region.latitude,
      region.longitude,
      region.latitudeDelta,
      region.longitudeDelta,
      mapLayout.width,
      mapLayout.height,
      regionTick,
    ],
  );

  useLayoutEffect(() => {
    setNativeAnchor(null);
  }, [
    coordinate.latitude,
    coordinate.longitude,
    region.latitude,
    region.longitude,
    region.latitudeDelta,
    region.longitudeDelta,
    mapLayout.width,
    mapLayout.height,
    regionTick,
  ]);

  const refreshNativeAnchor = useCallback(async () => {
    if (!mapReady) return;
    const point = await fetchMapPointForCoordinate(mapRef, coordinate);
    if (point) {
      setNativeAnchor(point);
    }
  }, [mapRef, mapReady, coordinate.latitude, coordinate.longitude]);

  useEffect(() => {
    refreshNativeAnchor();
    if (!mapReady) return undefined;
    const retry = setTimeout(refreshNativeAnchor, 80);
    return () => clearTimeout(retry);
  }, [refreshNativeAnchor, mapReady, regionTick, mapLayout.width, mapLayout.height]);

  const anchor = nativeAnchor ?? estimatedAnchor;

  const screenPosition = useMemo(
    () =>
      computeCalloutScreenPosition(
        anchor,
        mapLayout,
        calloutWidth,
        calloutHeight,
        VEHICLE_MARKER_ARROW_SIZE,
        POINTER_GAP,
      ),
    [anchor, mapLayout, calloutWidth, calloutHeight],
  );

  const handleCalloutLayout = useCallback(
    (event: { nativeEvent: { layout: { height: number } } }) => {
      const height = event.nativeEvent.layout.height;
      if (height > 0 && Math.abs(height - calloutHeight) > 0.5) {
        setCalloutHeight(height);
      }
    },
    [calloutHeight],
  );

  return (
    <View style={styles.host} pointerEvents="box-none">
      <View
        style={[
          styles.calloutHost,
          {
            left: screenPosition.left,
            top: screenPosition.top,
            width: screenPosition.calloutWidth,
            marginLeft: -screenPosition.calloutWidth / 2,
          },
        ]}
        pointerEvents="auto"
        onLayout={handleCalloutLayout}
      >
        <VehicleInfoCallout
          vehicle={vehicle}
          onClose={onClose}
          maxWidth={screenPosition.calloutWidth}
        />
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
  calloutHost: {
    position: 'absolute',
    alignItems: 'center',
  },
});

export default VehicleInfoMapOverlay;
