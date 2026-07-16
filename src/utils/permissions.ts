import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

function isIosLocationGranted(status: string): boolean {
  return status === 'granted' || status === 'restricted';
}

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    try {
      const whenInUse = await Geolocation.requestAuthorization('whenInUse');
      if (!isIosLocationGranted(whenInUse)) {
        return false;
      }

      const always = await Geolocation.requestAuthorization('always');
      return isIosLocationGranted(always) || isIosLocationGranted(whenInUse);
    } catch (err) {
      console.warn('[permissions] iOS location request failed:', err);
      return false;
    }
  }

  if (Platform.OS !== 'android') return true;

  try {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs access to your location for GPS tracking.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );

    return fine === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[permissions] Android location request failed:', err);
    return false;
  }
};

export async function hasBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 29) {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
}

export const requestBackgroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const bg = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Background Location Permission',
        message: 'This app needs background location access for GPS tracking.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );

    if (bg === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    }

    Alert.alert(
      'Background Location Required',
      'To enable continuous GPS tracking, please allow location access "All the time" in your device settings.',
      [{ text: 'OK', onPress: () => Linking.openSettings() }],
    );
    return false;
  } catch (err) {
    console.warn('[permissions] Android background location request failed:', err);
    return false;
  }
};

/**
 * Android 13+ notification permission — Mapbox Navigation uses a foreground
 * service notification. Denial should not block nav, but granting avoids
 * library warnings and FGS issues on some devices.
 */
export async function requestPostNotificationsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Notification Permission',
        message:
          'Turn-by-turn navigation shows a persistent notification while a trip is active.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[permissions] Android notification request failed:', err);
    return false;
  }
}

/** Request foreground then background location — call once the app UI is visible. */
export async function requestInitialAppLocationPermissions(): Promise<boolean> {
  const foregroundGranted = await requestLocationPermission();
  if (!foregroundGranted) {
    return false;
  }
  return requestBackgroundLocationPermission();
}
