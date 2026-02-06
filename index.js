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

AppRegistry.registerComponent(appName, () => App);
