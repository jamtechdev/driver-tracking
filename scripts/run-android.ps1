# Set Android SDK paths from current user / ANDROID_HOME (no hardcoded username)
if (-not $env:ANDROID_HOME -or -not (Test-Path (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"))) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path (Join-Path $defaultSdk "platform-tools\adb.exe")) {
    $env:ANDROID_HOME = $defaultSdk
  }
}

if (-not $env:ANDROID_HOME -or -not (Test-Path (Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"))) {
  Write-Error "Android SDK not found. Set ANDROID_HOME or install under %LOCALAPPDATA%\Android\Sdk"
  exit 1
}

$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin;$env:PATH"

# Cursor sandbox GRADLE_USER_HOME paths blow past Windows MAX_PATH (260) for RN prefab headers.
$unsafeGradleHome =
  -not $env:GRADLE_USER_HOME -or
  $env:GRADLE_USER_HOME -match 'cursor-sandbox-cache' -or
  $env:GRADLE_USER_HOME.Length -gt 40
if ($unsafeGradleHome) {
  $env:GRADLE_USER_HOME = 'C:\g'
  New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
}

Write-Host "[run-android] ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "[run-android] GRADLE_USER_HOME=$env:GRADLE_USER_HOME"

react-native run-android
