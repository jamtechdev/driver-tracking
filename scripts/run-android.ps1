# Set Android SDK paths
$env:ANDROID_HOME = "C:\Users\JAMTECH\AppData\Local\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin;$env:PATH"

# Run React Native Android
react-native run-android

