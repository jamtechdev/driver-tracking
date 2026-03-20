// /**
//  * Permission Handling Utilities
//  */

// import { Platform, PermissionsAndroid } from 'react-native';

// /**
//  * Request location permission
//  */
// export const requestLocationPermission = async (): Promise<boolean> => {
//   if (Platform.OS === 'android') {
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//         {
//           title: 'Location Permission',
//           message: 'This app needs access to your location for GPS tracking.',
//           buttonNeutral: 'Ask Me Later',
//           buttonNegative: 'Cancel',
//           buttonPositive: 'OK',
//         }
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch (err) {
//       console.warn(err);
//       return false;
//     }
//   } else {
//     // For iOS, background location is required for tracking.
//     // The prompt is typically handled by the library, but we return true as a placeholder.
//     return true;
//   }
// };

// /**
//  * Request background location permission
//  */
// export const requestBackgroundLocationPermission = async (): Promise<boolean> => {
//   if (Platform.OS === 'android') {
//     try {
//       const granted = await PermissionsAndroid.request(
//         PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
//         {
//           title: 'Background Location Permission',
//           message: 'This app needs background location access for GPS tracking.',
//           buttonNeutral: 'Ask Me Later',
//           buttonNegative: 'Cancel',
//           buttonPositive: 'OK',
//         }
//       );
//       return granted === PermissionsAndroid.RESULTS.GRANTED;
//     } catch (err) {
//       console.warn(err);
//       return false;
//     }
//   } else {
//     return true;
//   }
// };



import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }

    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

export const requestBackgroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  try {
    const bg = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );

    if (bg === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    } else {
      // Redirect user to settings (important for Android 11+)
      Alert.alert('Background Location Required',
  'To enable continuous GPS tracking, please allow location access "All the time" in your device settings.',
        [{ text: 'OK', onPress: () => Linking.openSettings() }])
      return false;
    }
  } catch (err) {
    console.warn(err);
    return false;
  }
};
