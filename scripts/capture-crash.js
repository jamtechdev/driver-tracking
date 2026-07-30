const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { applyAndroidHomeToEnv } = require('./android-sdk-home');

const isWindows = process.platform === 'win32';
const projectRoot = path.join(__dirname, '..');

applyAndroidHomeToEnv();

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

const serial = getSingleDeviceSerial();
const deviceFlag = serial ? ['-s', serial] : [];

console.log('📱 Launching app...');
execSync(`adb ${deviceFlag.join(' ')} shell am start -n com.drivertracking/.MainActivity`, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

console.log('⏳ Waiting 3 seconds for crash...');
setTimeout(() => {

console.log('📋 Capturing crash logs...');
const logcatProc = spawn('adb', [...deviceFlag, 'logcat', '-d', '-v', 'time'], {
  cwd: projectRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
logcatProc.stdout.on('data', (data) => {
  output += data.toString();
});
logcatProc.stderr.on('data', (data) => {
  output += data.toString();
});

logcatProc.on('exit', () => {
  // Filter for crash-related lines
  const lines = output.split(/\r?\n/);
    const crashLines = lines.filter(line => 
      line.includes('com.drivertracking') ||
      line.includes('FATAL EXCEPTION') ||
      line.includes('AndroidRuntime') ||
      (line.includes('Process') && line.includes('died')) ||
      line.includes('SIGABRT') ||
      line.includes('SIGSEGV') ||
      line.includes('tombstone') ||
      line.includes('ReactNative') ||
      line.includes('ReactNativeJS')
    );

  const crashFile = path.join(projectRoot, 'crash-log.txt');
  fs.writeFileSync(crashFile, crashLines.join('\n'), 'utf8');
  
  console.log(`\n✅ Crash log saved to: ${crashFile}`);
  console.log(`📊 Found ${crashLines.length} crash-related lines`);
  
  if (crashLines.length > 0) {
    console.log('\n🔍 First 20 crash-related lines:');
    console.log(crashLines.slice(0, 20).join('\n'));
  } else {
    console.log('\n⚠️  No crash logs found. App may have crashed silently or logs were cleared.');
  }
});
}, 3000);
