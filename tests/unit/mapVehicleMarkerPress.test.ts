import { renderHook, act } from '@testing-library/react-native';
import { useMapVehicleMarkerPress } from '@/hooks/useMapVehicleMarkerPress';

describe('useMapVehicleMarkerPress', () => {
  const vehicles = [{ vehicleID: '7', routeID: '1' }];

  it('opens vehicle from MapView onMarkerPress by identifier', () => {
    const onVehiclePress = jest.fn();
    const { result } = renderHook(() =>
      useMapVehicleMarkerPress(vehicles, onVehiclePress),
    );

    act(() => {
      result.current.onMapMarkerPress({ nativeEvent: { id: '7' } });
    });

    expect(onVehiclePress).toHaveBeenCalledTimes(1);
    expect(onVehiclePress).toHaveBeenCalledWith(vehicles[0]);
  });

  it('ignores stop marker presses', () => {
    const onVehiclePress = jest.fn();
    const onStopMarkerPress = jest.fn();
    const { result } = renderHook(() =>
      useMapVehicleMarkerPress(vehicles, onVehiclePress, undefined, undefined, {
        onStopMarkerPress,
      }),
    );

    act(() => {
      result.current.onMapMarkerPress({
        nativeEvent: { identifier: 'stop-1-42' },
      });
    });

    expect(onVehiclePress).not.toHaveBeenCalled();
    expect(onStopMarkerPress).toHaveBeenCalledTimes(1);
  });

  it('dedupes rapid duplicate presses', () => {
    const onVehiclePress = jest.fn();
    const { result } = renderHook(() =>
      useMapVehicleMarkerPress(vehicles, onVehiclePress),
    );

    act(() => {
      result.current.onVehicleMarkerPress(vehicles[0]);
      result.current.onMapMarkerPress({ nativeEvent: { id: '7' } });
    });

    expect(onVehiclePress).toHaveBeenCalledTimes(1);
  });
});
