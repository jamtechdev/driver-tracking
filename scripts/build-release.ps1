# Build Release Script for PowerShell
# Builds a release APK for Android

Write-Host "🚀 Building release APK...`n" -ForegroundColor Cyan

try {
    # Change to android directory
    $androidDir = Join-Path $PSScriptRoot ".." "android"
    Set-Location $androidDir

    # Clean previous builds
    Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
    & .\gradlew.bat clean

    # Build release APK
    Write-Host "`n📦 Building release APK..." -ForegroundColor Yellow
    & .\gradlew.bat assembleRelease

    # Check if APK was created
    $apkPath = Join-Path $androidDir "app" "build" "outputs" "apk" "release" "app-release.apk"
    
    if (Test-Path $apkPath) {
        $fileInfo = Get-Item $apkPath
        $fileSizeInMB = [math]::Round($fileInfo.Length / 1MB, 2)
        
        Write-Host "`n✅ Release APK built successfully!" -ForegroundColor Green
        Write-Host "📱 Location: $apkPath" -ForegroundColor White
        Write-Host "📊 Size: $fileSizeInMB MB" -ForegroundColor White
        Write-Host "`n💡 You can now share this APK with your client." -ForegroundColor Cyan
    } else {
        Write-Host "`n❌ APK not found at expected location: $apkPath" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "`n❌ Build failed: $_" -ForegroundColor Red
    exit 1
}

