const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Resolve Android SDK home without hardcoding a Windows username.
 * Prefer ANDROID_HOME / ANDROID_SDK_ROOT, then the current user's default SDK path.
 */
function resolveAndroidHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      : path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    // Ignore stale paths from another Windows user (e.g. JAMTECH on this machine).
    if (fs.existsSync(path.join(candidate, 'platform-tools', 'adb.exe')) ||
        fs.existsSync(path.join(candidate, 'platform-tools', 'adb'))) {
      return candidate;
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || '';
}

function applyAndroidHomeToEnv() {
  const androidHome = resolveAndroidHome();
  if (!androidHome) {
    throw new Error(
      'Android SDK not found. Set ANDROID_HOME or install the SDK under %LOCALAPPDATA%\\Android\\Sdk',
    );
  }

  const adbWin = path.join(androidHome, 'platform-tools', 'adb.exe');
  const adbUnix = path.join(androidHome, 'platform-tools', 'adb');
  if (!fs.existsSync(adbWin) && !fs.existsSync(adbUnix)) {
    throw new Error(
      `Android SDK found at "${androidHome}" but adb is missing. Install platform-tools.`,
    );
  }

  process.env.ANDROID_HOME = androidHome;
  process.env.ANDROID_SDK_ROOT = androidHome;

  const extras = [
    path.join(androidHome, 'platform-tools'),
    path.join(androidHome, 'emulator'),
    path.join(androidHome, 'tools'),
    path.join(androidHome, 'tools', 'bin'),
  ];

  const sep = process.platform === 'win32' ? ';' : ':';
  process.env.PATH = [...extras, process.env.PATH || ''].join(sep);
  return androidHome;
}

/**
 * Cursor / sandboxed shells often set GRADLE_USER_HOME under
 * %TEMP%\cursor-sandbox-cache\... which makes React Native prefab
 * headers exceed Windows MAX_PATH (260) and ninja fails CMake.
 * Force a short cache root on Windows when the current home is unsafe.
 */
function isUnsafeGradleUserHome(gradleHome) {
  if (!gradleHome) return true;
  const normalized = gradleHome.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('cursor-sandbox-cache')) return true;
  // Leave headroom for .../caches/.../transformed/react-android-.../prefab/.../*.h
  if (gradleHome.length > 40) return true;
  return false;
}

function applyShortGradleUserHomeToEnv() {
  if (process.platform !== 'win32') {
    return process.env.GRADLE_USER_HOME || '';
  }

  const current = process.env.GRADLE_USER_HOME || '';
  if (!isUnsafeGradleUserHome(current)) {
    return current;
  }

  const shortHome = 'C:\\g';
  fs.mkdirSync(shortHome, { recursive: true });
  process.env.GRADLE_USER_HOME = shortHome;
  return shortHome;
}

module.exports = {
  resolveAndroidHome,
  applyAndroidHomeToEnv,
  applyShortGradleUserHomeToEnv,
  isUnsafeGradleUserHome,
};
