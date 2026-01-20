# Google Maps API Key Setup

## Getting Your Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS** (if you plan to build for iOS)
   - **Geocoding API** (for address lookups)
   - **Directions API** (for route planning)
   - **Places API** (if you need place search)

4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key

5. **Important**: Restrict your API key for security:
   - Click on your API key to edit it
   - Under "Application restrictions":
     - For Android: Add your package name (`com.drivertracking`) and SHA-1 certificate fingerprint
     - For iOS: Add your bundle identifier
   - Under "API restrictions": Restrict to only the APIs you need

## Configuring the API Key

### Android

1. Open `android/gradle.properties`
2. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key:
   ```
   GOOGLE_MAPS_API_KEY=AIzaSyYourActualApiKeyHere
   ```

3. Rebuild the app:
   ```bash
   npm run android
   ```

### iOS (when ready)

1. Open `ios/DriverTracking/AppDelegate.swift`
2. Add your API key in the `didFinishLaunchingWithOptions` method

## Security Notes

- **Never commit your API key to version control**
- The `gradle.properties` file should be in `.gitignore` (it already is)
- For production, consider using environment variables or a secure key management service
- Always restrict your API keys to specific apps and APIs

## Testing

After adding your API key, rebuild and run the app. The license validation error should disappear.

