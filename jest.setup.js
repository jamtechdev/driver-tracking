/**
 * Global Jest setup: native modules, navigation primitives, and shared mocks.
 * @see https://reactnative.dev/docs/testing-overview
 */

require('@testing-library/react-native/extend-expect');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-vector-icons', () => 'Icon');

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => React.createElement(View, { ...props, ref })),
    Marker: (props) => React.createElement(View, props),
    Polyline: (props) => React.createElement(View, props),
  };
});

jest.mock('@react-native-community/geolocation', () => {
  const getCurrentPosition = jest.fn((success) =>
    success({
      coords: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        heading: 0,
        speed: 0,
        altitude: 0,
      },
    }),
  );
  const watchPosition = jest.fn(() => 42);
  const clearWatch = jest.fn();
  const api = { getCurrentPosition, watchPosition, clearWatch };
  return { __esModule: true, default: api, getCurrentPosition, watchPosition, clearWatch };
});

jest.mock('react-native-tts', () => ({
  getInitStatus: jest.fn(() => Promise.resolve('ok')),
  setDefaultLanguage: jest.fn(() => Promise.resolve()),
  setDefaultVoice: jest.fn(() => Promise.resolve()),
  setDefaultRate: jest.fn(() => Promise.resolve()),
  setDefaultPitch: jest.fn(() => Promise.resolve()),
  speak: jest.fn(),
  stop: jest.fn(),
  requestInstallEngine: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('react-native-brightness-control', () => ({
  __esModule: true,
  default: {
    setBrightness: jest.fn(() => Promise.resolve(true)),
    getBrightness: jest.fn(() => Promise.resolve(1)),
  },
}));

jest.mock('react-native-orientation-locker', () => ({
  lockToPortrait: jest.fn(),
  lockToLandscape: jest.fn(),
  unlockAllOrientations: jest.fn(),
  addOrientationListener: jest.fn(),
  removeOrientationListener: jest.fn(),
}));

jest.mock('react-native-keep-awake', () => ({
  __esModule: true,
  default: {
    activate: jest.fn(),
    deactivate: jest.fn(),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    displayNotification: jest.fn(() => Promise.resolve()),
    cancelNotification: jest.fn(() => Promise.resolve()),
    getNotificationSettings: jest.fn(() =>
      Promise.resolve({ authorizationStatus: 1 }),
    ),
  },
  AndroidImportance: { LOW: 2 },
  AndroidStyle: {},
  AndroidForegroundServiceType: {},
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
  EventType: { PRESS: 1 },
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('react-native-screens', () => {
  try {
    const actual = jest.requireActual('react-native-screens');
    return { ...actual, enableScreens: jest.fn() };
  } catch {
    return { enableScreens: jest.fn() };
  }
});

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(() => Promise.resolve('TESTUNIQUEID123456')),
  getUniqueIdSync: jest.fn(() => 'TESTUNIQUEIDSYNC'),
  getSystemVersion: jest.fn(() => '17.0'),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.9)),
  isBatteryCharging: jest.fn(() => Promise.resolve(false)),
  getDeviceNameSync: jest.fn(() => 'Jest Device'),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() =>
      Promise.resolve({
        type: 'wifi',
        isConnected: true,
        details: { ssid: 'TestWiFi' },
      }),
    ),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = (props) => React.createElement(View, props);
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Path: Mock,
    Line: Mock,
    Circle: Mock,
  };
});

jest.mock('react-native-svg-path-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(View, props) };
});

jest.mock('react-native-sliders', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(View, props) };
});

jest.mock('react-native-geolocation-service', () => ({
  __esModule: true,
  default: {
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    getCurrentPosition: jest.fn(),
  },
}));

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => Promise.resolve(false)),
  },
}));

jest.mock('react-native-device-battery', () => ({
  __esModule: true,
  default: {
    isCharging: jest.fn(() => Promise.resolve(false)),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native-volume-manager', () => ({
  VolumeManager: {
    getVolume: jest.fn(() => Promise.resolve({ volume: 0.5 })),
    addVolumeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 12, right: 0, bottom: 12, left: 0 };
  return {
    SafeAreaProvider: ({ children }) =>
      React.createElement(View, { style: { flex: 1 } }, children),
    SafeAreaView: ({ children, style, ...rest }) =>
      React.createElement(View, { style: [{ flex: 1 }, style], ...rest }, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});
