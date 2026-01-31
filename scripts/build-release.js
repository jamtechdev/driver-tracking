/**
 * Build Release Script
 * Builds a release APK for Android
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Building release APK...\n');

try {
  // Change to android directory
  const androidDir = path.join(__dirname, '..', 'android');
  process.chdir(androidDir);

  // Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  execSync('gradlew.bat clean', { stdio: 'inherit' });

  // Build release APK
  console.log('\n📦 Building release APK...');
  execSync('gradlew.bat assembleRelease', { stdio: 'inherit' });

  // Check if APK was created
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  
  if (fs.existsSync(apkPath)) {
    const stats = fs.statSync(apkPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('\n✅ Release APK built successfully!');
    console.log(`📱 Location: ${apkPath}`);
    console.log(`📊 Size: ${fileSizeInMB} MB`);
    console.log('\n💡 You can now share this APK with your client.');
  } else {
    console.error('\n❌ APK not found at expected location:', apkPath);
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}

