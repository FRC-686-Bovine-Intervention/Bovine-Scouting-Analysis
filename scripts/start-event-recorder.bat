@echo off
setlocal

rem Edit these two values before running this script.
set "TBA_AUTH_KEY=eEFUlYooyVPeyGj1T07Z3AVTQoDHPM4MssTRD9XLDCapqhGepo1UQCj0OlL7AtqK"

if "%TBA_AUTH_KEY%"=="REPLACE_WITH_YOUR_TBA_AUTH_KEY" (
  echo Please edit TBA_AUTH_KEY in this file before running it.
  exit /b 1
)
if "%~1"=="" (
  echo Usage: %~nx0 event-code [event-code ...] [--once]
  exit /b 1
)

pushd "%~dp0.."
node eventSimulator\recorder.mjs %*
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
