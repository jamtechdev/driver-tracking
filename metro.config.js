const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Prefer CommonJS — package ESM (.mjs) breaks RN codegenNativeComponent transform.
    unstable_conditionNames: ['require', 'react-native', 'browser'],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@pawan-pk/react-native-mapbox-navigation') {
        return {
          filePath: path.resolve(
            __dirname,
            'node_modules/@pawan-pk/react-native-mapbox-navigation/lib/commonjs/index.cjs',
          ),
          type: 'sourceFile',
        };
      }
      // Optional local secrets file (gitignored). Fall back when missing.
      if (
        moduleName === './env.local' ||
        moduleName.endsWith('/config/env.local') ||
        moduleName.endsWith('\\config\\env.local')
      ) {
        const candidate = path.resolve(
          path.dirname(context.originModulePath),
          'env.local.ts',
        );
        const fs = require('fs');
        if (!fs.existsSync(candidate) && !fs.existsSync(candidate.replace(/\.ts$/, '.js'))) {
          return {
            type: 'sourceFile',
            filePath: path.resolve(__dirname, 'src/config/env.local.example.ts'),
          };
        }
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
