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
