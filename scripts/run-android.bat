@echo off
REM Resolve Android SDK from ANDROID_HOME or current user's default path (no hardcoded username)
if not defined ANDROID_HOME (
  set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
  set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
  echo Android SDK not found at "%ANDROID_HOME%".
  echo Set ANDROID_HOME or install the SDK under %%LOCALAPPDATA%%\Android\Sdk
  exit /b 1
)
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%PATH%"

REM Cursor sandbox GRADLE_USER_HOME exceeds Windows MAX_PATH for React Native CMake/ninja.
echo %GRADLE_USER_HOME% | findstr /I "cursor-sandbox-cache" >nul
if not errorlevel 1 (
  set "GRADLE_USER_HOME=C:\g"
)
if not defined GRADLE_USER_HOME set "GRADLE_USER_HOME=C:\g"
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"

echo [run-android] ANDROID_HOME=%ANDROID_HOME%
echo [run-android] GRADLE_USER_HOME=%GRADLE_USER_HOME%
call npx react-native run-android
