@echo off
set VERSION=8.13
where gradle >nul 2>nul
if %errorlevel%==0 (
  gradle %*
) else (
  echo Install Android Studio or Gradle 8.13, then run: gradle assembleDebug
  exit /b 1
)
