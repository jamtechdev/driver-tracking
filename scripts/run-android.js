const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const projectRoot = path.join(__dirname, '..');

// Set Android SDK environment variables
const androidHome = isWindows 
  ? 'C:\\Users\\JAMTECH\\AppData\\Local\\Android\\Sdk'
  : process.env.ANDROID_HOME || process.env.HOME + '/Library/Android/sdk';

if (isWindows) {
  process.env.ANDROID_HOME = androidHome;
  process.env.PATH = [
    `${androidHome}\\platform-tools`,
    `${androidHome}\\emulator`,
    `${androidHome}\\tools`,
    `${androidHome}\\tools\\bin`,
    process.env.PATH
  ].join(';');
} else {
  process.env.ANDROID_HOME = androidHome;
  process.env.PATH = [
    `${androidHome}/platform-tools`,
    `${androidHome}/emulator`,
    `${androidHome}/tools`,
    `${androidHome}/tools/bin`,
    process.env.PATH
  ].join(':');
}

function run(cmd, options = {}) {
  execSync(cmd, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    ...options,
  });
}

function runQuiet(cmd, options = {}) {
  try {
    execSync(cmd, {
      stdio: 'ignore',
      cwd: projectRoot,
      env: process.env,
      ...options,
    });
  } catch (_) {
    // best-effort
  }
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) {
    // best-effort; file locks on Windows can still block cleanup
  }
}

function preflightWindowsLocks() {
  if (!isWindows) return;

  // Stop Gradle daemons to release any lingering native build handles.
  runQuiet('cmd /c "cd android && gradlew.bat --stop"');

  // Kill common native build tool processes that can keep .so files open.
  // Keep this scoped to build tooling (avoid killing all java.exe).
  runQuiet('cmd /c "taskkill /F /T /IM ninja.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM cmake.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM clang.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM clang++.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM ld.lld.exe"');

  // Restart adb (we saw: "could not read ok from ADB Server").
  runQuiet('node scripts/adb.js kill-server');
  runQuiet('node scripts/adb.js start-server');

  // Clean the most common locked outputs.
  rmrf(path.join(projectRoot, 'node_modules', 'react-native-reanimated', 'android', 'build'));
  rmrf(path.join(projectRoot, 'android', 'app', 'build'));
  rmrf(path.join(projectRoot, 'android', 'build'));
  rmrf(path.join(projectRoot, 'android', '.cxx'));
}

preflightWindowsLocks();

// Run React Native Android
run('react-native run-android');

