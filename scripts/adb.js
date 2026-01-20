const { execSync, spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const projectRoot = path.join(__dirname, '..');

// Set Android SDK environment variables (same approach as run-android.js)
const androidHome = isWindows
  ? 'C:\\Users\\JAMTECH\\AppData\\Local\\Android\\Sdk'
  : process.env.ANDROID_HOME || (process.env.HOME + '/Library/Android/sdk');

process.env.ANDROID_HOME = androidHome;
process.env.PATH = isWindows
  ? [
      `${androidHome}\\platform-tools`,
      `${androidHome}\\emulator`,
      `${androidHome}\\tools`,
      `${androidHome}\\tools\\bin`,
      process.env.PATH,
    ].join(';')
  : [
      `${androidHome}/platform-tools`,
      `${androidHome}/emulator`,
      `${androidHome}/tools`,
      `${androidHome}/tools/bin`,
      process.env.PATH,
    ].join(':');

// Forward all args to adb
const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  console.error('Usage: node scripts/adb.js <adb args...>');
  process.exit(1);
}

function getSingleDeviceSerial() {
  try {
    const out = execSync('adb devices', {
      cwd: projectRoot,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('List of devices'));

    const devices = lines
      .map((l) => l.split(/\s+/))
      .filter((parts) => parts.length >= 2 && parts[1] === 'device')
      .map((parts) => parts[0]);

    return devices.length === 1 ? devices[0] : null;
  } catch (_) {
    return null;
  }
}

// If user didn't specify -s/-d/-e and exactly one device is connected, target it explicitly.
const hasTargetFlag =
  rawArgs.includes('-s') || rawArgs.includes('-d') || rawArgs.includes('-e');
const serial = !hasTargetFlag ? getSingleDeviceSerial() : null;
const effectiveArgs = serial ? ['-s', serial, ...rawArgs] : rawArgs;

// logcat -c sometimes hangs on Windows; use spawn with a hard timeout that kills the process.
const isLogcatClear = effectiveArgs[0] === 'logcat' && effectiveArgs.includes('-c');

if (isLogcatClear) {
  // Use spawn with timeout that actually kills the process
  const proc = spawn('adb', effectiveArgs, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: isWindows,
  });

  const timeout = setTimeout(() => {
    try {
      proc.kill('SIGTERM');
      // Force kill after 1 more second if still running
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
      }, 1000);
      console.error('\n⚠️  logcat -c timed out after 5 seconds (device may be slow). Continuing...');
      process.exit(0); // Exit successfully even if it hung
    } catch (_) {}
  }, 5000); // 5 second timeout for logcat -c

  proc.on('exit', (code) => {
    clearTimeout(timeout);
    process.exit(code || 0);
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    console.error('Error running adb:', err.message);
    process.exit(1);
  });
} else {
  // Normal commands use execSync
  const adbArgs = effectiveArgs.join(' ');
  execSync(`adb ${adbArgs}`, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  });
}


