const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const {
  applyAndroidHomeToEnv,
  applyShortGradleUserHomeToEnv,
} = require('./android-sdk-home');

const isWindows = process.platform === 'win32';
const projectRoot = path.join(__dirname, '..');

const androidHome = applyAndroidHomeToEnv();
const gradleUserHome = applyShortGradleUserHomeToEnv();
console.log(`[run-android] ANDROID_HOME=${androidHome}`);
console.log(`[run-android] GRADLE_USER_HOME=${gradleUserHome || '(default)'}`);

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
  // Important after relocating GRADLE_USER_HOME away from sandbox cache.
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
  rmrf(path.join(projectRoot, 'android', 'app', '.cxx'));
  // CMake staging keeps absolute prefab include paths — wipe when GRADLE_USER_HOME moves
  // off Cursor's long sandbox cache or ninja keeps failing with MAX_PATH.
  rmrf('C:\\c\\dt');
  try {
    fs.mkdirSync('C:\\c\\dt', { recursive: true });
  } catch (_) {
    // best-effort
  }

  // Library .cxx folders bake absolute GRADLE_USER_HOME prefab paths into ninja files.
  wipeNativeModuleCxxCaches();
}

function wipeNativeModuleCxxCaches() {
  const nodeModules = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModules)) return;

  const queue = [nodeModules];
  while (queue.length > 0) {
    const dir = queue.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === '.cxx') {
        rmrf(full);
        continue;
      }
      if (entry.name === 'android' || entry.name.startsWith('@') || dir === nodeModules) {
        queue.push(full);
      } else if (path.basename(dir).startsWith('@')) {
        queue.push(full);
      }
    }
  }
}

preflightWindowsLocks();

// Run React Native Android
run('react-native run-android');
