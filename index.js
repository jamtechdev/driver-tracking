/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import App from './App';
import { name as appName } from './app.json';

// Allow both portrait and landscape so app fills screen in vertical and horizontal
Orientation.unlockAllOrientations();

// import notifee, { EventType } from '@notifee/react-native';

// // Handle background events for Notifee (required for Foreground Services)
// notifee.onBackgroundEvent(async ({ type, detail }) => {
//     const { notification, pressAction } = detail;

//     // Handle specific notification events if needed
//     if (type === EventType.PRESS && pressAction?.id === 'default') {
//         // User pressed the notification
//         console.log('[Notifee] Background event: Notification pressed');
//     }
// });
AppRegistry.registerComponent(appName, () => App);
