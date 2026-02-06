# Fix "Failed to load container" in Xcode 26

Xcode 26 has known issues with project loading. Try these steps **in order**:

---

## Step 1: Full Xcode cleanup (most likely fix)

Run these commands in Terminal **with Xcode completely quit**:

```bash
# 1. Quit Xcode first (⌘Q)

# 2. Delete Derived Data
rm -rf ~/Library/Developer/Xcode/DerivedData/DriverTracking-*
rm -rf ~/Library/Developer/Xcode/DerivedData/DriverTracking

# 3. Clear Xcode caches
rm -rf ~/Library/Caches/com.apple.dt.Xcode

# 4. Reinstall CocoaPods (clean slate)
cd /Users/jamtech/Desktop/driver-app/driver-tracking/ios
pod deintegrate
pod install
cd ..
```

Then open the workspace:
```bash
open /Users/jamtech/Desktop/driver-app/driver-tracking/ios/DriverTracking.xcworkspace
```

---

## Step 2: If still failing — Reset Xcode preferences

⚠️ This resets Xcode settings (themes, keybindings, etc.) but **does not delete projects**:

```bash
defaults delete com.apple.dt.Xcode
```

Then restart your Mac and try opening the workspace again.

---

## Step 3: Alternative — Build without opening Xcode GUI

You can build and run on a **physical device** without opening Xcode:

```bash
cd /Users/jamtech/Desktop/driver-app/driver-tracking

# List connected devices
xcrun xctrace list devices

# Run on your device (replace with your device name or UDID)
npx react-native run-ios --device "Your iPad Name"
```

Make sure:
- Device is unlocked and trusted
- You've selected a development team in the project (you may need to do this once in Xcode, or edit the project file)

---

## Step 4: Nuclear option — Reinstall Xcode

If nothing works, Xcode 26 may have a bug with your project. As a last resort:

1. `sudo rm -rf /Applications/Xcode.app`
2. Restart your Mac
3. Reinstall Xcode from the Mac App Store
4. Run `xcode-select --install` if needed

---

## Important: Always open the WORKSPACE

- ✅ **Open:** `DriverTracking.xcworkspace`
- ❌ **Do NOT open:** `DriverTracking.xcodeproj` (this causes the error)
