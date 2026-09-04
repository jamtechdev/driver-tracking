const { execSync, spawn } = require('child_process');
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
    return !fs.existsSync(p);
  } catch (_) {
    // best-effort; file locks on Windows can still block cleanup
    return !fs.existsSync(p);
  }
}

function sleepMs(ms) {
  try {
    execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, {
      stdio: 'ignore',
      env: process.env,
    });
  } catch (_) {
    // ignore
  }
}

/** Windows: remove a tree with retries; cmake/gradle often hold CMakeTmp briefly. */
function rmrfRetry(p, label, attempts = 6) {
  for (let i = 1; i <= attempts; i++) {
    if (!fs.existsSync(p)) return true;
    // Clear read-only bits that block deletes after a crashed CMake run.
    runQuiet(`cmd /c "attrib -R -S -H \\"${p}\\*\\" /S /D"`);
    if (rmrf(p)) return true;
    // cmd rmdir is sometimes more stubborn than fs.rmSync on locked trees.
    runQuiet(`cmd /c "rmdir /S /Q \\"${p}\\""`);
    if (!fs.existsSync(p)) return true;
    console.warn(`[run-android] ${label} still locked (attempt ${i}/${attempts})`);
    sleepMs(500 * i);
  }
  return !fs.existsSync(p);
}

function stopGradleDaemons() {
  // Stop daemons for both short GRADLE_USER_HOME (C:\\g) and the default home.
  // Android Studio and CLI often leave two daemons; both use C:/c/dt and race on CMakeTmp.
  runQuiet('cmd /c "cd android && gradlew.bat --stop"');
  const prevHome = process.env.GRADLE_USER_HOME;
  try {
    process.env.GRADLE_USER_HOME = path.join(
      process.env.USERPROFILE || process.env.HOME || '',
      '.gradle',
    );
    runQuiet('cmd /c "cd android && gradlew.bat --stop"');
  } finally {
    if (prevHome === undefined) delete process.env.GRADLE_USER_HOME;
    else process.env.GRADLE_USER_HOME = prevHome;
  }
}

function preflightWindowsLocks() {
  if (!isWindows) return;

  // Stop Gradle daemons to release any lingering native build handles.
  // Important after relocating GRADLE_USER_HOME away from sandbox cache.
  stopGradleDaemons();

  // Kill common native build tool processes that can keep .so files open.
  // Keep this scoped to build tooling (avoid killing all java.exe).
  runQuiet('cmd /c "taskkill /F /T /IM ninja.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM cmake.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM clang.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM clang++.exe"');
  runQuiet('cmd /c "taskkill /F /T /IM ld.lld.exe"');

  // Brief pause so Windows releases directory handles after taskkill/gradle --stop.
  sleepMs(1500);

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
  // Also clears half-written CMakeTmp that causes FileSystemException on Windows.
  const cmakeStaging = 'C:\\c\\dt';
  if (!rmrfRetry(cmakeStaging, 'CMake staging C:\\c\\dt')) {
    console.error(
      '[run-android] Could not clear C:\\c\\dt (file in use). Close Android Studio / other Gradle builds, then retry.',
    );
    process.exit(1);
  }
  try {
    fs.mkdirSync(cmakeStaging, { recursive: true });
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

function adbBin() {
  const home = process.env.ANDROID_HOME || '';
  const win = path.join(home, 'platform-tools', 'adb.exe');
  const unix = path.join(home, 'platform-tools', 'adb');
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  return 'adb';
}

function emulatorBin() {
  const home = process.env.ANDROID_HOME || '';
  const win = path.join(home, 'emulator', 'emulator.exe');
  const unix = path.join(home, 'emulator', 'emulator');
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(unix)) return unix;
  return 'emulator';
}

function listConnectedDevices() {
  try {
    const out = execSync(`"${adbBin()}" devices`, {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('List of devices'))
      .map((l) => l.split(/\s+/))
      .filter((parts) => parts.length >= 2 && parts[1] === 'device')
      .map((parts) => parts[0]);
  } catch (_) {
    return [];
  }
}

function listAvds() {
  try {
    const out = execSync(`"${emulatorBin()}" -list-avds`, {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function pickAvd(avds) {
  const preferred = process.env.ANDROID_AVD || process.env.REACT_NATIVE_ANDROID_AVD;
  if (preferred && avds.includes(preferred)) return preferred;
  // Prefer phone AVDs over tablets when both exist.
  const phone = avds.find((n) => /pixel(?!_tablet)/i.test(n) || /phone/i.test(n));
  return phone || avds[0];
}

function waitForBoot(serial, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const boot = execSync(`"${adbBin()}" -s ${serial} shell getprop sys.boot_completed`, {
        cwd: projectRoot,
        env: process.env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (boot === '1') return true;
    } catch (_) {
      // device not ready yet
    }
    sleepMs(2000);
  }
  return false;
}

function ensureAndroidDevice() {
  const existing = listConnectedDevices();
  if (existing.length > 0) {
    console.log(`[run-android] Using connected device: ${existing.join(', ')}`);
    return;
  }

  const avds = listAvds();
  if (avds.length === 0) {
    console.error(
      '[run-android] No Android device/emulator connected, and no AVDs found. Start an emulator or plug in a device.',
    );
    process.exit(1);
  }

  const avd = pickAvd(avds);
  console.log(`[run-android] No device connected — starting emulator: ${avd}`);
  // Windows + older GPUs often hang on gfxstream/host GPU; swiftshader is slower but reliable.
  // -no-snapshot-load avoids stuck boots from a corrupt quick-boot snapshot.
  const emuArgs = [
    '-avd',
    avd,
    '-no-snapshot-load',
    ...(isWindows ? ['-gpu', 'swiftshader_indirect'] : []),
  ];
  const child = spawn(emulatorBin(), emuArgs, {
    cwd: projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
    // Keep a normal window on Windows so the emulator UI can initialize.
    windowsHide: false,
  });
  child.unref();

  console.log('[run-android] Waiting for emulator to appear in adb...');
  const appearDeadline = Date.now() + 120000;
  let serial = null;
  while (Date.now() < appearDeadline) {
    const devices = listConnectedDevices();
    // Prefer emulator-* serials when we just launched one.
    serial = devices.find((d) => d.startsWith('emulator-')) || devices[0] || null;
    if (serial) break;
    sleepMs(2000);
  }
  if (!serial) {
    console.error('[run-android] Emulator did not appear in adb. Open Android Studio → Device Manager and start it manually.');
    process.exit(1);
  }

  console.log(`[run-android] Waiting for boot on ${serial}...`);
  if (!waitForBoot(serial)) {
    console.error(`[run-android] Emulator ${serial} did not finish booting in time.`);
    process.exit(1);
  }
  console.log(`[run-android] Emulator ready: ${serial}`);
}

preflightWindowsLocks();
ensureAndroidDevice();

// Run React Native Android
run('react-native run-android');
