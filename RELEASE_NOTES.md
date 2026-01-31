# Driver Tracking App - Release Build

## Release Information
- **Version:** 1.0 (Build 1)
- **Build Date:** January 21, 2026
- **Platform:** Android
- **Package Name:** com.drivertracking

## APK Location
The release APK is located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

**File Size:** ~51 MB (53,479,906 bytes)

## Installation Instructions

### For Android Devices:

1. **Enable Unknown Sources:**
   - Go to Settings → Security → Enable "Install from Unknown Sources" or "Allow from this source"

2. **Transfer the APK:**
   - Copy `app-release.apk` to your Android device (via USB, email, cloud storage, etc.)

3. **Install:**
   - Open the APK file on your device
   - Tap "Install" when prompted
   - Follow the installation wizard

### Alternative: Using ADB (for developers)
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Features Included

This release includes the following features:
- Driver Dashboard with quick stats
- Route Selection
- Map View
- Pre-Trip Inspection
- Post-Trip Inspection
- Passenger Fare Management
- Messaging System
- Settings

## Build Commands

To rebuild the release APK in the future, use one of these commands:

### Using npm script:
```bash
npm run build:android:release
```

### Using the build script:
```bash
node scripts/build-release.js
```

### Or using PowerShell:
```powershell
.\scripts\build-release.ps1
```

### Direct Gradle command:
```bash
cd android
gradlew.bat assembleRelease
```

## Notes

- This build is signed with the debug keystore for testing purposes
- For production release, you should generate a proper release keystore
- The app requires Android 7.0 (API level 24) or higher
- Make sure the device has sufficient storage space (~60 MB recommended)

## Troubleshooting

If installation fails:
1. Ensure "Unknown Sources" is enabled
2. Check that the device meets minimum Android version (7.0+)
3. Verify sufficient storage space is available
4. Try uninstalling any previous versions first

## Support

For issues or questions, please contact the development team.

