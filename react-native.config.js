/**
 * Prevent @react-native-community/geolocation from being added to Android CMake
 * autolinking. Its codegen jni directory is not generated before the app's
 * CMake runs, which causes build failure. The native Java package is still
 * linked via the package list; only the New Architecture codegen CMake entry
 * is skipped.
 */
const path = require('path');

const geolocationPath = path.join(
  __dirname,
  'node_modules',
  '@react-native-community',
  'geolocation'
);

module.exports = {
  dependencies: {
    '@react-native-community/geolocation': {
      root: geolocationPath,
      platforms: {
        android: {
          sourceDir: path.join(geolocationPath, 'android'),
          packageImportPath: 'import com.reactnativecommunity.geolocation.GeolocationPackage;',
          packageInstance: 'new GeolocationPackage()',
          buildTypes: [],
          libraryName: null,
          componentDescriptors: [],
          cmakeListsPath: null,
        },
      },
    },
  },
};
